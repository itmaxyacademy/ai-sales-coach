/**
 * src/routes/company.routes.ts
 * Routes untuk manajemen multi-tenant company:
 * - POST /auth/register-company  - Self-service registrasi perusahaan baru
 * - GET  /api/company/me         - Info perusahaan sendiri
 * - GET  /api/company/teams      - List semua tim di perusahaan
 * - POST /api/company/teams      - Buat tim baru
 * - GET  /api/company/teams/:id  - Detail satu tim + anggota
 * - PATCH /api/company/teams/:id - Edit tim
 * - DELETE /api/company/teams/:id - Hapus tim
 * - POST /api/company/teams/:id/leaders - Assign manager ke tim
 * - DELETE /api/company/teams/:teamId/leaders/:userId - Unassign manager dari tim
 * - GET  /api/company/users      - List semua user di perusahaan
 * - POST /api/company/users/bulk - Buat akun karyawan massal + auto-generate password
 * - POST /api/company/users      - Buat 1 akun (karyawan/manager)
 * - PATCH /api/company/users/:id - Edit user
 * - DELETE /api/company/users/:id - Deactivate user
 * - POST /api/company/users/:id/reset-password - Reset password user
 */

import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { parsePage } from "../lib/http-query.js";
import { logAudit } from "../lib/audit.js";
import { isCompanyAdmin } from "../middleware/auth.js";

export const companyRouter = Router();

// ─── HELPER ──────────────────────────────────────────

function generatePassword(length = 12): string {
  const lowers = "abcdefghjkmnpqrstuvwxyz";
  const uppers = "ABCDEFGHJKMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
  
  const allChars = lowers + uppers + numbers + symbols;
  let password = "";
  password += lowers[Math.floor(Math.random() * lowers.length)];
  password += uppers[Math.floor(Math.random() * uppers.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  for (let i = 4; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => 0.5 - Math.random()).join('');
}

// Guard: hanya company_admin atau super_admin
function guardCompanyAdmin(req: any, next: any) {
  if (!isCompanyAdmin(req.user?.role)) {
    next(new HttpError(403, "Akses company admin diperlukan."));
    return false;
  }
  return true;
}

// Guard: pastikan resource milik company yang sama
function getCompanyId(req: any): string {
  if (req.user?.role === "super_admin") {
    // super_admin bisa akses semua, tapi tetap perlu companyId di query
    const cid = req.query.companyId || req.body?.companyId;
    if (!cid) throw new HttpError(400, "Parameter companyId diperlukan untuk super_admin.");
    return cid as string;
  }
  if (!req.user?.companyId) throw new HttpError(403, "Akun ini tidak terhubung ke perusahaan manapun.");
  return req.user.companyId;
}

// ─── COMPANY INFO ────────────────────────────────────

companyRouter.get("/profile", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        industry: true,
        website: true,
        logoUrl: true,
        subscriptionPlan: true,
        maxSeats: true,
        createdAt: true,
        // AI Context
        description: true,
        coreProducts: true,
        targetAudience: true,
        usp: true,
        commonObjections: true,
        brandTone: true
      }
    });
    if (!company) throw new HttpError(401, "Sesi tidak valid. Perusahaan tidak ditemukan.");
    res.json({ data: company });
  } catch (err) { next(err); }
});

const updateContextSchema = z.object({
  industry: z.string().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  coreProducts: z.string().optional(),
  targetAudience: z.string().optional(),
  usp: z.string().optional(),
  commonObjections: z.string().optional(),
  brandTone: z.string().optional()
});

companyRouter.patch("/ai-context", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    // Only HR (company_admin) or super_admin should update this
    if (req.user?.role !== "company_admin" && req.user?.role !== "super_admin") {
      return res.status(403).json({ error: { message: "Only company admin can update AI context." } });
    }

    const body = updateContextSchema.parse(req.body);

    const updated = await prisma.company.update({
      where: { id: companyId },
      data: body
    });

    res.json({ data: updated });
  } catch (err) { next(err); }
});

