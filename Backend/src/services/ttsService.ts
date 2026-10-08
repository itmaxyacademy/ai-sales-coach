import { spawn, spawnSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

// ============================================================================
// 1. VOICE RESOLVER & MAPPINGS
// ============================================================================
// Mapping suara yang sudah benar dan JANGAN diubah:
// - ID cowok: id-ID-ArdiNeural, ID cewek: id-ID-GadisNeural
// - EN cowok: en-US-GuyNeural, EN cewek: en-US-JennyNeural (Jenny only, no Aria)
// ============================================================================

export function resolveEdgeTTSVoice(voice?: string, gender?: string, lang?: string): string {
  const isEnglish = (lang || "").toLowerCase().startsWith("en");
  const isFemale = (gender || "").toUpperCase() === "F" || (voice || "").toUpperCase().startsWith("F");

  // If already a full Edge-TTS voice name
  if (voice && voice.includes("-") && voice.includes("Neural")) {
    if (voice === "en-US-AriaNeural") {
      return "en-US-JennyNeural";
    }
    return voice;
  }

  if (isEnglish) {
    return isFemale ? "en-US-JennyNeural" : "en-US-GuyNeural";
  } else {
    // Indonesian
    return isFemale ? "id-ID-GadisNeural" : "id-ID-ArdiNeural";
  }
}

// ============================================================================
// 2. DISK AUDIO CACHE
// ============================================================================

const MAX_CACHE_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getCacheDir(): string {
  const configured = (env.TTS_CACHE_DIR || process.env.TTS_CACHE_DIR || "").trim();
  const dir = configured ? path.resolve(configured) : path.resolve(process.cwd(), "cache/tts");
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      logger.error({ dir, err }, "[TTS] Failed to create cache directory");
    }
  }
  return dir;
}

