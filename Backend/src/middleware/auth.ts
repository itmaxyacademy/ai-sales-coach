import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

const tokenPayloadSchema = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["karyawan", "manager", "company_admin", "super_admin"]),
  companyId: z.string().uuid().nullable().optional(),
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: z.infer<typeof tokenPayloadSchema>;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) {
    next(new HttpError(401, "Token autentikasi wajib disertakan."));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = tokenPayloadSchema.parse(decoded);
    next();
  } catch {
    next(new HttpError(401, "Token autentikasi tidak valid."));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : undefined;

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = tokenPayloadSchema.parse(decoded);
  } catch {
    req.user = undefined;
  }

  next();
};

// Super Admin only (pemilik SaaS)
export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new HttpError(401, "Login diperlukan untuk mengakses super admin."));
    return;
  }
  if (req.user.role !== "super_admin") {
    next(new HttpError(403, "Akses super admin diperlukan."));
    return;
  }
  next();
};

// Company Admin atau Super Admin
export const requireCompanyAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new HttpError(401, "Login diperlukan."));
    return;
  }
  if (req.user.role !== "company_admin" && req.user.role !== "super_admin") {
    next(new HttpError(403, "Akses company admin diperlukan."));
    return;
  }
  next();
};

// Team Leader, Company Admin, atau Super Admin
export const requireTeamLeader: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    next(new HttpError(401, "Login diperlukan."));
    return;
  }
  const allowedRoles = ["manager", "company_admin", "super_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    next(new HttpError(403, "Akses team leader diperlukan."));
    return;
  }
  next();
};

// Backward compat helpers
export const requireAdminAccess: RequestHandler = requireCompanyAdmin;
export const requireManager: RequestHandler = requireTeamLeader;

export function isSuperAdmin(role: string) {
  return role === "super_admin";
}

export function isCompanyAdmin(role: string) {
  return role === "company_admin" || role === "super_admin";
}

export function isTeamLeader(role: string) {
  return role === "manager" || role === "company_admin" || role === "super_admin";
}

// Legacy aliases kept for backward compat with existing routes
export function isManager(role: string) {
  return isTeamLeader(role);
}

export function isAdmin(role: string) {
  return isCompanyAdmin(role);
}
