import { Router } from "express";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

type ServiceStatus = "ok" | "warning" | "error";

function overallStatus(statuses: ServiceStatus[]) {
  if (statuses.includes("error")) {
    return "down";
  }

  if (statuses.includes("warning")) {
    return "degraded";
  }

  return "ok";
}

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const databaseCheck = prisma
    .$queryRaw`SELECT 1`
    .then(() => ({
      name: "Supabase database",
      status: "ok" as const,
      message: "Koneksi Prisma aktif."
    }))
    .catch((error: unknown) => ({
      name: "Supabase database",
      status: "error" as const,
      message:
        error instanceof Error
          ? error.message
          : "Database tidak bisa dihubungi."
    }));

  const [database] = await Promise.all([databaseCheck]);
  const services = [
    {
      name: "Backend API",
      status: "ok" as const,
      message: "Express server aktif."
    },
    database
  ];

  res.json({
    status: overallStatus(services.map((service) => service.status)),
    checkedAt: new Date().toISOString(),
    environment: {
      port: env.PORT,
      frontendOrigin: env.FRONTEND_ORIGIN
    },
    services
  });
});