export function isCacheDirWritable(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const testFile = path.join(dir, `.probe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.writeFileSync(testFile, "probe");
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

export function generateCacheKey(voice: string, rate: string, pitch: string, text: string): string {
  // key = sha256(voice + rate + pitch + text)
  return crypto.createHash("sha256").update(`${voice}${rate}${pitch}${text}`).digest("hex");
}

export async function getCachedAudio(cacheDir: string, cacheKey: string): Promise<Buffer | null> {
  const filePath = path.join(cacheDir, `${cacheKey}.mp3`);
  try {
    if (fs.existsSync(filePath)) {
      const stat = await fs.promises.stat(filePath);
      if (stat.size > 0) {
        // Touch access/mod time to support LRU
        fs.utimes(filePath, new Date(), new Date(), () => {});
        return await fs.promises.readFile(filePath);
      }
    }
  } catch (err) {
    logger.warn({ cacheKey, err }, "[TTS] Error reading cache file");
  }
  return null;
}

export async function saveCachedAudio(cacheDir: string, cacheKey: string, data: Buffer): Promise<void> {
  const filePath = path.join(cacheDir, `${cacheKey}.mp3`);
  try {
    await fs.promises.writeFile(filePath, data);
    // Asynchronously prune cache without blocking
    pruneCache(cacheDir).catch((err) => {
      logger.warn({ err }, "[TTS] Cache pruning warning");
    });
  } catch (err) {
    logger.warn({ cacheKey, err }, "[TTS] Failed to write cache file");
  }
}

export async function pruneCache(cacheDir: string): Promise<void> {
  try {
    const files = await fs.promises.readdir(cacheDir);
    const now = Date.now();
    let totalSize = 0;
    const items: Array<{ path: string; size: number; mtime: number }> = [];

    for (const file of files) {
      if (!file.endsWith(".mp3")) continue;
      const fullPath = path.join(cacheDir, file);
      try {
        const stat = await fs.promises.stat(fullPath);
        if (now - stat.mtimeMs > MAX_CACHE_AGE_MS) {
          await fs.promises.unlink(fullPath).catch(() => {});
          continue;
        }
        totalSize += stat.size;
        items.push({ path: fullPath, size: stat.size, mtime: stat.mtimeMs });
      } catch {}
    }

    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      items.sort((a, b) => a.mtime - b.mtime); // oldest first
      for (const item of items) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
        await fs.promises.unlink(item.path).catch(() => {});
        totalSize -= item.size;
      }
    }
  } catch (err) {
    logger.warn({ err }, "[TTS] pruneCache encountered error");
  }
}

// ============================================================================
// 3. PYTHON EXECUTABLE RESOLVER (NO HARDCODING)
// ============================================================================

export interface PythonResolution {
  executable: string;
  isValid: boolean;
  error?: string;
}

export function resolvePythonExecutable(): PythonResolution {
  const configured = (process.env.TTS_PYTHON_PATH || env.TTS_PYTHON_PATH || "").trim();

  // 1. Explicit environment variable check
  if (configured) {
    if (fs.existsSync(configured)) {
      return { executable: configured, isValid: true };
    }
    const err = `[TTS] Configured TTS_PYTHON_PATH "${configured}" does not exist on disk!`;
    logger.error(err);
    return { executable: configured, isValid: false, error: err };
  }

  // 2. Reasonable defaults for Windows and Linux
  const isWindows = process.platform === "win32";
  const candidates: string[] = isWindows
    ? [
        path.resolve(process.cwd(), "../BackendTTS/venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "BackendTTS/venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "../venv/Scripts/python.exe"),
        path.resolve(process.cwd(), "../../BackendTTS/venv/Scripts/python.exe"),
      ]
    : [
        path.resolve(process.cwd(), "../BackendTTS/venv/bin/python"),
        path.resolve(process.cwd(), "BackendTTS/venv/bin/python"),
        path.resolve(process.cwd(), "venv/bin/python"),
        path.resolve(process.cwd(), "../venv/bin/python"),
        path.resolve(process.cwd(), "../../BackendTTS/venv/bin/python"),
      ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { executable: c, isValid: true };
    }
  }

  // 3. System PATH fallback
  const systemBinaries = isWindows ? ["python.exe", "python"] : ["python3", "python"];
  for (const bin of systemBinaries) {
    try {
      const res = spawnSync(bin, ["--version"], { stdio: "ignore" });
      if (res.status === 0) {
        return { executable: bin, isValid: true };
      }
    } catch {}
  }

  const notFoundErr = "[TTS] No valid Python executable found in venv or system PATH. Please set TTS_PYTHON_PATH.";
  logger.error(notFoundErr);
  return {
    executable: isWindows ? "python.exe" : "python3",
    isValid: false,
    error: notFoundErr,
  };
}

// ============================================================================
// 4. CONCURRENCY LIMITER & DIRECT EDGE-TTS EXECUTION
// ============================================================================

class ConcurrencyLimiter {
  private active = 0;
  private max: number;
  private queue: Array<() => void> = [];

  constructor(max: number = 3) {
    this.max = max;
  }

  acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return Promise.resolve(() => this.release());
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active++;
        resolve(() => this.release());
      });
    });
  }

  private release(): void {
    this.active--;
    if (this.queue.length > 0 && this.active < this.max) {
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

const edgeTtsLimiter = new ConcurrencyLimiter(3);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function executeDirectEdgeTTSOnce(
  pythonPath: string,
  text: string,
  voice: string,
  rate: string = "+0%",
  pitch: string = "+0Hz"
): Promise<Buffer> {
  const pyScript = `
import asyncio, sys, edge_tts

async def run():
    communicate = edge_tts.Communicate(
        sys.argv[1],
        sys.argv[2],
        rate=sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else "+0%",
        pitch=sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] else "+0Hz"
    )
    async for chunk in communicate.stream():
        if chunk['type'] == 'audio':
            sys.stdout.buffer.write(chunk['data'])

asyncio.run(run())
`;

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const py = spawn(pythonPath, ["-c", pyScript, text, voice, rate, pitch], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    py.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    py.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          py.kill("SIGKILL");
        } catch {}
        reject(new Error("Direct Python edge-tts timeout (10s)"));
      }
    }, 10_000);

    py.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`Direct Python edge-tts failed (exit ${code}): ${stderr.trim()}`));
      }
    });

    py.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

export async function synthesizeDirectWithRetry(
  text: string,
  voice: string,
  rate: string = "+0%",
  pitch: string = "+0Hz"
): Promise<Buffer> {
  const pyInfo = resolvePythonExecutable();
  if (!pyInfo.isValid) {
    throw new Error(pyInfo.error || "Python executable not found");
  }

  const release = await edgeTtsLimiter.acquire();
  try {
    let lastError: any = null;
    const maxRetries = 2; // initial attempt + max 2 retries = 3 attempts total

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = attempt === 1 ? 300 : 800;
        await sleep(backoffMs);
        logger.warn({ attempt, backoffMs, voice }, "[TTS] Retrying direct edge-tts with backoff");
      }
      try {
        const buf = await executeDirectEdgeTTSOnce(pyInfo.executable, text, voice, rate, pitch);
        return buf;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  } finally {
    release();
  }
}

// ============================================================================
// 5. PIPER TTS FALLBACK (ENGLISH ONLY, OPTIONAL)
// ============================================================================

export interface PiperInfo {
  available: boolean;
  executable?: string;
  modelPath?: string;
}

export function isPiperAvailable(): PiperInfo {
  const modelDir = (process.env.PIPER_MODEL_DIR || env.PIPER_MODEL_DIR || "").trim();
  if (!modelDir || !fs.existsSync(modelDir)) {
    return { available: false };
  }

  let modelFile: string | undefined;
  try {
    const files = fs.readdirSync(modelDir);
    modelFile = files.find((f) => f.toLowerCase().endsWith(".onnx"));
  } catch {
    return { available: false };
  }

  if (!modelFile) {
    return { available: false };
  }

  const executable = (process.env.PIPER_PATH || env.PIPER_PATH || (process.platform === "win32" ? "piper.exe" : "piper")).trim();

  try {
    const probe = spawnSync(executable, ["--help"], { stdio: "ignore" });
    if (probe.status === 0 || probe.error === undefined) {
      return {
        available: true,
        executable,
        modelPath: path.join(modelDir, modelFile),
      };
    }
  } catch {}

  return { available: false };
}

export async function synthesizeWithPiper(text: string): Promise<Buffer> {
  const info = isPiperAvailable();
  if (!info.available || !info.executable || !info.modelPath) {
    throw new Error("Piper engine or model is not available");
  }

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const piper = spawn(info.executable!, ["--model", info.modelPath!, "--output_file", "-"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    const chunks: Buffer[] = [];
    let stderr = "";

    piper.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    piper.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          piper.kill("SIGKILL");
        } catch {}
        reject(new Error("Piper execution timeout (10s)"));
      }
    }, 10_000);

    piper.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`Piper execution failed (exit ${code}): ${stderr.trim()}`));
      }
    });

    piper.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    piper.stdin.write(text);
    piper.stdin.end();
  });
}

// ============================================================================
// 6. HEALTH CHECK
// ============================================================================

export async function checkEdgeTtsInstalled(pythonPath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const py = spawn(pythonPath, ["-c", "import edge_tts"], { stdio: "ignore" });
    py.on("close", (code) => resolve(code === 0));
    py.on("error", () => resolve(false));
  });
}
