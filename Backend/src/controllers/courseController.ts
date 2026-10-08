/**
 * Course Controller - CRUD course untuk Sales Manager.
 * Manager bisa buat course + rubrik, sistem otomatis index ke RAG.
 */
import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { logAudit } from '../lib/audit.js';
import {
  indexCourseDocument,
  deleteCourseDocuments,
} from '../services/ragService.js';
import { logger } from '../lib/logger.js';

// ─── VALIDATION SCHEMAS ───────────────────────────────

const rubricCategorySchema = z.object({
  name: z.string(),
  weight: z.number().min(1).max(100),
  criteria: z.array(z.object({
    label: z.string(),
    score: z.number(),
  })),
});

const createCourseSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']),
  category: z.string().min(2),

  // Persona
  personaName: z.string().min(2),
  personaRole: z.string().min(2),
  personaBackground: z.string().min(10),
  personaPainPoints: z.string().min(10),
  personaObjections: z.string().min(10),
  personaBuyingSignals: z.string().min(5),
  personaPersonality: z.string().min(10),
  personaGender: z.enum(['M', 'F']).default('M'),

  // Product
  productName: z.string().min(2),
  productDescription: z.string().min(10),
  productStrengths: z.string().min(10),
  competitorNotes: z.string().optional(),

  // Scenario
  scenarioContext: z.string().min(10),
  idealOutcome: z.string().min(5),

  // AI Config
  aiModelSize: z.enum(['1.2b', '3b', '7b', '20b']).default('7b'),
  aiTemperature: z.number().min(0).max(1).default(0.3),
  maxTurns: z.number().min(5).max(50).default(20),
  defaultLanguage: z.enum(['id', 'en']).default('id'),

  // Rubrik (opsional saat create, bisa set nanti)
  rubric: z.object({
    passingScore: z.number().min(0).max(100).default(70),
    categories: z.array(rubricCategorySchema).min(1),
  }).optional(),

  // Module & RAG Knowledge Document
  courseModule: z.string().optional(),
  brochureText: z.string().optional(),
});

const updateCourseSchema = createCourseSchema.partial();

// ─── HELPERS ──────────────────────────────────────────

function buildCourseModule(course: {
  title: string;
  productName: string;
  productDescription: string;
  productStrengths: string;
  personaName: string;
  personaRole: string;
  personaBackground: string;
  personaPainPoints: string;
  personaObjections: string;
  personaBuyingSignals: string;
  scenarioContext: string;
  idealOutcome: string;
}) {
  return [
    `# Persiapan Roleplay: ${course.title}`,
    `Materi ringkas ini disusun dari data course. Gunakan informasi produk yang tersedia dan jangan menjanjikan hal di luar materi.`,
    `## Produk`,
    `**${course.productName}** - ${course.productDescription}`,
    `Keunggulan: ${course.productStrengths}`,
    `## Calon pelanggan`,
    `**${course.personaName}, ${course.personaRole}.** ${course.personaBackground}`,
    `Kebutuhan utama: ${course.personaPainPoints}`,
    `Keberatan yang perlu disiapkan: ${course.personaObjections}`,
    `Sinyal minat: ${course.personaBuyingSignals}`,
    `## Alur latihan`,
    `Konteks: ${course.scenarioContext}`,
    `1. Buka percakapan dengan sopan dan bangun hubungan.`,
    `2. Gali kebutuhan dengan pertanyaan terbuka; konfirmasi masalah sebelum menawarkan solusi.`,
    `3. Hubungkan keunggulan produk dengan kebutuhan yang pelanggan sampaikan.`,
    `4. Tanggapi keberatan dengan empati dan bukti yang tersedia; jangan mengarang klaim.`,
    `5. Sepakati langkah berikutnya untuk mencapai: **${course.idealOutcome}**.`,
  ].join('\n\n');
}

