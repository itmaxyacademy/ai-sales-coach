import { Router } from "express";
import { z } from "zod";
import { logger } from '../lib/logger.js';

import { env } from "../config/env.js";

export const ttsRouter = Router();

const TTS_PYTHON_URL = (env.TTS_PYTHON_URL || process.env.TTS_PYTHON_URL || "http://127.0.0.1:5001").replace(/\/$/, "");

const ttsSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(5000, "Text maksimal 5000 karakter."),
  voice: z.string().optional().default("M1"),
  gender: z.string().optional().default("M"),
  lang: z.string().optional().default("id"),
});

ttsRouter.post("/synthesize", async (req, res) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, message: parsed.error.errors[0].message });
    return;
  }

  try {
    const { text, voice, gender, lang } = parsed.data;
    logger.info({ text_length: text?.length, voice, gender, lang }, '[TTS] Synthesizing audio');

    const response = await fetch(`${TTS_PYTHON_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, gender, lang }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => "unknown");
      logger.warn({ err }, "[TTS] Python service unreachable or error");
      res.status(502).json({ success: false, offline: true, message: "TTS service error" });
      return;
    }

    const contentType = response.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "no-cache");

    const reader = response.body!.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); break; }
        res.write(value);
      }
    };
    await pump();

  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : String(err) }, "[TTS] Service offline");
    if (!res.headersSent) {
      res.status(503).json({ success: false, offline: true, message: "TTS service offline" });
    }
  }
});

ttsRouter.get("/voices", async (_req, res) => {
  try {
    const response = await fetch(`${TTS_PYTHON_URL}/voices`);
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ success: false, message: "Could not reach TTS service" });
  }
});
