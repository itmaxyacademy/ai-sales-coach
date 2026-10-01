import type { RequestHandler } from "express";
import { z } from "zod";
import { OpenAI } from "openai";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { encrypt, decrypt } from "../lib/crypto.js";
import { logAudit } from "../lib/audit.js";

// GET /api/admin/ai-keys
export const listAiKeys: RequestHandler = async (req, res, next) => {
  try {
    const keys = await prisma.aiApiKey.findMany({
      select: {
        id: true,
        provider: true,
        label: true,
        keyPreview: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    res.json({ data: keys });
  } catch (error) {
    next(error);
  }
};

// POST /api/admin/ai-keys
export const createAiKey: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const { provider, label, apiKey } = z.object({
      provider: z.string(),
      label: z.string().min(1),
      apiKey: z.string().min(1),
    }).parse(req.body);

    const encrypted = encrypt(apiKey);
    const preview = apiKey.length > 8 ? apiKey.slice(0, 8) + "..." : apiKey;

    const key = await prisma.aiApiKey.create({
      data: {
        provider,
        label,
        keyHash: encrypted,
        keyPreview: preview,
        isActive: true,
        createdById: req.user.sub,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        keyPreview: true,
        isActive: true,
        createdAt: true,
      }
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "key.create",
      targetType: "ai_key",
      targetId: key.id,
      metadata: { provider, label },
      ipAddress: typeof req.ip === "string" ? req.ip : undefined,
    });

    res.status(201).json({ data: key });
  } catch (e) {
    next(e);
  }
};

// PATCH /api/admin/ai-keys/:id
export const updateAiKey: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const id = req.params.id as string;
    const { label, isActive } = z.object({
      label: z.string().optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const key = await prisma.aiApiKey.update({
      where: { id },
      data: {
        label,
        isActive,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        keyPreview: true,
        isActive: true,
        updatedAt: true,
      }
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "key.rotate",
      targetType: "ai_key",
      targetId: id,
      metadata: { label, isActive },
      ipAddress: typeof req.ip === "string" ? req.ip : undefined,
    });

    res.json({ data: key });
  } catch (e) {
    next(e);
  }
};

// DELETE /api/admin/ai-keys/:id
export const deleteAiKey: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const id = req.params.id as string;
    await prisma.aiApiKey.update({
      where: { id },
      data: { isActive: false },
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "key.delete",
      targetType: "ai_key",
      targetId: id,
      ipAddress: typeof req.ip === "string" ? req.ip : undefined,
    });

    res.json({ message: "Key dinonaktifkan." });
  } catch (e) {
    next(e);
  }
};

// POST /api/admin/ai-keys/:id/test
export const testAiKey: RequestHandler = async (req, res, _next) => {
  try {
    const id = req.params.id as string;
    const keyData = await prisma.aiApiKey.findUnique({
      where: { id },
    });
    if (!keyData) throw new HttpError(404, "Key tidak ditemukan.");

    const decryptedKey = decrypt(keyData.keyHash);

    // Call OpenAI dummy
    const client = new OpenAI({ apiKey: decryptedKey });
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 5,
      temperature: 0.1,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    res.json({ status: "ok", response: text });
  } catch (error) {
    res.status(400).json({ status: "error", error: error instanceof Error ? error.message : "Key test failed" });
  }
};
