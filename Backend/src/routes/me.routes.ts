/**
 * me.routes.ts - Karyawan endpoints
 * GET  /api/me        - Get current user profile
 * PATCH /api/me        - Update current user profile  
 * GET  /api/me/dashboard
 * GET  /api/me/stats
 */

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { getMyDashboard, getMyStats, getMyProgress, getMyStrengths, getWeeklyStats, getMyBadges } from "../controllers/meController.js";

export const meRouter = Router();

// ─── GET /api/me ───────────────────────────────────────────
meRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) throw new HttpError(404, "User tidak ditemukan");

    const profile = await prisma.trainingProfile.findUnique({
      where: { userId: req.user.sub },
    });

    res.json({
      data: {
        ...user,
        profile: profile || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ─── PATCH /api/me ───────────────────────────────────────────
const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
});

meRouter.patch("/", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");

    const payload = updateMeSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data: payload,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/me/dashboard ───────────────────────────────────────────
meRouter.get("/dashboard", getMyDashboard);

// ─── GET /api/me/stats ───────────────────────────────────────────
meRouter.get("/stats/weekly", getWeeklyStats);
meRouter.get("/stats", getMyStats);

// ─── GET /api/me/progress ───────────────────────────────────────────
meRouter.get("/progress", getMyProgress);

// ─── GET /api/me/strengths ───────────────────────────────────────────
meRouter.get("/strengths", getMyStrengths);

// ─── GET /api/me/badges ───────────────────────────────────────────
meRouter.get("/badges", getMyBadges);

// ─── PATCH /api/me/password ───────────────────────────────────────────
import bcrypt from "bcryptjs";

meRouter.patch("/password", async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");

    const { oldPassword, newPassword } = z.object({
      oldPassword: z.string().min(1),
      newPassword: z.string().min(6),
    }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { passwordHash: true },
    });
    if (!user) throw new HttpError(404, "User tidak ditemukan.");

    const valid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!valid) throw new HttpError(401, "Current password is incorrect.");

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.sub },
      data: { passwordHash: newHash },
    });

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
});
