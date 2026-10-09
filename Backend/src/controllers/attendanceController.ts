import type { RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";

function jakartaDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function asDateOnly(date: string) {
  return new Date(`${date}T00:00:00.000Z`);
}

export const getTodayAttendance: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const date = jakartaDate();
    const [attendance] = await prisma.$queryRaw<AttendanceRecord[]>`SELECT check_in_at AS "checkInAt", check_out_at AS "checkOutAt" FROM attendances WHERE user_id = ${req.user.sub}::uuid AND work_date = ${asDateOnly(date)}::date`;
    res.json({ data: { date, attendance } });
  } catch (error) { next(error); }
};

export const checkIn: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const [attendance] = await prisma.$queryRaw<AttendanceRecord[]>`INSERT INTO attendances (user_id, work_date) VALUES (${req.user.sub}::uuid, ${asDateOnly(jakartaDate())}::date) ON CONFLICT (user_id, work_date) DO NOTHING RETURNING check_in_at AS "checkInAt", check_out_at AS "checkOutAt"`;
    if (!attendance) throw new HttpError(409, "Anda sudah check-in hari ini.");
    res.status(201).json({ data: attendance });
  } catch (error) {
    next(error);
  }
};

export const checkOut: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const [attendance] = await prisma.$queryRaw<AttendanceRecord[]>`UPDATE attendances SET check_out_at = NOW() WHERE user_id = ${req.user.sub}::uuid AND work_date = ${asDateOnly(jakartaDate())}::date AND check_out_at IS NULL RETURNING check_in_at AS "checkInAt", check_out_at AS "checkOutAt"`;
    if (!attendance) throw new HttpError(409, "Belum check-in hari ini atau Anda sudah check-out.");
    res.json({ data: attendance });
  } catch (error) { next(error); }
};

export const getTeamAttendance: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, "Login diperlukan.");
    const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(req.query.date ?? jakartaDate());
    if (!date.success || Number.isNaN(asDateOnly(date.data).getTime()) || asDateOnly(date.data).toISOString().slice(0, 10) !== date.data) {
      throw new HttpError(400, "Tanggal harus menggunakan format YYYY-MM-DD.");
    }
    const conditions = [Prisma.sql`u.role = 'karyawan' AND u.is_active = TRUE`];
    if (req.user.role !== "super_admin") conditions.push(Prisma.sql`u.company_id = ${req.user.companyId ?? "__no_company__"}::uuid`);
    if (req.user.role === "manager") {
      const teams = await prisma.teamLeader.findMany({ where: { userId: req.user.sub }, select: { teamId: true } });
      conditions.push(teams.length ? Prisma.sql`u.team_id IN (${Prisma.join(teams.map(team => Prisma.sql`${team.teamId}::uuid`))})` : Prisma.sql`FALSE`);
    }
    const members = await prisma.$queryRaw<{ id: string; name: string; teamName: string | null; checkInAt: Date | null; checkOutAt: Date | null }[]>`
      SELECT u.id, u.name, t.name AS "teamName", a.check_in_at AS "checkInAt", a.check_out_at AS "checkOutAt"
      FROM users u LEFT JOIN teams t ON t.id = u.team_id
      LEFT JOIN attendances a ON a.user_id = u.id AND a.work_date = ${asDateOnly(date.data)}::date
      WHERE ${Prisma.join(conditions, " AND ")} ORDER BY u.name ASC`;
    res.json({ data: members.map(({ checkInAt, checkOutAt, ...member }) => ({ ...member, team: member.teamName ? { name: member.teamName } : null, attendance: checkInAt ? { checkInAt, checkOutAt } : null })) });
  } catch (error) { next(error); }
};

type AttendanceRecord = { checkInAt: Date; checkOutAt: Date | null };
