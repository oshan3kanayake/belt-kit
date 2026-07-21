import { NextRequest, NextResponse } from "next/server";
import { Ollama } from "ollama";
import { z } from "zod";
import { WORKSHOP_KNOWLEDGE } from "@/lib/assistant-knowledge";
import { verifyTechnicianToken } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  message: z.string().trim().min(2).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(5000) }))
    .max(12)
    .default([]),
  attachments: z
    .array(
      z.object({
        name: z.string().max(160),
        mimeType: z.string().max(100),
        size: z.number().max(6_000_000),
        dataUrl: z.string().max(8_000_000).optional(),
        text: z.string().max(20_000).optional(),
      })
    )
    .max(3)
    .default([]),
  context: z.object({
    job: z
      .object({
        complaint: z.string().max(1000),
        status: z.string().max(100),
      })
      .nullable()
      .optional(),
    vehicle: z
      .object({
        make: z.string().max(100),
        model: z.string().max(100),
        year: z.number().nullable().optional(),
        engine: z.string().max(200).nullable().optional(),
        plateNumber: z.string().max(50).nullable().optional(),
      })
      .nullable()
      .optional(),
    parts: z
      .array(
        z.object({
          name: z.string().max(200),
          sku: z.string().max(100),
          quantityOnHand: z.number(),
          lowStock: z.boolean(),
        })
      )
      .max(50)
      .default([]),
  }),
});

const answerSchema = z.object({
  summary: z.string(),
  urgency: z.enum(["routine", "soon", "stop_and_inspect"]),
  likelyCauses: z.array(z.string()).max(4),
  nextChecks: z.array(z.string()).min(1).max(6),
  toolsOrParts: z.array(z.string()).max(6),
  safetyWarning: z.string().nullable(),
  followUpQuestion: z.string(),
});

type EmbeddedArticle = { id: string; title: string; vector: number[] };
let embeddedKnowledge: EmbeddedArticle[] | null = null;

function ollamaClient() {
  return new Ollama({
    host: process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
  });
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

async function retrieveKnowledge(client: Ollama, question: string) {
  const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma";
  const [queryResult, articles] = await Promise.all([
    client.embed({ model: embeddingModel, input: question }),
    embeddedKnowledge
      ? Promise.resolve(embeddedKnowledge)
      : client
          .embed({
            model: embeddingModel,
            input: WORKSHOP_KNOWLEDGE.map((article) => `${article.title}\n${article.content}`),
          })
          .then((result) => {
            embeddedKnowledge = WORKSHOP_KNOWLEDGE.map((article, index) => ({
              id: article.id,
              title: article.title,
              vector: result.embeddings[index],
            }));
            return embeddedKnowledge;
          }),
  ]);

  const queryVector = queryResult.embeddings[0];
  return articles
    .map((article) => ({
      article,
      score: cosineSimilarity(queryVector, article.vector),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ article }) => WORKSHOP_KNOWLEDGE.find((item) => item.id === article.id)!)
    .filter(Boolean);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Sign in before using the technician assistant." }, { status: 401 });
  }
  try {
    await verifyTechnicianToken(token);
  } catch (error) {
    if (error instanceof Error && error.message === "TECHNICIAN_ONLY") {
      return NextResponse.json({ error: "The Technician Assistant is available only to technician accounts." }, { status: 403 });
    }
    return NextResponse.json({ error: "Your session is not valid. Sign in again before using the assistant." }, { status: 401 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a technician question and valid vehicle context." }, { status: 400 });
  }

  const client = ollamaClient();
  const chatModel = process.env.OLLAMA_CHAT_MODEL || "qwen3:4b";
  const visionModel = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b";

  try {
    const sources = await retrieveKnowledge(client, parsed.data.message);
    const context = parsed.data.context;
    const imageAttachments = parsed.data.attachments.filter(
      (attachment) => attachment.mimeType.startsWith("image/") && attachment.dataUrl
    );
    const textAttachments = parsed.data.attachments
      .filter((attachment) => attachment.text)
      .map((attachment) => `Attachment: ${attachment.name}\n${attachment.text}`)
      .join("\n\n");
    const historyMessages = parsed.data.history.map((item) => ({
      role: item.role,
      content: item.content,
    }));
    const response = await client.chat({
      model: imageAttachments.length ? visionModel : chatModel,
      stream: false,
      format: z.toJSONSchema(answerSchema),
      options: { temperature: 0.2 },
      messages: [
        {
          role: "system",
          content: `You are Belt-Kit Technician Assistant. Help a trained automotive technician think through a repair. Use the supplied job, vehicle, inventory and retrieved reference notes. Do not invent torque specifications, part compatibility, measurements, or completed tests. State uncertainty and ask one useful follow-up. Never instruct unsafe work; escalate high-voltage, braking, fuel, lifting, or overheating risks. Do not claim to have performed any action. Return only JSON matching the required schema.`,
        },
        ...historyMessages,
        {
          role: "user",
          content: JSON.stringify({
            technicianQuestion: parsed.data.message,
            activeJob: context.job ?? "No active job card selected",
            vehicle: context.vehicle ?? "No vehicle selected",
            inventory: context.parts,
            attachments: textAttachments || "No text attachments",
            retrievedReferenceNotes: sources.map((source) => ({ title: source.title, content: source.content })),
          }),
          ...(imageAttachments.length
            ? { images: imageAttachments.map((attachment) => attachment.dataUrl!.split(",")[1] ?? attachment.dataUrl!) }
            : {}),
        },
      ],
    });
    const answer = answerSchema.parse(JSON.parse(response.message.content));
    return NextResponse.json({ answer, sources: sources.map((source) => source.title) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The local AI service is unavailable.";
    const missingModel = /model .* not found|not found/i.test(message);
    const memoryLimit = /more system memory|out of memory|memory/i.test(message);
    const activeModel = imageAttachmentsModelHint(parsed.data.attachments, visionModel, chatModel);
    return NextResponse.json(
      {
        error: memoryLimit && imageAttachmentsModelHint(parsed.data.attachments, visionModel, chatModel) === visionModel
          ? `The image model needs more RAM than this computer currently has. Text questions still work; use a smaller Ollama vision model or attach a text description instead.`
          : missingModel
          ? `Required Ollama model is missing. Run: ollama pull ${activeModel} (and ollama pull ${process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma"} for retrieval).`
          : "Technician Assistant cannot reach local Ollama. Start Ollama, then try again.",
      },
      { status: 503 }
    );
  }
}

function imageAttachmentsModelHint(
  attachments: Array<{ mimeType: string }>,
  visionModel: string,
  chatModel: string
) {
  return attachments.some((attachment) => attachment.mimeType.startsWith("image/"))
    ? visionModel
    : chatModel;
}
