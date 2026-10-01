import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter."),
  email: z.string().email(),
  password: z.string().min(6, "Password minimal 6 karakter."),
  role: z.enum(["karyawan", "manager", "company_admin", "super_admin"]).optional().default("karyawan")
});

export const authRouter = Router();

function buildAuthResponse(user: {
  id: string;
  name: string;
  email: string;
  role: "karyawan" | "manager" | "company_admin" | "super_admin";
  companyId: string | null | undefined;
}) {
  const token = jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    },
    env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      companyId: user.companyId ?? null,
    }
  };
}

// ─── REGISTER (karyawan mandiri - legacy) ─────────────

authRouter.post("/register", async (req, res, next) => {
  try {
    const payload = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });

    if (existingUser) throw new HttpError(409, "Email sudah terdaftar.");

    const passwordHash = await bcrypt.hash(payload.password, 10);
    const user = await prisma.user.create({
      data: { name: payload.name, email: payload.email, passwordHash, role: payload.role },
      select: { id: true, name: true, email: true, role: true, companyId: true }
    });

    logAudit({ actorId: user.id, actorRole: user.role, action: "user.register", targetType: "user", targetId: user.id, ipAddress: req.ip });

    res.status(201).json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

// ─── LOGIN ────────────────────────────────────────────

authRouter.post("/login", async (req, res, next) => {
  try {
    const payload = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, name: true, email: true, role: true, passwordHash: true, isActive: true, companyId: true }
    });

    if (!user) throw new HttpError(401, "Email atau password salah.");

    if (!user.isActive) throw new HttpError(403, "Akun Anda telah dinonaktifkan. Hubungi admin perusahaan Anda.");

    const passwordValid = await bcrypt.compare(payload.password, user.passwordHash);
    if (!passwordValid) throw new HttpError(401, "Email atau password salah.");

    logAudit({ actorId: user.id, actorRole: user.role, action: "user.login", targetType: "user", targetId: user.id, ipAddress: req.ip });

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

// ─── REGISTER COMPANY (Self-Service B2B Onboarding) ───

const registerCompanySchema = z.object({
  // Data perusahaan
  companyName: z.string().min(2, "Nama perusahaan minimal 2 karakter."),
  industry: z.string().optional().default("-"),
  website: z.string().url("Format website tidak valid.").optional().or(z.literal("")),
  // Data HR / Pendaftar - akan jadi company_admin pertama
  adminName: z.string().min(2, "Nama Anda minimal 2 karakter."),
  adminEmail: z.string().email("Format email tidak valid."),
  adminPassword: z.string().min(8, "Password minimal 8 karakter."),
});

authRouter.post("/register-company", async (req, res, next) => {
  try {
    const payload = registerCompanySchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: payload.adminEmail } });
    if (existing) throw new HttpError(409, "Email sudah terdaftar. Gunakan email lain.");

    const passwordHash = await bcrypt.hash(payload.adminPassword, 10);

    // Buat Company + company_admin pertama dalam 1 transaksi atomik
    const result = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: payload.companyName,
          industry: payload.industry || "-",
          website: payload.website || null,
          subscriptionPlan: "trial",
          maxSeats: 10, // Default trial: 10 kursi karyawan
        }
      });

      const admin = await tx.user.create({
        data: {
          companyId: company.id,
          name: payload.adminName,
          email: payload.adminEmail,
          passwordHash,
          role: "company_admin",
        },
        select: { id: true, name: true, email: true, role: true, companyId: true }
      });

      return { company, admin };
    });

    logAudit({
      actorId: result.admin.id,
      actorRole: result.admin.role,
      action: "company.register",
      targetType: "user",
      targetId: result.admin.id,
      metadata: { companyId: result.company.id, companyName: result.company.name },
      ipAddress: req.ip,
    });

    res.status(201).json({
      ...buildAuthResponse(result.admin),
      company: {
        id: result.company.id,
        name: result.company.name,
        subscriptionPlan: result.company.subscriptionPlan,
        maxSeats: result.company.maxSeats,
      },
      message: `Perusahaan "${result.company.name}" berhasil terdaftar! Anda sudah login sebagai Company Admin.`
    });
  } catch (error) {
    next(error);
  }
});

