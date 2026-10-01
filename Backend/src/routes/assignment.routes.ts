import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { logAudit } from "../lib/audit.js";
import { notifyNewAssignment, notifyDueDateReminder } from "../services/notificationService.js";

export const assignmentRouter = Router();

function serializeAssignment(
  assignment: any
) {
  return {
    id: assignment.id,
    userId: assignment.userId,
    note: assignment.note,
    status: assignment.status,
    dueAt: assignment.dueAt?.toISOString() ?? null,
    createdAt: assignment.createdAt.toISOString(),
    updatedAt: assignment.updatedAt.toISOString(),
    completedAt: assignment.completedAt?.toISOString() ?? null,
    course: assignment.course,
    assignedBy: assignment.assignedBy
  };
}

assignmentRouter.get("/", async (req, res, next) => {
  try {
    const isManagerOrAdmin = ["manager", "company_admin", "super_admin"].includes(req.user?.role ?? "");
    const whereClause: any = {};

    if (isManagerOrAdmin) {
      if (req.query.courseId) {
        whereClause.courseId = String(req.query.courseId);
      }
    } else {
      whereClause.userId = req.user?.sub;
    }

    const assignments = await prisma.trainingAssignment.findMany({
      where: whereClause,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            category: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }]
    });

    res.json({
      assignments: assignments.map(a => ({
        ...serializeAssignment(a),
        user: (a as any).assignedTo
      }))
    });
  } catch (error) {
    next(error);
  }
});

assignmentRouter.get("/:id", async (req, res, next) => {
  try {
    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id: req.params.id },
      include: {
        course: true,
        assignedBy: {
          select: { id: true, name: true, email: true, role: true }
        },
        session: true
      }
    });

    if (!assignment) throw new HttpError(404, "Assignment tidak ditemukan");
    if (req.user?.role === "karyawan" && assignment.userId !== req.user.sub) {
      throw new HttpError(403, "Tidak ada akses");
    }

    res.json({ data: assignment });
  } catch (error) {
    next(error);
  }
});

const bulkSchema = z.object({
  courseId: z.string().uuid(),
  userIds: z.array(z.string().uuid()),
  dueAt: z.string().datetime().nullable().optional(),
  note: z.string().nullable().optional()
});

assignmentRouter.post("/bulk", async (req, res, next) => {
  try {
    const allowed = ["manager", "company_admin", "super_admin"];
    if (!allowed.includes(req.user?.role ?? "")) {
      throw new HttpError(403, "Akses manager diperlukan.");
    }
    const payload = bulkSchema.parse(req.body);
    const course = await prisma.course.findUnique({ where: { id: payload.courseId } });
    if (!course) throw new HttpError(404, "Course tidak ditemukan");

    if (req.user?.role !== "super_admin" && req.user?.companyId) {
      if (course.companyId && course.companyId !== req.user.companyId) {
        throw new HttpError(403, "Course ini di luar perusahaan Anda.");
      }
      const validUsersCount = await prisma.user.count({
        where: {
          id: { in: payload.userIds },
          companyId: req.user.companyId,
          role: "karyawan",
        }
      });
      if (validUsersCount !== payload.userIds.length) {
        throw new HttpError(400, "Beberapa user tidak ditemukan di perusahaan Anda.");
      }
    }

    const assignments = await Promise.all(
      payload.userIds.map(async (userId) => {
        const existing = await prisma.trainingAssignment.findFirst({
          where: { courseId: payload.courseId, userId }
        });
        if (existing) return existing;
        return prisma.trainingAssignment.create({
          data: {
            courseId: payload.courseId,
            userId,
            assignedById: req.user!.sub,
            dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
            note: payload.note,
          }
        });
      })
    );

    logAudit({
      actorId: req.user!.sub,
      actorRole: req.user!.role,
      action: "assignment.bulk_create",
      targetType: "course",
      targetId: payload.courseId,
      metadata: { userIds: payload.userIds },
      ipAddress: req.ip,
    });

    for (const a of assignments) {
      await notifyNewAssignment(a.userId, course.title, a.id, a.dueAt);
    }

    res.json({ data: assignments });
  } catch (error) {
    next(error);
  }
});

assignmentRouter.post("/:id/remind", async (req, res, next) => {
  try {
    const allowed = ["manager", "company_admin", "super_admin"];
    if (!allowed.includes(req.user?.role ?? "")) {
      throw new HttpError(403, "Akses manager diperlukan.");
    }
    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id: req.params.id },
      include: { course: true }
    });
    if (!assignment) throw new HttpError(404, "Assignment tidak ditemukan");
    if (!assignment.dueAt) throw new HttpError(400, "Assignment tidak memiliki tenggat waktu");

    await notifyDueDateReminder(assignment.userId, assignment.course.title, assignment.id, assignment.dueAt);
    res.json({ success: true, message: "Notifikasi reminder terkirim" });
  } catch (error) {
    next(error);
  }
});

assignmentRouter.delete("/:id", async (req, res, next) => {
  try {
    const allowed = ["manager", "company_admin", "super_admin"];
    if (!allowed.includes(req.user?.role ?? "")) {
      throw new HttpError(403, "Akses manager diperlukan.");
    }
    const assignment = await prisma.trainingAssignment.findUnique({
      where: { id: req.params.id }
    });
    if (!assignment) throw new HttpError(404, "Assignment tidak ditemukan");

    await prisma.trainingAssignment.delete({
      where: { id: req.params.id }
    });

    logAudit({
      actorId: req.user!.sub,
      actorRole: req.user!.role,
      action: "assignment.delete",
      targetType: "assignment",
      targetId: req.params.id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: "Assignment berhasil dihapus (unassigned)." });
  } catch (error) {
    next(error);
  }
});
