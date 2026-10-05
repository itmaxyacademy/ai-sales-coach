import cors from "cors";

import express from "express";



import { env } from "./config/env.js";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";

import { errorHandler } from "./middleware/error-handler.js";

import { requireAdminAccess, requireAuth, optionalAuth } from "./middleware/auth.js";

import { notFound } from "./middleware/not-found.js";

import { adminRouter } from "./routes/admin.routes.js";

import { assignmentRouter } from "./routes/assignment.routes.js";

import { managerRouter } from "./routes/manager.routes.js";

import { authRouter } from "./routes/auth.routes.js";

import { healthRouter } from "./routes/health.routes.js";

import { sessionRouter } from "./routes/session.routes.js";

import { facialRouter } from "./routes/facial.routes.js";

import { courseRouter } from "./routes/course.routes.js";

import { profileRouter } from "./routes/profile.routes.js";

import { meRouter } from "./routes/me.routes.js";

import { notificationRouter } from "./routes/notification.routes.js";

import { leaderboardRouter } from "./routes/leaderboard.routes.js";

import { ttsRouter } from "./routes/tts.routes.js";

import aiRouter from "./routes/ai.routes.js";

import { companyRouter } from "./routes/company.routes.js";



// ponytail: process-local fixed windows; move these limits to the API gateway when horizontally scaled.
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
let bucketChecks = 0;
function rateLimit(limit: number, windowMs: number, keyOf: (req: express.Request) => string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const key = keyOf(req);
    let bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      requestBuckets.set(key, bucket);
    }
    bucket.count++;
    if ((++bucketChecks & 127) === 0) {
      for (const [entry, value] of requestBuckets) if (value.resetAt <= now) requestBuckets.delete(entry);
      while (requestBuckets.size > 10_000) requestBuckets.delete(requestBuckets.keys().next().value!);
    }
    if (bucket.count > limit) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: { message: "Terlalu banyak permintaan. Coba lagi sebentar." } });
      return;
    }
    next();
  };
}
const authRateLimit = rateLimit(30, 15 * 60_000, req => `${req.ip}:${req.path}`);
const aiRateLimit = rateLimit(30, 60_000, req => `ai:${req.user?.sub || req.ip || "unknown"}`);
const ttsRateLimit = rateLimit(30, 60_000, req => `tts:${req.user?.sub || req.ip || "unknown"}`);

// Hardcoded production domains (fallback jika env vars tidak terbaca)
const PRODUCTION_ORIGINS = [
  'https://flownix.my.id',
];

const allowedOrigins = new Set([
  ...PRODUCTION_ORIGINS,
  env.FRONTEND_ORIGIN,
  ...(env.FRONTEND_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [])
].filter(origin => env.NODE_ENV !== "production" || !isLocalhostOrigin(origin)));



// Fungsi bantuan baru untuk mengecek semua jenis localhost (3000, 3002, dll)

function isLocalhostOrigin(origin: string) {

  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

}



function isAllowedLanDevOrigin(origin: string) {

  if (env.NODE_ENV === "production") {

    return false;

  }



  try {

    const url = new URL(origin);

    const isHttp = url.protocol === "http:";

    const isFrontendPort = ["3000", "3001", "3002", "3003", "3004", "3005"].includes(url.port);

    const isLanHost =

      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||

      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname) ||

      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);



    return isHttp && isFrontendPort && isLanHost;

  } catch {

    return false;

  }

}



export function createApp() {

  const app = express();



  const corsMiddleware = cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        (env.NODE_ENV !== "production" && isLocalhostOrigin(origin)) ||
        isAllowedLanDevOrigin(origin)
      ) {
        callback(null, true);
        return;
      }

      logger.warn({ origin }, "Blocked origin by CORS policy");
      callback(new Error(`Origin ${origin} tidak diizinkan oleh CORS.`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.use(corsMiddleware);

  app.use(express.json({ limit: "1mb" }));

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: req => req.url === '/health' || req.url?.startsWith('/api/health') === true
      }
    })
  );

  app.get("/health", (_req, res) => {

    res.json({ status: "ok", service: "sales-ai-coach-backend" });

  });



  app.use("/api/health", healthRouter);

  app.use("/api/auth", authRateLimit, authRouter);

  app.use("/api/tts", optionalAuth, ttsRateLimit, ttsRouter);

  app.use("/api/ai", requireAuth, aiRateLimit, aiRouter);



  app.use("/api/admin", requireAuth, requireAdminAccess, adminRouter);



  app.use("/api/profile", requireAuth, profileRouter);

  app.use("/api/me", requireAuth, meRouter);

  app.use("/api/notifications", requireAuth, notificationRouter);

  app.use("/api/leaderboard", requireAuth, leaderboardRouter);

  app.use("/api/courses", requireAuth, courseRouter);

  app.use("/api/assignments", requireAuth, assignmentRouter);

  app.use("/api/sessions", requireAuth, sessionRouter);

  app.use("/api/manager", requireAuth, managerRouter);

  app.use("/api/company", requireAuth, companyRouter);

  app.use("/api/facial", requireAuth, facialRouter);



  app.use(notFound);

  app.use(errorHandler);



  return app;

}