export const FALLBACK_DEMO_USERS = [
  // Super Admin
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "System Super Admin",
    email: "superadmin@salescoach.ai",
    role: "super_admin" as const,
    isActive: true,
    companyId: null,
    company: null,
    team: null,
  },
  // PT Indofood Sukses Makmur Tbk
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Admin Indofood",
    email: "admin@indofood.co.id",
    role: "company_admin" as const,
    isActive: true,
    companyId: "11111111-1111-1111-1111-111111111111",
    company: { name: "PT Indofood Sukses Makmur Tbk" },
    team: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Manager Indomie",
    email: "mgr.indomie@indofood.co.id",
    role: "manager" as const,
    isActive: true,
    companyId: "11111111-1111-1111-1111-111111111111",
    company: { name: "PT Indofood Sukses Makmur Tbk" },
    team: { name: "Indomie Division" },
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    name: "Budi Pratama (Sales)",
    email: "budi.sales1@indofood.co.id",
    role: "karyawan" as const,
    isActive: true,
    companyId: "11111111-1111-1111-1111-111111111111",
    company: { name: "PT Indofood Sukses Makmur Tbk" },
    team: { name: "Indomie Division" },
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    name: "Manager Bogasari",
    email: "mgr.bogasari@indofood.co.id",
    role: "manager" as const,
    isActive: true,
    companyId: "11111111-1111-1111-1111-111111111111",
    company: { name: "PT Indofood Sukses Makmur Tbk" },
    team: { name: "Bogasari Division" },
  },
  {
    id: "00000000-0000-0000-0000-000000000006",
    name: "Siti Wijaya (Sales)",
    email: "siti.sales2@indofood.co.id",
    role: "karyawan" as const,
    isActive: true,
    companyId: "11111111-1111-1111-1111-111111111111",
    company: { name: "PT Indofood Sukses Makmur Tbk" },
    team: { name: "Bogasari Division" },
  },
  // PT Djarum
  {
    id: "00000000-0000-0000-0000-000000000007",
    name: "Admin Djarum",
    email: "admin@djarum.com",
    role: "company_admin" as const,
    isActive: true,
    companyId: "22222222-2222-2222-2222-222222222222",
    company: { name: "PT Djarum" },
    team: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000008",
    name: "Manager Polytron",
    email: "mgr.electronics@djarum.com",
    role: "manager" as const,
    isActive: true,
    companyId: "22222222-2222-2222-2222-222222222222",
    company: { name: "PT Djarum" },
    team: { name: "Polytron Electronics" },
  },
  {
    id: "00000000-0000-0000-0000-000000000009",
    name: "Kevin Sanjaya (Sales)",
    email: "kevin.sales1@djarum.com",
    role: "karyawan" as const,
    isActive: true,
    companyId: "22222222-2222-2222-2222-222222222222",
    company: { name: "PT Djarum" },
    team: { name: "Polytron Electronics" },
  },
  // PT Indotrack Alat Berat
  {
    id: "00000000-0000-0000-0000-000000000010",
    name: "HR / Admin Indotrack",
    email: "hr@indotrack.co.id",
    role: "company_admin" as const,
    isActive: true,
    companyId: "33333333-3333-3333-3333-333333333333",
    company: { name: "PT Indotrack Alat Berat" },
    team: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000011",
    name: "Budi Pratama (Manager)",
    email: "budi1@indotrack.co.id",
    role: "manager" as const,
    isActive: true,
    companyId: "33333333-3333-3333-3333-333333333333",
    company: { name: "PT Indotrack Alat Berat" },
    team: { name: "Heavy Fleet Sales Team" },
  },
  {
    id: "00000000-0000-0000-0000-000000000012",
    name: "Raka Kusuma (Sales)",
    email: "raka.sales@indotrack.co.id",
    role: "karyawan" as const,
    isActive: true,
    companyId: "33333333-3333-3333-3333-333333333333",
    company: { name: "PT Indotrack Alat Berat" },
    team: { name: "Heavy Fleet Sales Team" },
  },
  // PT Medika Persada Sakti
  {
    id: "00000000-0000-0000-0000-000000000013",
    name: "HR / Admin Medika",
    email: "hr@medikasakti.co.id",
    role: "company_admin" as const,
    isActive: true,
    companyId: "44444444-4444-4444-4444-444444444444",
    company: { name: "PT Medika Persada Sakti" },
    team: null,
  },
  {
    id: "00000000-0000-0000-0000-000000000014",
    name: "Dedi Prabowo (Manager)",
    email: "dedi90@medikasakti.co.id",
    role: "manager" as const,
    isActive: true,
    companyId: "44444444-4444-4444-4444-444444444444",
    company: { name: "PT Medika Persada Sakti" },
    team: { name: "Hospital Equipment Team" },
  },
  {
    id: "00000000-0000-0000-0000-000000000015",
    name: "Nadia Firmansyah (Sales)",
    email: "nadia.sales@medikasakti.co.id",
    role: "karyawan" as const,
    isActive: true,
    companyId: "44444444-4444-4444-4444-444444444444",
    company: { name: "PT Medika Persada Sakti" },
    team: { name: "Hospital Equipment Team" },
  },
];

// ─── DEMO LOGIN (Quick Login) ─────────────────────────

authRouter.post("/demo-login", async (req, res, next) => {
  try {
    const email = req.body.email;
    if (!email) throw new HttpError(400, "Email is required");

    let user: any = null;
    try {
      user = await prisma.user.findFirst({
        where: { email, isActive: true },
        select: { id: true, name: true, email: true, role: true, isActive: true, companyId: true },
      });
    } catch {
      // Database might be offline / unreachable
      user = FALLBACK_DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (!user) {
      user = FALLBACK_DEMO_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    }

    if (!user) throw new HttpError(404, `No active user found for email: ${email}`);

    logAudit({ actorId: user.id, actorRole: user.role, action: "user.demo_login", targetType: "user", targetId: user.id, ipAddress: req.ip });

    res.json(buildAuthResponse(user));
  } catch (error) {
    next(error);
  }
});

authRouter.get("/demo-users", async (req, res) => {
  try {
    let users: any[] = [];
    try {
      users = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          company: { select: { name: true } },
          team: { select: { name: true } }
        },
        orderBy: [
          { role: "asc" },
          { name: "asc" }
        ]
      });
    } catch {
      users = [];
    }

    if (!users || users.length === 0) {
      users = FALLBACK_DEMO_USERS;
    }

    res.json({ data: users });
  } catch {
    res.json({ data: FALLBACK_DEMO_USERS });
  }
});
