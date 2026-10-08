import { Router } from "express";
import { z } from "zod";
import { performance } from "perf_hooks";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";
import {
  resolveEdgeTTSVoice,
  getCacheDir,
  isCacheDirWritable,
  generateCacheKey,
  getCachedAudio,
  saveCachedAudio,
  resolvePythonExecutable,
  synthesizeDirectWithRetry,
  isPiperAvailable,
  synthesizeWithPiper,
  checkEdgeTtsInstalled,
} from "../services/ttsService.js";

export { resolveEdgeTTSVoice };

export const ttsRouter = Router();

const TTS_PYTHON_URL = (env.TTS_PYTHON_URL || process.env.TTS_PYTHON_URL || "http://127.0.0.1:5001").replace(/\/$/, "");

const ttsSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(5000, "Text maksimal 5000 karakter."),
  voice: z.string().optional().default("M1"),
  gender: z.string().optional().default("M"),
  lang: z.string().optional().default("id"),
  rate: z.string().optional().default("+0%"),
  pitch: z.string().optional().default("+0Hz"),
});

// ----------------------------------------------------------------------------
// POST /api/tts/synthesize
// Fallback Chain: Cache -> Service :5001 -> Direct edge-tts -> Piper -> Error
// ----------------------------------------------------------------------------
ttsRouter.post("/synthesize", async (req, res) => {
  const startTime = performance.now();
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.errors[0].message });
    return;
  }

  const { text, voice, gender, lang, rate, pitch } = parsed.data;
  const resolvedVoice = resolveEdgeTTSVoice(voice, gender, lang);
  const isEnglish = (lang || "").toLowerCase().startsWith("en");
  const cacheDir = getCacheDir();
  const cacheKey = generateCacheKey(resolvedVoice, rate, pitch, text);

  // 1. DISK CACHE CHECK
  try {
    const cachedBuffer = await getCachedAudio(cacheDir, cacheKey);
    if (cachedBuffer && cachedBuffer.length > 0) {
      const durationMs = performance.now() - startTime;
      logger.info(
        { voice: resolvedVoice, engine: "edge-cache", durationMs: Math.round(durationMs), cacheHit: true },
        "[TTS] Request completed (cache hit)"
      );
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("X-TTS-Engine", "edge-cache");
      res.setHeader("X-Voice-Used", resolvedVoice);
      res.setHeader("Content-Length", cachedBuffer.length);
      res.end(cachedBuffer);
      return;
    }
  } catch (cacheErr) {
    logger.warn({ err: cacheErr }, "[TTS] Cache read exception, proceeding to engines");
  }

  let audioBuffer: Buffer | null = null;
  let usedEngine: "edge" | "piper" | null = null;
  let mimeType = "audio/mpeg";

  // 2. MICROSERVICE :5001 (FastAPI)
  try {
    const response = await fetch(`${TTS_PYTHON_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: resolvedVoice, gender, lang, rate, pitch }),
      signal: AbortSignal.timeout(5_000),
    });

    if (response.ok) {
      const arrayBuf = await response.arrayBuffer();
      if (arrayBuf && arrayBuf.byteLength > 100) {
        audioBuffer = Buffer.from(arrayBuf);
        usedEngine = "edge";
        mimeType = response.headers.get("content-type") || "audio/mpeg";
      }
    }
  } catch (serviceErr) {
    logger.warn(
      { err: serviceErr instanceof Error ? serviceErr.message : String(serviceErr) },
      "[TTS] Python microservice unavailable, moving to direct edge-tts"
    );
  }

  // 3. DIRECT PYTHON EDGE-TTS (Timeout 10s, max 2 retries, concurrency 3)
  if (!audioBuffer) {
    try {
      audioBuffer = await synthesizeDirectWithRetry(text, resolvedVoice, rate, pitch);
      usedEngine = "edge";
      mimeType = "audio/mpeg";
    } catch (directErr) {
      logger.warn(
        { err: directErr instanceof Error ? directErr.message : String(directErr) },
        "[TTS] Direct Python edge-tts failed, checking Piper"
      );
    }
  }

  // 4. PIPER (English only, optional fallback)
  if (!audioBuffer && isEnglish) {
    const piperInfo = isPiperAvailable();
    if (piperInfo.available) {
      try {
        audioBuffer = await synthesizeWithPiper(text);
        usedEngine = "piper";
        mimeType = "audio/wav";
      } catch (piperErr) {
        logger.warn(
          { err: piperErr instanceof Error ? piperErr.message : String(piperErr) },
          "[TTS] Piper fallback failed"
        );
      }
    }
  }

  // 5. SUCCESS HANDLING (Save to cache & return response)
  if (audioBuffer && usedEngine) {
    const durationMs = performance.now() - startTime;
    logger.info(
      { voice: resolvedVoice, engine: usedEngine, durationMs: Math.round(durationMs), cacheHit: false },
      "[TTS] Request completed"
    );

    // Save to disk cache asynchronously
    saveCachedAudio(cacheDir, cacheKey, audioBuffer).catch(() => {});

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-TTS-Engine", usedEngine);
    res.setHeader("X-Voice-Used", resolvedVoice);
    res.setHeader("Content-Length", audioBuffer.length);
    res.end(audioBuffer);
    return;
  }

  // 6. ALL ENGINES FAILED -> { engine: "none" }
  const durationMs = performance.now() - startTime;
  logger.error(
    { voice: resolvedVoice, engine: "none", durationMs: Math.round(durationMs), cacheHit: false },
    "[TTS] All TTS engines failed"
  );

  if (!res.headersSent) {
    res.status(503).json({
      success: false,
      engine: "none",
      message: "All TTS engines failed",
    });
  }
});

// ----------------------------------------------------------------------------
// GET /api/tts/health
// Health check: edge-tts installed, venv valid, cache dir writable, piper available
// ----------------------------------------------------------------------------
ttsRouter.get("/health", async (_req, res) => {
  const pythonInfo = resolvePythonExecutable();
  const cacheDir = getCacheDir();
  const cacheDirWritable = isCacheDirWritable(cacheDir);
  const piperInfo = isPiperAvailable();

  let edgeTtsInstalled = false;
  if (pythonInfo.isValid) {
    try {
      edgeTtsInstalled = await checkEdgeTtsInstalled(pythonInfo.executable);
    } catch {
      edgeTtsInstalled = false;
    }
  }

  let microserviceAvailable = false;
  try {
    const msRes = await fetch(`${TTS_PYTHON_URL}/health`, { signal: AbortSignal.timeout(1500) });
    microserviceAvailable = msRes.ok;
  } catch {
    microserviceAvailable = false;
  }

  const isHealthy = (microserviceAvailable || (pythonInfo.isValid && edgeTtsInstalled)) && cacheDirWritable;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    edgeTtsInstalled,
    venvValid: pythonInfo.isValid,
    pythonPath: pythonInfo.executable,
    cacheDir,
    cacheDirWritable,
    microserviceAvailable,
    microserviceUrl: TTS_PYTHON_URL,
    piperAvailable: piperInfo.available,
    piperModel: piperInfo.modelPath || null,
  });
});

// ----------------------------------------------------------------------------
// GET /api/tts/voices
// ----------------------------------------------------------------------------
ttsRouter.get("/voices", async (_req, res) => {
  res.json({
    voices: [
      { id: "M1", name: "Cowok Indo (Ardi)", gender: "M", lang: "id", edgeVoice: "id-ID-ArdiNeural" },
      { id: "F1", name: "Cewek Indo (Gadis)", gender: "F", lang: "id", edgeVoice: "id-ID-GadisNeural" },
      { id: "M3", name: "Cowok Inggris (Guy)", gender: "M", lang: "en", edgeVoice: "en-US-GuyNeural" },
      { id: "F2", name: "Cewek Inggris (Jenny)", gender: "F", lang: "en", edgeVoice: "en-US-JennyNeural" },
    ],
  });
});