companyRouter.get("/me", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: {
            users: { where: { isActive: true } },
            teams: { where: { isActive: true } }
          }
        }
      }
    });
    if (!company) throw new HttpError(401, "Sesi tidak valid. Perusahaan tidak ditemukan.");

    const usedSeats = await prisma.user.count({
      where: { companyId, role: "karyawan", isActive: true }
    });

    const totalSessions = await prisma.session.count({
      where: { user: { companyId } }
    });

    res.json({
      data: {
        ...company,
        usedSeats,
        totalSessions
      }
    });
  } catch (err) { next(err); }
});

// ─── TEAMS ────────────────────────────────────────────

const teamSchema = z.object({
  name: z.string().min(2, "Nama tim minimal 2 karakter."),
  description: z.string().optional(),
});

companyRouter.get("/org-tree", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const userRole = req.user?.role;
    const userId = req.user?.sub;
    if (userRole !== "manager" && !isCompanyAdmin(userRole || "")) throw new HttpError(403, "Akses daftar tim ditolak.");

    const allTeams = await prisma.team.findMany({
      where: { companyId, isActive: true },
      include: {
        leaders: { include: { user: { select: { id: true, name: true, email: true, role: true } } } },
        members: { where: { isActive: true }, select: { id: true, name: true, email: true, role: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const unassignedMembers = await prisma.user.findMany({
      where: { companyId, isActive: true, teamId: null, role: "karyawan" },
      select: { id: true, name: true, email: true, role: true }
    });

    let allowedTeams = allTeams;
    if (userRole === "manager") {
      const myTeams = await prisma.teamLeader.findMany({ where: { userId }, select: { teamId: true } });
      const myTeamIds = new Set(myTeams.map(team => team.teamId));
      allowedTeams = allTeams.filter(team => myTeamIds.has(team.id));
    }

    const companyData = await prisma.company.findUnique({ where: { id: companyId } });

    res.json({
      data: {
        companyName: companyData?.name || "My Company",
        teams: allowedTeams.map(t => ({
          id: t.id,
          name: t.name,
          managers: t.leaders.map(l => l.user),
          members: t.members
        })),
        unassignedMembers: userRole === "manager" ? [] : unassignedMembers
      }
    });
  } catch (err) { next(err); }
});

const orgAssignmentSchema = z.object({ userId: z.string().uuid(), teamId: z.string().uuid().nullable(), role: z.enum(["karyawan", "manager"]) });

companyRouter.patch("/org-tree/assign", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    const { userId, teamId, role } = orgAssignmentSchema.parse(req.body);
    const [targetUser, targetTeam] = await Promise.all([
      prisma.user.findFirst({ where: { id: userId, companyId, isActive: true } }),
      teamId ? prisma.team.findFirst({ where: { id: teamId, companyId, isActive: true } }) : Promise.resolve(null)
    ]);
    if (!targetUser) throw new HttpError(404, "Pengguna tidak ditemukan di perusahaan ini.");
    if (teamId && !targetTeam) throw new HttpError(404, "Tim tidak ditemukan di perusahaan ini.");
    if (role === "manager" && targetUser.role !== "manager") throw new HttpError(400, "Pengguna harus berperan manager.");
    if (role === "karyawan" && targetUser.role !== "karyawan") throw new HttpError(400, "Pengguna harus berperan karyawan.");

    if (req.user?.role === "manager") {
      // Manager can only assign to their own teams
      const managedTeams = await prisma.teamLeader.findMany({ where: { userId: req.user.sub }, select: { teamId: true } });
      const managedIds = managedTeams.map(team => team.teamId);
      if ((targetUser.teamId && !managedIds.includes(targetUser.teamId)) || (teamId && !managedIds.includes(teamId))) {
        throw new HttpError(403, "Anda tidak memiliki akses ke pengguna atau tim ini.");
      }
      // Manager cannot assign managers, only karyawans
      if (role === "manager") throw new HttpError(403, "Hanya admin yang dapat memindahkan manager.");
    } else if (req.user?.role !== "company_admin" && req.user?.role !== "super_admin") {
      throw new HttpError(403, "Akses ditolak.");
    }

    if (role === "karyawan") {
      await prisma.user.update({ where: { id: userId, companyId }, data: { teamId: teamId || null } });
    } else if (role === "manager") {
      if (teamId) {
        await prisma.teamLeader.upsert({
          where: { userId_teamId: { userId, teamId } },
          update: {}, create: { userId, teamId }
        });
      }
    }

    res.json({ message: "Berhasil di-assign" });
  } catch (err) { next(err); }
});

companyRouter.get("/teams", async (req, res, next) => {
  try {
    if (req.user?.role !== "manager" && !isCompanyAdmin(req.user?.role || "")) throw new HttpError(403, "Akses daftar tim ditolak.");
    const companyId = getCompanyId(req);
    let teamFilter: { id?: { in: string[] } } = {};
    if (req.user?.role === "manager") {
      const managedTeams = await prisma.teamLeader.findMany({ where: { userId: req.user.sub }, select: { teamId: true } });
      teamFilter = { id: { in: managedTeams.map(team => team.teamId) } };
    }
    const teams = await prisma.team.findMany({
      where: { companyId, ...teamFilter },
      include: {
        _count: { select: { members: { where: { isActive: true } } } },
        leaders: {
          include: { user: { select: { id: true, name: true, email: true } } }
        }
      },
      orderBy: { createdAt: "asc" }
    });
    res.json({ data: teams });
  } catch (err) { next(err); }
});

companyRouter.post("/teams", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const payload = teamSchema.parse(req.body);

    const team = await prisma.team.create({
      data: { companyId, name: payload.name, description: payload.description },
      include: { _count: { select: { members: { where: { isActive: true } } } }, leaders: true }
    });

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "team.create", targetType: "team", targetId: team.id, metadata: { name: team.name }, ipAddress: req.ip });

    res.status(201).json({ data: team });
  } catch (err) { next(err); }
});

