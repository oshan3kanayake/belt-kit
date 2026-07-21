const baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
const chatModel = process.env.OLLAMA_CHAT_MODEL || "qwen3:4b";
const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL || "embeddinggemma";
const visionModel = process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b";

try {
  const response = await fetch(`${baseUrl}/api/tags`);
  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
  const body = await response.json();
  const models = body.models?.map((model) => model.name) ?? [];
  const hasModel = (requested) =>
    models.includes(requested) || models.includes(`${requested}:latest`);
  const missing = [chatModel, embeddingModel, visionModel].filter((model) => !hasModel(model));
  if (missing.length) {
    console.error(`Ollama is running, but these models are missing: ${missing.join(", ")}`);
    console.error(`Run: ollama pull ${chatModel} && ollama pull ${embeddingModel}`);
    process.exit(1);
  }
  console.log(`Ollama is ready at ${baseUrl}. Found ${chatModel}, ${embeddingModel}, and ${visionModel}.`);
} catch (error) {
  console.error(`Cannot reach Ollama at ${baseUrl}. Start Ollama, then run this command again.`);
  process.exit(1);
}
