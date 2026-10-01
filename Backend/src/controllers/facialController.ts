/**
 * Facial Expression Controller.
 * Terima frame base64 dari browser, analisis, simpan ke message.
 */
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { analyzeFacialExpression } from '../services/facialService.js';

export const analyzeFrame: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const { sessionId, imageBase64, messageId } = z.object({
      sessionId: z.string().uuid(),
      imageBase64: z.string().min(100),
      messageId: z.string().uuid().optional(),
    }).parse(req.body);

    // Verifikasi session milik user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user.sub, status: 'active' },
    });
    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan.');

    // Analisis ekspresi
    const analysis = await analyzeFacialExpression(imageBase64);

    // Simpan ke message kalau ada messageId
    if (messageId) {
      await prisma.message.update({
        where: { id: messageId },
        data: { facialData: analysis as any },
      });
    }

    res.json({ analysis });
  } catch (error) {
    next(error);
  }
};