companyRouter.get("/teams/:id", async (req, res, next) => {
  try {
    if (req.user?.role !== "manager" && !isCompanyAdmin(req.user?.role || "")) throw new HttpError(403, "Akses tim ditolak.");
    const companyId = getCompanyId(req);
    if (req.user?.role === "manager" && !await prisma.teamLeader.findFirst({ where: { userId: req.user.sub, teamId: req.params.id } })) throw new HttpError(403, "Anda tidak memiliki akses ke tim ini.");
    const team = await prisma.team.findFirst({
      where: { id: req.params.id, companyId },
      include: {
        members: { select: { id: true, name: true, email: true, role: true, isActive: true }, where: { isActive: true } },
        leaders: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { members: { where: { isActive: true } }, assignments: true } }
      }
    });
    if (!team) throw new HttpError(404, "Tim tidak ditemukan.");
    res.json({ data: team });
  } catch (err) { next(err); }
});

companyRouter.patch("/teams/:id", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const payload = teamSchema.partial().parse(req.body);

    const team = await prisma.team.updateMany({
      where: { id: req.params.id, companyId },
      data: payload
    });
    if (team.count === 0) throw new HttpError(404, "Tim tidak ditemukan.");

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "team.update", targetType: "team", targetId: req.params.id, metadata: payload, ipAddress: req.ip });

    res.json({ message: "Tim berhasil diperbarui." });
  } catch (err) { next(err); }
});

companyRouter.delete("/teams/:id", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);

    // Soft delete: set isActive = false
    const team = await prisma.team.updateMany({
      where: { id: req.params.id, companyId },
      data: { isActive: false }
    });
    if (team.count === 0) throw new HttpError(404, "Tim tidak ditemukan.");

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "team.delete", targetType: "team", targetId: req.params.id, ipAddress: req.ip });

    res.json({ message: "Tim berhasil dihapus." });
  } catch (err) { next(err); }
});

// ─── ASSIGN / UNASSIGN TEAM LEADER ───────────────────

companyRouter.post("/teams/:id/leaders", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const { userId } = z.object({ userId: z.string().uuid() }).parse(req.body);

    // Pastikan user milik company yang sama dan rolenya manager
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId, role: "manager", isActive: true }
    });
    if (!user) throw new HttpError(404, "Team leader tidak ditemukan di perusahaan ini.");

    // Pastikan tim milik company
    const team = await prisma.team.findFirst({ where: { id: req.params.id, companyId } });
    if (!team) throw new HttpError(404, "Tim tidak ditemukan.");

    const assignment = await prisma.teamLeader.upsert({
      where: { userId_teamId: { userId, teamId: req.params.id } },
      update: {},
      create: { userId, teamId: req.params.id }
    });

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "team.assign_leader", targetType: "team", targetId: req.params.id, metadata: { userId }, ipAddress: req.ip });

    res.status(201).json({ data: assignment, message: `${user.name} berhasil dijadikan leader tim ${team.name}.` });
  } catch (err) { next(err); }
});

