import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { HttpError } from "../lib/http-error.js";
import { logger } from "../lib/logger.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "Payload tidak valid.",
      issues: error.flatten()
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
    return;
  }

  if (typeof error === "object" && error !== null && "status" in error && typeof (error as any).status === "number") {
    const status = (error as any).status;
    const isRateLimit = status === 429;
    res.status(isRateLimit ? 429 : 503).json({
      success: false,
      message: isRateLimit
        ? "Batas penggunaan AI tercapai. Silakan tunggu sebentar dan coba lagi."
        : "Layanan AI sedang sibuk atau mengalami kendala koneksi. Silakan coba kirim ulang."
    });
    return;
  }

  logger.error({ err: error }, "[Unhandled Error]");
  
  // Mencegah kebocoran data sensitif (CWE-209: Information Exposure Through an Error Message)
  // Jangan pernah mengirimkan raw error.message ke client pada unhandled error (500), 
  // karena bisa berisi koneksi database, path server, dll.
  res.status(500).json({
    success: false,
    message: "Terjadi kesalahan server internal."
  });
};
