import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const emulatorData = join(root, ".firebase", "emulator-data");
const emulatorEnv = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  GCLOUD_PROJECT: "belt-kit",
};
const children = new Set();
let stopping = false;

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    console.error(`[dev] Could not start ${command}:`, error.message);
    stop(1);
  });
  return child;
}

function completed(child, label) {
  return new Promise((resolve, reject) => {
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ?? code})`));
    });
    child.once("error", reject);
  });
}

async function waitFor(url, label, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  console.log(`[seed] Waiting for ${label}...`);
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (options.accept(response)) {
        await response.arrayBuffer();
        console.log(`[seed] ${label} ready`);
        return;
      }
    } catch {
      // The emulator is still starting. Poll until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) child.kill("SIGINT");
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

try {
  await completed(
    run("npm", ["run", "build"], { cwd: join(root, "functions") }),
    "Functions build",
  );

  const emulatorArgs = [
    "emulators:start",
    "--only", "auth,firestore,functions,pubsub",
    "--project", "belt-kit",
    "--export-on-exit", emulatorData,
  ];
  if (existsSync(join(emulatorData, "firebase-export-metadata.json"))) {
    emulatorArgs.push("--import", emulatorData);
  }

  const emulators = run("firebase", emulatorArgs);
  emulators.once("exit", (code) => {
    if (!stopping) stop(code ?? 1);
  });

  await Promise.all([
    waitFor(
      "http://127.0.0.1:9099/emulator/v1/projects/belt-kit/config",
      "Auth emulator",
      { accept: (response) => response.ok },
    ),
    waitFor(
      "http://127.0.0.1:8080/",
      "Firestore emulator",
      { accept: (response) => response.ok },
    ),
  ]);

  await completed(
    run("npm", ["run", "seed"], {
      cwd: join(root, "functions"),
      env: emulatorEnv,
    }),
    "Demo-user seed",
  );

  const web = run("npm", ["run", "dev"], {
    cwd: join(root, "apps", "web"),
    env: {
      NEXT_PUBLIC_USE_EMULATOR: "true",
      NEXT_PUBLIC_FUNCTIONS_EMULATOR: "false",
      NEXT_PUBLIC_FUNCTIONS_BASE_URL: "http://127.0.0.1:5001/belt-kit/us-central1",
    },
  });
  web.once("exit", (code) => {
    if (!stopping) stop(code ?? 0);
  });

  await waitFor("http://127.0.0.1:3000/login", "Belt-Kit frontend", {
    timeoutMs: 90_000,
    accept: (response) => response.ok,
  });
  console.log("[dev] Belt-Kit local environment ready: http://localhost:3000");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  stop(1);
}