companyRouter.delete("/teams/:teamId/leaders/:userId", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const { teamId, userId } = req.params;

    // Pastikan tim milik company
    const team = await prisma.team.findFirst({ where: { id: teamId, companyId } });
    if (!team) throw new HttpError(404, "Tim tidak ditemukan.");

    await prisma.teamLeader.deleteMany({ where: { userId, teamId } });

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "team.unassign_leader", targetType: "team", targetId: teamId, metadata: { userId }, ipAddress: req.ip });

    res.json({ message: "Leader berhasil dilepas dari tim." });
  } catch (err) { next(err); }
});

// ─── USERS ────────────────────────────────────────────

companyRouter.get("/users", async (req, res, next) => {
  try {
    const companyId = getCompanyId(req);
    if (req.user?.role !== "manager" && !isCompanyAdmin(req.user?.role || "")) throw new HttpError(403, "Akses daftar pengguna ditolak.");
    const { role, teamId, search } = req.query;
    const page = parsePage(req.query.page as string | undefined);
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new HttpError(400, "Limit harus antara 1 dan 100.");
    if (typeof search === "string" && search.length > 100) throw new HttpError(400, "Pencarian maksimal 100 karakter.");
    const skip = (page - 1) * limit;

    let scopedTeamIds: string[] | undefined;
    if (req.user?.role === "manager") {
      const managedTeams = await prisma.teamLeader.findMany({ where: { userId: req.user.sub }, select: { teamId: true } });
      scopedTeamIds = managedTeams.map(team => team.teamId);
      if (teamId && !scopedTeamIds.includes(teamId as string)) throw new HttpError(403, "Anda tidak memiliki akses ke tim ini.");
    }
    const whereClause = {
      companyId,
      ...(scopedTeamIds ? { teamId: { in: scopedTeamIds } } : {}),
      ...(role ? { role: role as any } : {}),
      ...(teamId ? { teamId: teamId as string } : {}),
      ...(search ? { OR: [
        { name: { contains: search as string, mode: "insensitive" as const } },
        { email: { contains: search as string, mode: "insensitive" as const } },
      ] } : {}),
    };

    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          createdAt: true, teamId: true,
          team: { select: { id: true, name: true } },
          ledTeams: { include: { team: { select: { id: true, name: true } } } }
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) { next(err); }
});

const singleUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["karyawan", "manager"]),
  teamId: z.string().uuid().optional().nullable(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

companyRouter.post("/users", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const payload = singleUserSchema.parse(req.body);

    const rawPassword = payload.password || generatePassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    // Cek seat limit untuk karyawan
    if (payload.role === "karyawan") {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { maxSeats: true } });
      const usedSeats = await prisma.user.count({ where: { companyId, role: "karyawan", isActive: true } });
      if (company && usedSeats >= company.maxSeats) {
        throw new HttpError(403, `Batas kursi (${company.maxSeats} seats) sudah penuh. Upgrade paket untuk menambah lebih banyak karyawan.`);
      }
    }

    const existing = await prisma.user.findUnique({ where: { email: payload.email } });
    if (existing) {
      if (existing.isActive) throw new HttpError(409, "Email sudah terdaftar dan masih aktif.");
    }

    const user = await prisma.user.upsert({
      where: { email: payload.email },
      update: {
        companyId,
        name: payload.name,
        passwordHash,
        role: payload.role,
        teamId: payload.teamId ?? null,
        isActive: true,
      },
      create: {
        companyId,
        name: payload.name,
        email: payload.email,
        passwordHash,
        role: payload.role,
        teamId: payload.teamId ?? null,
      },
      select: { id: true, name: true, email: true, role: true, teamId: true }
    });

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "user.create", targetType: "user", targetId: user.id, metadata: { role: user.role }, ipAddress: req.ip });

    res.status(201).json({
      data: user,
      generatedPassword: !payload.password ? rawPassword : undefined,
      message: "Akun berhasil dibuat."
    });
  } catch (err) { next(err); }
});