async function indexCourseToRAG(courseId: string, data: z.infer<typeof createCourseSchema>) {
  // Hapus dokumen lama dulu
  await deleteCourseDocuments(courseId);

  // Index semua field course ke RAG
  const documents = [
    {
      category: 'product_knowledge',
      content: [
        `Produk: ${data.productName}`,
        `Deskripsi: ${data.productDescription}`,
        `Keunggulan: ${data.productStrengths}`,
        data.competitorNotes ? `Vs Kompetitor: ${data.competitorNotes}` : '',
      ].filter(Boolean).join('\n'),
    },
    {
      category: 'customer_persona',
      content: [
        `Nama: ${data.personaName}`,
        `Role: ${data.personaRole}`,
        `Latar belakang: ${data.personaBackground}`,
        `Pain point: ${data.personaPainPoints}`,
        `Buying signals: ${data.personaBuyingSignals}`,
      ].join('\n'),
    },
    {
      category: 'objection_guide',
      content: [
        `Keberatan umum customer: ${data.personaObjections}`,
        `Konteks skenario: ${data.scenarioContext}`,
        `Outcome ideal: ${data.idealOutcome}`,
      ].join('\n'),
    },
  ];

  if (data.courseModule) {
    documents.push({
      category: 'training_module_knowledge',
      content: `MODUL PEMBELAJARAN & MATERI SALES TRAINING:\n${data.courseModule}`,
    });
  }

  if (data.brochureText) {
    documents.push({
      category: 'brochure_document_rag',
      content: `DOKUMEN BROSUR / SPESIFIKASI PRODUK (RAG GROUNDING):\n${data.brochureText}`,
    });
  }

  // Ambil data Onboarding Perusahaan (AI Context)
  const courseRecord = await prisma.course.findUnique({
    where: { id: courseId },
    include: { company: true }
  });

  if (courseRecord?.company) {
    const c = courseRecord.company;
    documents.push({
      category: 'company_context',
      content: [
        `TENTANG PERUSAHAAN (Penting):`,
        `Deskripsi: ${c.description || '-'}`,
        `Produk Utama: ${c.coreProducts || '-'}`,
        `Target Audience: ${c.targetAudience || '-'}`,
        `Unique Selling Proposition (USP): ${c.usp || '-'}`,
        `Keberatan Paling Umum di Lapangan: ${c.commonObjections || '-'}`,
        `Tone/Brand Voice: ${c.brandTone || '-'}`,
      ].filter(Boolean).join('\n'),
    });
  }

  await Promise.all(
    documents.map(doc =>
      indexCourseDocument({
        courseId,
        category: doc.category,
        content: doc.content,
        metadata: { courseId },
      })
    )
  );
}

// ─── HANDLERS ─────────────────────────────────────────

// GET /api/courses - list semua course (rep: hanya assigned, manager: semua)
export const listCourses: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const whereClause: Prisma.CourseWhereInput = { isActive: true };

    if (req.user.role === 'company_admin') {
      whereClause.OR = [
        { companyId: req.user.companyId }
      ];
    } else if (req.user.role === 'manager') {
      whereClause.OR = [
        { companyId: null },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        { createdById: req.user.sub },
        { assignments: { some: { userId: req.user.sub } } }
      ];
    } else if (req.user.role === 'karyawan') {
      whereClause.OR = [
        { companyId: null },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        { assignments: { some: { userId: req.user.sub } } },
        {
          createdBy: {
            ledTeams: {
              some: {
                team: {
                  members: { some: { id: req.user.sub } }
                }
              }
            }
          }
        }
      ];
    }

    const courses = await prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        difficulty: true,
        category: true,
        personaName: true,
        personaGender: true,
        productName: true,
        aiModelSize: true,
        maxTurns: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        rubric: { select: { passingScore: true } },
        _count: { select: { sessions: true, assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ courses });
  } catch (error) {
    next(error);
  }
};

