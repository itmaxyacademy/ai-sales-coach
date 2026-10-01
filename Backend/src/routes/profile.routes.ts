import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

export const profileRouter = Router();

const profileSchema = z.object({
  companyName: z.string().min(1),
  industry: z.string().min(1),
  product: z.string().min(1),
  targetCustomer: z.string().min(1),
  salesRole: z.string().min(1),
  mainChallenge: z.string().min(1),
  focusAreas: z.array(z.string())
});

// GET /api/profile
profileRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Autentikasi diperlukan.");
    }

    const profile = await prisma.trainingProfile.findUnique({
      where: { userId: req.user.sub }
    });

    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

// PUT /api/profile
profileRouter.put("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw new HttpError(401, "Autentikasi diperlukan.");
    }

    const payload = profileSchema.parse(req.body);

    const profile = await prisma.trainingProfile.upsert({
      where: { userId: req.user.sub },
      update: {
        companyName: payload.companyName,
        industry: payload.industry,
        product: payload.product,
        targetCustomer: payload.targetCustomer,
        salesRole: payload.salesRole,
        mainChallenge: payload.mainChallenge,
        focusAreas: payload.focusAreas
      },
      create: {
        userId: req.user.sub,
        companyName: payload.companyName,
        industry: payload.industry,
        product: payload.product,
        targetCustomer: payload.targetCustomer,
        salesRole: payload.salesRole,
        mainChallenge: payload.mainChallenge,
        focusAreas: payload.focusAreas
      }
    });

    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});