// ─── BULK CREATE KARYAWAN ─────────────────────────────

const bulkUserSchema = z.object({
  teamId: z.string().uuid().optional(),
  users: z.array(z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6).optional(),
  })).min(1).max(50, "Maksimal 50 akun sekaligus."),
});

companyRouter.post("/users/bulk", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const payload = bulkUserSchema.parse(req.body);

    // Cek seat limit
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { maxSeats: true, name: true } });
    const usedSeats = await prisma.user.count({ where: { companyId, role: "karyawan", isActive: true } });
    const remainingSeats = (company?.maxSeats ?? 10) - usedSeats;

    if (payload.users.length > remainingSeats) {
      throw new HttpError(403, `Hanya tersisa ${remainingSeats} slot kursi. Kurangi jumlah user atau upgrade paket.`);
    }

    // Cek email duplikat
    const emails = payload.users.map(u => u.email);
    const existing = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true, isActive: true }
    });
    
    const activeEmails = existing.filter(e => e.isActive).map(e => e.email);
    if (activeEmails.length > 0) {
      throw new HttpError(409, `Email berikut sudah terdaftar dan masih aktif: ${activeEmails.join(", ")}`);
    }

    // Generate akun
    const created: { name: string; email: string; password: string; role: string }[] = [];

    for (const u of payload.users) {
      const rawPassword = u.password || generatePassword();
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          companyId,
          teamId: payload.teamId ?? null,
          name: u.name,
          passwordHash,
          role: "karyawan",
          isActive: true
        },
        create: {
          companyId,
          teamId: payload.teamId ?? null,
          name: u.name,
          email: u.email,
          passwordHash,
          role: "karyawan",
        },
        select: { id: true, name: true, email: true, role: true }
      });

      created.push({ name: user.name, email: user.email, password: rawPassword, role: user.role });
    }

    logAudit({
      actorId: req.user!.sub, actorRole: req.user!.role, action: "user.bulk_create",
      metadata: { count: created.length, teamId: payload.teamId },
      ipAddress: req.ip
    });

    res.status(201).json({
      data: created,
      message: `${created.length} akun karyawan berhasil dibuat. Simpan kredensial ini karena password tidak akan ditampilkan lagi.`,
    });
  } catch (err) { next(err); }
});

// ─── EDIT / DEACTIVATE USER ──────────────────────────

companyRouter.patch("/users/:id", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const payload = singleUserSchema.partial().omit({ password: true }).parse(req.body);

    const user = await prisma.user.updateMany({
      where: { id: req.params.id, companyId },
      data: payload
    });
    if (user.count === 0) throw new HttpError(404, "User tidak ditemukan.");

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "user.update", targetType: "user", targetId: req.params.id, metadata: payload, ipAddress: req.ip });

    res.json({ message: "User berhasil diperbarui." });
  } catch (err) { next(err); }
});

companyRouter.delete("/users/:id", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);
    const targetId = req.params.id;

    if (targetId === req.user?.sub) throw new HttpError(403, "Tidak diperbolehkan menghapus akun sendiri.");

    const user = await prisma.user.updateMany({
      where: { id: targetId, companyId },
      data: { isActive: false }
    });
    if (user.count === 0) throw new HttpError(404, "User tidak ditemukan.");

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "user.deactivate", targetType: "user", targetId: req.params.id, ipAddress: req.ip });

    res.json({ message: "Akun user berhasil dinonaktifkan." });
  } catch (err) { next(err); }
});

companyRouter.post("/users/:id/reset-password", async (req, res, next) => {
  try {
    if (!guardCompanyAdmin(req, next)) return;
    const companyId = getCompanyId(req);

    const exists = await prisma.user.findFirst({ where: { id: req.params.id, companyId } });
    if (!exists) throw new HttpError(404, "User tidak ditemukan.");

    const manualPassword = req.body.newPassword as string;
    const newPassword = manualPassword && manualPassword.length >= 6 ? manualPassword : generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });

    logAudit({ actorId: req.user!.sub, actorRole: req.user!.role, action: "user.reset_password", targetType: "user", targetId: req.params.id, ipAddress: req.ip });

    res.json({
      data: { newPassword },
      message: "Password berhasil direset. Berikan password ini ke karyawan."
    });
  } catch (err) { next(err); }
});