// GET /api/courses/:courseId - detail course
export const getCourse: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const whereClause: Prisma.CourseWhereInput = { id: req.params.courseId as string, isActive: true };

    if (req.user.role === 'company_admin') {
      whereClause.OR = [
        { companyId: req.user.companyId }
      ];
    } else if (req.user.role === 'manager') {
      whereClause.OR = [
        { companyId: null },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        { createdById: req.user.sub },
        { assignments: { some: { userId: req.user.sub } } }
      ];
    } else if (req.user.role === 'karyawan') {
      whereClause.OR = [
        { companyId: null },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        { assignments: { some: { userId: req.user.sub } } },
        {
          createdBy: {
            ledTeams: {
              some: {
                team: {
                  members: { some: { id: req.user.sub } }
                }
              }
            }
          }
        }
      ];
    }

    const course = await prisma.course.findFirst({
      where: whereClause,
      include: {
        rubric: true,
        createdBy: { select: { name: true, email: true } },
        _count: { select: { sessions: true, assignments: true } },
        documents: { where: { category: 'module' } },
      },
    });

    if (!course) throw new HttpError(404, 'Course tidak ditemukan.');

    const courseModule = course.documents?.find(d => d.category === 'module')?.content?.trim()
      || buildCourseModule(course);

    res.json({ 
      course: {
        ...course,
        courseModule,
      } 
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/courses - buat course baru (manager only)
export const createCourse: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const isManager = ['manager', 'company_admin', 'super_admin'].includes(req.user.role);
    if (!isManager) throw new HttpError(403, 'Hanya manager yang bisa membuat course.');

    const payload = createCourseSchema.parse(req.body);

    const course = await prisma.$transaction(async (tx) => {
      // Buat course
      const newCourse = await tx.course.create({
        data: {
          companyId: req.user!.companyId || null,
          createdById: req.user!.sub,
          title: payload.title,
          description: payload.description,
          difficulty: payload.difficulty,
          category: payload.category,
          personaName: payload.personaName,
          personaRole: payload.personaRole,
          personaBackground: payload.personaBackground,
          personaPainPoints: payload.personaPainPoints,
          personaObjections: payload.personaObjections,
          personaBuyingSignals: payload.personaBuyingSignals,
          personaPersonality: payload.personaPersonality,
          personaGender: payload.personaGender,
          productName: payload.productName,
          productDescription: payload.productDescription,
          productStrengths: payload.productStrengths,
          competitorNotes: payload.competitorNotes,
          scenarioContext: payload.scenarioContext,
          idealOutcome: payload.idealOutcome,
          aiModelSize: payload.aiModelSize,
          aiTemperature: payload.aiTemperature,
          maxTurns: payload.maxTurns,
          defaultLanguage: payload.defaultLanguage,
        },
      });

      // Buat rubrik kalau ada
      if (payload.rubric) {
        await tx.scoringRubric.create({
          data: {
            courseId: newCourse.id,
            passingScore: payload.rubric.passingScore,
            categories: payload.rubric.categories,
          },
        });
      }

      // Buat module document kalau ada
      if (payload.courseModule) {
        await tx.courseDocument.create({
          data: {
            courseId: newCourse.id,
            category: 'module',
            content: payload.courseModule,
          },
        });
      }

      return newCourse;
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "course.create",
      targetType: "course",
      targetId: course.id,
      metadata: { title: course.title },
      ipAddress: req.ip,
    });

    // Index ke RAG (async, tidak block response)
    indexCourseToRAG(course.id, payload).catch((err) => logger.error({ err }, "Failed to index course to RAG"));

    res.status(201).json({ course });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/courses/:courseId - update course (manager only)
export const updateCourse: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const isManager = ['manager', 'company_admin', 'super_admin'].includes(req.user.role);
    if (!isManager) throw new HttpError(403, 'Hanya manager yang bisa mengubah course.');

    const payload = updateCourseSchema.parse(req.body);

    const existing = await prisma.course.findFirst({
      where: { 
        id: req.params.courseId as string,
        ...(req.user.role !== 'super_admin' ? {
          OR: [
            ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
            { createdById: req.user.sub }
          ]
        } : {})
      },
    });
    if (!existing) throw new HttpError(404, 'Course tidak ditemukan.');

    const { rubric, courseModule, ...courseData } = payload;

    const course = await prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { id: req.params.courseId as string },
        data: courseData,
      });

      if (rubric) {
        await tx.scoringRubric.upsert({
          where: { courseId: updated.id },
          update: {
            passingScore: rubric.passingScore,
            categories: rubric.categories,
          },
          create: {
            courseId: updated.id,
            passingScore: rubric.passingScore,
            categories: rubric.categories,
          },
        });
      }

      if (courseModule !== undefined) {
        const existingDoc = await tx.courseDocument.findFirst({
          where: { courseId: updated.id, category: 'module' },
        });
        if (existingDoc) {
          await tx.courseDocument.update({
            where: { id: existingDoc.id },
            data: { content: courseModule },
          });
        } else if (courseModule) {
          await tx.courseDocument.create({
            data: {
              courseId: updated.id,
              category: 'module',
              content: courseModule,
            },
          });
        }
      }

      return updated;
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "course.update",
      targetType: "course",
      targetId: course.id,
      metadata: payload,
      ipAddress: req.ip,
    });

    // Re-index RAG
    const fullPayload = { ...existing, ...payload } as z.infer<typeof createCourseSchema>;
    indexCourseToRAG(course.id, fullPayload).catch((err) => logger.error({ err }, "Failed to re-index course to RAG"));

    res.json({ course });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/courses/:courseId - soft delete (manager only)
export const deleteCourse: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const isManager = ['manager', 'company_admin', 'super_admin'].includes(req.user.role);
    if (!isManager) throw new HttpError(403, 'Hanya manager yang bisa menghapus course.');

    const course = await prisma.course.findFirst({
      where: { 
        id: req.params.courseId as string,
        ...(req.user.role !== 'super_admin' ? {
          OR: [
            ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
            { createdById: req.user.sub }
          ]
        } : {})
      }
    });

    if (!course) throw new HttpError(404, 'Course tidak ditemukan atau bukan milik perusahaan Anda.');

    await prisma.course.update({
      where: { id: req.params.courseId as string },
      data: { isActive: false },
    });

    logAudit({
      actorId: req.user.sub,
      actorRole: req.user.role,
      action: "course.delete",
      targetType: "course",
      targetId: req.params.courseId as string,
      ipAddress: req.ip,
    });

    // Hapus dari RAG
    deleteCourseDocuments(req.params.courseId as string).catch((err) => logger.error({ err }, "Failed to delete course from RAG"));

    res.json({ message: 'Course berhasil dinonaktifkan.' });
  } catch (error) {
    next(error);
  }
};
