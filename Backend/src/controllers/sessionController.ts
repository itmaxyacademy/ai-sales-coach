/**
 * Session Controller - roleplay session untuk Sales Rep.
 * Start → Chat (multi turn) → Complete → dapat insight report.
 */
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../lib/http-error.js';
import { parsePage } from '../lib/http-query.js';
import { logAudit } from '../lib/audit.js';
import { checkAndUnlockBadges } from '../services/badgeService.js';
import { logger } from '../lib/logger.js';
import { generateRoleplayResponse } from '../services/roleplayService.js';
import { generateInsightReport, validateInsightEvidence, type InsightReport } from '../services/insightService.js';
import { generateFacialSummary } from '../services/facialService.js';
import { calculateStateUpdate } from '../services/stateService.js';
import { callGPTJson } from '../services/openaiClient.js';

// ─── TTS VOICE HELPER ────────────────────────────────
const MALE_VOICES = ['M1', 'M2', 'M3', 'M4', 'M5'];
const FEMALE_VOICES = ['F1', 'F2', 'F3'];

function inferGenderFromName(name: string, fallbackGender?: string): string {
  const femaleKeywords = ['siti', 'dewi', 'rina', 'ratna', 'siska', 'maya', 'lina', 'sari', 'ayu', 'tika', 'clara', 'nadia', 'putri', 'ibu', 'mbak', 'nita', 'diana', 'kartika', 'amelia', 'sinta', 'rahmawati'];
  const lower = (name || '').toLowerCase();
  if (femaleKeywords.some(k => lower.includes(k))) return 'F';
  const maleKeywords = ['budi', 'andi', 'tono', 'rudi', 'raka', 'hendra', 'fajar', 'dedi', 'joko', 'ivan', 'dimas', 'faisal', 'surya', 'daniel', 'pak', 'mas', 'bapak'];
  if (maleKeywords.some(k => lower.includes(k))) return 'M';
  return fallbackGender || 'M';
}

function pickTTSVoice(gender: string, courseId?: string, personaName?: string): string {
  const effectiveGender = inferGenderFromName(personaName || '', gender);
  const pool = effectiveGender === 'F' ? FEMALE_VOICES : MALE_VOICES;
  if (!courseId) {
    return pool[0];
  }
  
  // Hash courseId secara konsisten agar setiap course mendapatkan suara yang unik dan konstan
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    hash = courseId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % pool.length;
  return pool[index];
}

// ─── HINT COOLDOWN & FINALIZATION MAP ────────────────
const HINT_COOLDOWN_SECONDS = 60;
const FREE_HINT_LIMIT = 2;
const HINT_REQUEST_LEASE_MS = 2 * 60 * 1000;
const EMPTY_SESSION_ABANDON_MS = 30 * 60 * 1000;
const finalizingSessions = new Map<string, Promise<any>>();

function hintCooldownRemaining(hintCount: number, lastHintAt: Date | null | undefined): number {
  if (hintCount < FREE_HINT_LIMIT) return 0;
  if (!lastHintAt) return 0;
  const elapsed = Math.floor((Date.now() - lastHintAt.getTime()) / 1000);
  if (elapsed < HINT_COOLDOWN_SECONDS) return HINT_COOLDOWN_SECONDS - elapsed;
  return 0;
}

async function abandonEmptySession(sessionId: string, userId: string, startedBefore?: Date) {
  return prisma.$transaction(async (tx) => {
    const result = await tx.session.updateMany({
      where: {
        id: sessionId,
        userId,
        status: 'active',
        turnCount: 0,
        hasStarted: false,
        ...(startedBefore ? { startedAt: { lte: startedBefore } } : {}),
      },
      data: { status: 'abandoned', completedAt: new Date() },
    });
    if (!result.count) return false;

    await tx.trainingAssignment.updateMany({
      where: { sessionId, status: 'in_progress' },
      data: { sessionId: null, status: 'pending' },
    });
    return true;
  });
}

export async function sweepStuckSessions() {
  const now = new Date();
  const emptySessionCutoff = new Date(now.getTime() - EMPTY_SESSION_ABANDON_MS);
  let cursor: string | undefined;
  let handled = 0;

  while (true) {
    const batch = await prisma.session.findMany({
      where: {
        status: 'active',
        OR: [
          { customerStage: 'decided' },
          { turnCount: { gte: 5 } },
          { hasStarted: false, turnCount: 0, startedAt: { lte: emptySessionCutoff } },
        ],
      },
      include: { course: { select: { maxTurns: true } } },
      orderBy: { id: 'asc' },
      take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;

    for (const session of batch) {
      if (session.customerStage === 'decided' || session.turnCount >= session.course.maxTurns) {
        try {
          await finalizeSession(session.id, session.userId);
          handled++;
          logger.info({ sessionId: session.id }, '[sweepStuckSessions] Sesi stuck di-finalize');
        } catch (err) {
          logger.error({ err, sessionId: session.id }, '[sweepStuckSessions] Gagal finalize sesi stuck');
        }
      } else if (session.turnCount === 0 && session.startedAt <= emptySessionCutoff) {
        if (await abandonEmptySession(session.id, session.userId, emptySessionCutoff)) handled++;
      }
    }
  }

  return handled;
}

// ─── START SESSION ────────────────────────────────────

export const startSession: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const { courseId, assignmentId, maxTurns, isDrill } = z.object({
      courseId: z.string().uuid(),
      assignmentId: z.string().uuid().optional(),
      maxTurns: z.number().int().min(1).max(50).optional(),
      isDrill: z.boolean().optional(),
    }).parse(req.body);

    const course = await prisma.course.findFirst({
      where: { id: courseId, isActive: true },
      include: { rubric: true, company: true },
    });
    if (!course) throw new HttpError(404, 'Course tidak ditemukan.');

    const lastLangSession = await prisma.session.findFirst({
      where: { userId: req.user.sub, courseId },
      orderBy: { startedAt: 'desc' },
      select: { language: true },
    });
    const sessionLanguage = lastLangSession?.language || course.defaultLanguage || 'id';
    const effectiveMaxTurns = isDrill ? (maxTurns ?? 5) : (maxTurns ?? course.maxTurns);

    // Buat session
    const session = await prisma.$transaction(async (tx) => {
      const newSession = await tx.session.create({
        data: {
          userId: req.user!.sub,
          courseId,
          trustLevel: 2.5,
          customerStage: 'cold',
          mood: 'neutral',
          hasStarted: false,
          language: sessionLanguage,
          ttsVoice: pickTTSVoice(course.personaGender, courseId, course.personaName),
          feedbackReport: isDrill || maxTurns ? { isDrill: Boolean(isDrill), maxTurns: effectiveMaxTurns } : undefined,
        },
      });

      // Link ke assignment kalau ada
      if (assignmentId) {
        await tx.trainingAssignment.update({
          where: { id: assignmentId },
          data: {
            sessionId: newSession.id,
            status: 'in_progress',
          },
        });
      }

      return newSession;
    });

    // Sesi dimulai kosong, user (sales) yang harus menyapa pertama kali.
    // Tidak ada pesan awal dari AI.

    res.status(201).json({
      session: {
        id: session.id,
        courseId,
        status: 'active',
        maxTurns: effectiveMaxTurns,
        isDrill: Boolean(isDrill),
        ttsVoice: session.ttsVoice,
        language: session.language,
      },
      openingMessage: "",
      customerState: {
        trustLevel: 2.5,
        stage: 'cold',
        mood: 'neutral',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── CHAT (per turn) ─────────────────────────────────

export const chat: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const { sessionId, message, language } = z.object({
      sessionId: z.string().uuid(),
      message: z.string().min(1).max(1000),
      language: z.enum(['id', 'en']).optional().default('id'),
    }).parse(req.body);

    // Load session + course
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user.sub, status: 'active' },
      include: {
        course: { include: { rubric: true, company: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: { role: true, content: true },
        },
      },
    });

    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan atau sudah selesai.');

    // Cek max turns atau sudah decided
    if (session.turnCount >= session.course.maxTurns) {
      throw new HttpError(400, 'Sesi sudah mencapai batas maksimum turn. Silakan selesaikan sesi.');
    }
    if (session.customerStage === 'decided') {
      throw new HttpError(400, 'Customer sudah mengambil keputusan. Silakan selesaikan sesi.');
    }

    const currentState = {
      trustLevel: session.trustLevel,
      customerStage: session.customerStage,
      mood: session.mood,
      objectionCount: session.objectionCount,
      turnCount: session.turnCount,
    };

    const history = session.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // 1. Generate customer response + RAG stream.
    // Bisa throw HttpError(400) jika pesan mengandung konten berbahaya - sebelum SSE dibuka.
    const { customerResponseStream, ragContextUsed } = await generateRoleplayResponse({
      course: session.course,
      state: currentState,
      history,
      salesMessage: message,
      companyContext: (session.course as any).company,
      language,
    });

    // Setup SSE headers - hanya dibuka setelah generateRoleplayResponse sukses
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullCustomerResponse = '';

    try {
      // Stream the chunks to the client
      for await (const chunk of customerResponseStream) {
        fullCustomerResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    } catch (streamError) {
      // Error mid-stream: headers sudah sent, kirim error event via SSE lalu tutup.
      logger.error({ err: streamError }, '[chat] Error mid-SSE stream');
      res.write(`data: ${JSON.stringify({ error: 'Terjadi kesalahan saat memproses respons.' })}\n\n`);
      res.end();
      return;
    }

    // 2. Hitung state update based on the full text
    const stateUpdate = calculateStateUpdate(currentState, fullCustomerResponse);

    // 3. Simpan pesan + update session (dalam 1 transaction)
    const newTurnCount = session.turnCount + 1;

    await prisma.$transaction([
      // Simpan pesan sales rep
      prisma.message.create({
        data: {
          sessionId,
          userId: req.user!.sub,
          role: 'user',
          content: message,
        },
      }),
      // Simpan respons customer AI (coachingHint dihapus)
      prisma.message.create({
        data: {
          sessionId,
          userId: req.user!.sub,
          role: 'assistant',
          content: fullCustomerResponse,
          ragContext: ragContextUsed,
          trustDelta: stateUpdate.trustDelta,
        },
      }),
      // Update session state
      prisma.session.update({
        where: { id: sessionId },
        data: {
          trustLevel: stateUpdate.newTrust,
          customerStage: stateUpdate.newStage,
          mood: stateUpdate.newMood,
          objectionCount: stateUpdate.newObjCount,
          turnCount: newTurnCount,
          hasStarted: true,
          language,
        },
      }),
    ]);

    // 4. Cek apakah session harus auto-end
    const sessionMetaReport = session.feedbackReport as any;
    const effectiveChatMaxTurns = sessionMetaReport?.maxTurns ?? session.course.maxTurns;
    const isDecided = stateUpdate.newStage === 'decided';
    const isMaxTurn = newTurnCount >= effectiveChatMaxTurns;

    // 5. Send final state and end stream
    res.write(`data: ${JSON.stringify({
      state: {
        trustDelta: stateUpdate.trustDelta,
        customerState: {
          trustLevel: stateUpdate.newTrust,
          stage: stateUpdate.newStage,
          mood: stateUpdate.newMood,
          objectionCount: stateUpdate.newObjCount,
          turnCount: newTurnCount,
        },
        sessionMeta: {
          shouldEnd: isDecided || isMaxTurn,
          reason: isDecided ? 'customer_decided' : isMaxTurn ? 'max_turns_reached' : null,
          turnsRemaining: Math.max(0, effectiveChatMaxTurns - newTurnCount),
        }
      }
    })}\n\n`);

    res.end();

    // 6. Jika shouldEnd tercapai, jadwalkan auto-finalize di background agar session
    // tidak stuck 'active' jika user langsung menutup browser tanpa klik tombol selesai
    if (isDecided || isMaxTurn) {
      setTimeout(async () => {
        try {
          const s = await prisma.session.findUnique({
            where: { id: sessionId },
            select: { status: true },
          });
          if (s && s.status === 'active') {
            await finalizeSession(sessionId, req.user!.sub);
            logger.info({ sessionId }, '[chat] Sesi otomatis diselesaikan di background setelah shouldEnd');
          }
        } catch (err) {
          logger.error({ err, sessionId }, '[chat] Gagal auto-finalize sesi di background');
        }
      }, 4000);
    }
  } catch (error) {
    // Error sebelum SSE dibuka (mis: HttpError 400 dari sanitasi jailbreak, 404, dll).
    // next() bisa kirim respons HTTP normal karena headers belum sent.
    next(error);
  }
};

// ─── FINALIZE SESSION HELPER ──────────────────────────

export async function finalizeSession(
  sessionId: string,
  userId: string,
  options?: {
    facialAnalyses?: any[];
    durationSeconds?: number;
  }
) {
  if (finalizingSessions.has(sessionId)) {
    return finalizingSessions.get(sessionId)!;
  }

  const finalizePromise = (async () => {
    try {
      const session = await prisma.session.findFirst({
        where: {
          id: sessionId,
          userId,
        },
        include: {
          course: { include: { rubric: true } },
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });

      if (!session) return null;

      // Jika sesi sudah completed/abandoned, return hasil yang sudah ada
      if (session.status === 'completed' || session.status === 'abandoned') {
        return {
          session: {
            id: session.id,
            status: session.status,
            totalScore: session.totalScore,
            outcome: session.outcome,
          },
          insightReport: session.feedbackReport,
          facialSummary: session.facialSummary,
          newBadges: [],
        };
      }

      const finalState = {
        trustLevel: session.trustLevel,
        customerStage: session.customerStage,
        turnCount: session.turnCount,
        hintCount: session.hintCount,
      };

      const facialSummary = generateFacialSummary((options?.facialAnalyses as any) || []);

      const insightReport = await generateInsightReport({
        course: session.course,
        rubric: session.course.rubric,
        messages: session.messages,
        finalState,
        facialSummary,
        durationSeconds: options?.durationSeconds,
      });

      const isZeroTurn = session.turnCount === 0;

      // Preservasikan metadata isDrill jika sesi merupakan drill
      const prevMeta = session.feedbackReport as any;
      if (prevMeta?.isDrill) {
        (insightReport as any).isDrill = true;
        (insightReport as any).maxTurns = prevMeta.maxTurns ?? 5;
      }

      const completed = await prisma.session.update({
        where: { id: sessionId },
        data: {
          status: isZeroTurn ? 'abandoned' : 'completed',
          completedAt: new Date(),
          totalScore: isZeroTurn ? null : insightReport.totalScore,
          scoreBreakdown: isZeroTurn ? [] : (insightReport.categoryScores as any),
          feedbackReport: insightReport as any,
          facialSummary: facialSummary as any,
          outcome: isZeroTurn ? 'rejected' : insightReport.outcome,
        },
      });

      // 1.4 Bank Keberatan Otomatis dari Sesi Sukses (Auto-Crowdsourced Objection Bank)
      if (completed.totalScore && completed.totalScore >= 80 && session.messages.length >= 2) {
        try {
          for (let i = 1; i < session.messages.length; i++) {
            const currentMsg = session.messages[i];
            const prevMsg = session.messages[i - 1];
            if (
              currentMsg.role === 'user' &&
              prevMsg.role === 'assistant' &&
              (currentMsg.turnScore ?? 0) >= 85
            ) {
              const docContent = `[Keberatan Prospek]: ${prevMsg.content.trim()}\n\n[Respon Juara Sales (Skor ${currentMsg.turnScore})]: ${currentMsg.content.trim()}`;
              const exists = await prisma.courseDocument.findFirst({
                where: {
                  courseId: session.courseId,
                  category: 'battlecard',
                  content: { contains: currentMsg.content.trim().slice(0, 40) },
                },
              });
              if (!exists) {
                await prisma.courseDocument.create({
                  data: {
                    courseId: session.courseId,
                    category: 'battlecard',
                    content: docContent,
                    metadata: {
                      autoCrowdsourced: true,
                      sourceSessionId: sessionId,
                      turnScore: currentMsg.turnScore,
                      createdAt: new Date().toISOString(),
                    },
                  },
                });
              }
            }
          }
        } catch (crowdErr) {
          logger.warn({ err: crowdErr, sessionId }, '[finalizeSession] Gagal simpan objection bank');
        }
      }

      logAudit({
        actorId: userId,
        actorRole: 'karyawan',
        action: "session.complete",
        targetType: "session",
        targetId: completed.id,
        metadata: { score: completed.totalScore, outcome: completed.outcome },
      });

      await prisma.trainingAssignment.updateMany({
        where: { sessionId, userId },
        data: { status: 'completed', completedAt: new Date() },
      });

      const newBadges = await checkAndUnlockBadges(userId, {
        totalScore: insightReport.totalScore,
        outcome: insightReport.outcome,
        objectionCount: session.objectionCount,
      }).catch(err => {
        logger.error({ err }, "Failed to unlock badges");
        return [];
      });

      return {
        session: {
          id: completed.id,
          status: completed.status,
          totalScore: completed.totalScore,
          outcome: completed.outcome,
        },
        insightReport,
        facialSummary,
        newBadges,
      };
    } finally {
      finalizingSessions.delete(sessionId);
    }
  })();

  finalizingSessions.set(sessionId, finalizePromise);
  return finalizePromise;
}

// ─── COMPLETE SESSION ─────────────────────────────────

export const completeSession: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const { sessionId, facialAnalyses, durationSeconds } = z.object({
      sessionId: z.string().uuid(),
      durationSeconds: z.number().optional(),
      facialAnalyses: z.array(z.object({
        expression: z.string(),
        confidence: z.number(),
        eyeContact: z.boolean(),
        note: z.string(),
      })).optional().default([]),
    }).parse(req.body);

    const result = await finalizeSession(sessionId, req.user.sub, {
      facialAnalyses,
      durationSeconds,
    });

    if (!result) throw new HttpError(404, 'Sesi tidak ditemukan.');

    res.json(result);
  } catch (error) {
    next(error);
  }
};

// ─── GET SESSION RESULT ───────────────────────────────

export const getSessionResult: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const session = await prisma.session.findFirst({
      where: {
        id: req.params.sessionId as string,
        userId: req.user.sub,
      },
      include: {
        course: {
          select: {
            title: true,
            category: true,
            difficulty: true,
            personaGender: true,
            personaName: true,
            personaRole: true,
            personaBackground: true,
            personaPersonality: true,
            personaObjections: true,
            personaPainPoints: true,
            personaBuyingSignals: true,
            maxTurns: true,
            defaultLanguage: true,
          },
        },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan.');

    // Jika session masih active tapi sudah mencapai kondisi shouldEnd (mis. user reload/tutup browser saat shouldEnd),
    // otomatis selesaikan sesi di DB
    let currentSession = session;
    let feedbackReport = session.feedbackReport;
    let facialSummary = session.facialSummary;

    if (
      session.status === 'active' &&
      (session.turnCount >= (session.course?.maxTurns || 20) || session.customerStage === 'decided')
    ) {
      const finalized = await finalizeSession(session.id, req.user.sub);
      if (finalized?.session) {
        currentSession = {
          ...session,
          ...finalized.session,
          course: session.course,
          messages: session.messages,
        } as typeof session;
        feedbackReport = finalized.insightReport as any;
        facialSummary = finalized.facialSummary as any;
      }
    }

    const cooldownRemaining = hintCooldownRemaining(currentSession.hintCount, currentSession.lastHintAt);

    res.json({
      session: {
        id: currentSession.id,
        status: currentSession.status,
        course: currentSession.course,
        totalScore: currentSession.totalScore,
        outcome: currentSession.outcome,
        startedAt: currentSession.startedAt,
        completedAt: currentSession.completedAt,
        hasStarted: currentSession.hasStarted,
        turnCount: currentSession.turnCount,
        ttsVoice: currentSession.ttsVoice,
        language: currentSession.language,
        customerStage: currentSession.customerStage,
        mood: currentSession.mood,
        trustLevel: currentSession.trustLevel,
        hintCount: currentSession.hintCount,
        cooldownRemaining,
      },
      insightReport: validateInsightEvidence(feedbackReport as InsightReport, currentSession.messages),
      facialSummary,
      transcript: currentSession.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
        // coachingHint dihapus dari response transcript
        trustDelta: m.trustDelta,
        facialData: m.facialData,
        createdAt: m.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET SESSION HISTORY ──────────────────────────────

export const getSessionHistory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    await sweepStuckSessions().catch((err) => {
      logger.error({ err }, '[getSessionHistory] sweepStuckSessions gagal');
    });

    const page = parsePage(req.query.page as string | undefined);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    if (search.length > 100) throw new HttpError(400, 'Pencarian maksimal 100 karakter.');
    const period = typeof req.query.period === 'string' ? req.query.period : '30days';
    if (!['7days', '30days', '90days', 'alltime'].includes(period)) throw new HttpError(400, 'Periode tidak valid.');
    const days = period === '7days' ? 7 : period === '30days' ? 30 : period === '90days' ? 90 : null;
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;
    const where: any = {
      userId: req.user.sub,
      status: 'completed',
      turnCount: { gt: 0 },
      ...(since ? { completedAt: { gte: since } } : {}),
      ...(search ? { OR: [
        { course: { title: { contains: search, mode: 'insensitive' } } },
        { course: { category: { contains: search, mode: 'insensitive' } } }
      ] } : {})
    };
    const [sessions, total] = await Promise.all([prisma.session.findMany({
      where,
      include: {
        course: { select: { id: true, title: true, category: true, difficulty: true } },
      },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * 20,
      take: 20,
    }), prisma.session.count({ where })]);

    res.json({
      sessions: sessions.map(s => ({
        id: s.id,
        course: s.course,
        totalScore: s.totalScore,
        outcome: s.outcome,
        turnCount: s.turnCount,
        completedAt: s.completedAt,
        scoreBreakdown: s.scoreBreakdown,
      })),
      meta: { page, total, totalPages: Math.ceil(total / 20) },
    });
  } catch (error) {
    next(error);
  }
};

// ─── RETRY SESSION ────────────────────────────────────

export const retrySession: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const sessionId = req.params.sessionId as string;

    const oldSession = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.sub,
        status: 'completed',
      },
    });

    if (!oldSession) throw new HttpError(404, 'Sesi lama tidak ditemukan atau belum selesai.');

    const courseId = oldSession.courseId;

    const course = await prisma.course.findFirst({
      where: { id: courseId, isActive: true },
      include: { rubric: true, company: true },
    });
    if (!course) throw new HttpError(404, 'Course tidak ditemukan.');

    // Buat session baru
    const session = await prisma.session.create({
      data: {
        userId: req.user.sub,
        courseId,
        hasStarted: false,
        trustLevel: 2.5,
        customerStage: 'cold',
        mood: 'neutral',
        language: oldSession.language || course.defaultLanguage || 'id',
        ttsVoice: pickTTSVoice(course.personaGender, courseId, course.personaName),
      },
    });

    // Sesi dimulai kosong, user (sales) yang harus menyapa pertama kali.

    res.status(201).json({
      session: {
        id: session.id,
        courseId,
        status: 'active',
        maxTurns: course.maxTurns,
        ttsVoice: session.ttsVoice,
        language: session.language,
      },
      openingMessage: "",
      customerState: {
        trustLevel: 2.5,
        stage: 'cold',
        mood: 'neutral',
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── REQUEST HINT ─────────────────────────────────────

export const getHint: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const sessionId = req.params.sessionId as string;

    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        userId: req.user.sub,
        status: 'active',
      },
      include: {
        course: true,
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan atau sudah selesai.');

    // Cek apakah sesi sudah selesai atau mencapai limit turn
    if (session.turnCount >= session.course.maxTurns) {
      throw new HttpError(400, 'Sesi telah mencapai batas turn maksimal. Hint tidak tersedia.');
    }
    if (session.customerStage === 'decided') {
      throw new HttpError(400, 'Customer telah mengambil keputusan. Sesi telah selesai.');
    }

    const remaining = hintCooldownRemaining(session.hintCount, session.lastHintAt);
    if (remaining > 0) {
      throw new HttpError(429, `Cooldown aktif. Silakan tunggu ${remaining} detik sebelum meminta hint lagi.`);
    }

    const history = session.messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - HINT_COOLDOWN_SECONDS * 1000);
    const leaseCutoff = new Date(now.getTime() - HINT_REQUEST_LEASE_MS);
    const reservation = await prisma.session.updateMany({
      where: {
        id: sessionId,
        userId: req.user.sub,
        status: 'active',
        AND: [
          { OR: [
            { hintCount: { lt: FREE_HINT_LIMIT } },
            { lastHintAt: { lte: cooldownCutoff } },
            { lastHintAt: null },
          ] },
          { OR: [
            { hintRequestStartedAt: null },
            { hintRequestStartedAt: { lte: leaseCutoff } },
          ] },
        ],
      },
      data: { hintRequestStartedAt: now },
    });
    if (reservation.count === 0) {
      const latest = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hintCount: true, lastHintAt: true, hintRequestStartedAt: true },
      });
      const retryAfter = hintCooldownRemaining(latest?.hintCount ?? session.hintCount, latest?.lastHintAt);
      if (retryAfter > 0) {
        throw new HttpError(429, `Cooldown aktif. Silakan tunggu ${retryAfter} detik sebelum meminta hint lagi.`);
      }
      const pendingFor = latest?.hintRequestStartedAt
        ? Math.ceil((latest.hintRequestStartedAt.getTime() + HINT_REQUEST_LEASE_MS - Date.now()) / 1000)
        : 0;
      throw new HttpError(429, pendingFor > 0
        ? `Hint sedang dibuat. Coba lagi dalam ${pendingFor} detik.`
        : 'Sesi sudah berubah. Muat ulang sebelum meminta hint lagi.');
    }

    try {
      const { generateStrategicHint } = await import('../services/roleplayService.js');
      const hintMessage = await generateStrategicHint(session.course, history);
      const [updatedSession] = await prisma.session.updateManyAndReturn({
        where: { id: sessionId, userId: req.user.sub, status: 'active', hintRequestStartedAt: now },
        data: {
          hintCount: { increment: 1 },
          lastHintAt: now,
          hintRequestStartedAt: null,
        },
        select: { hintCount: true },
      });
      if (!updatedSession) throw new HttpError(409, 'Sesi berubah sebelum hint selesai dibuat.');

      res.json({
        hint: hintMessage,
        hintsUsed: updatedSession.hintCount,
        cooldownRemaining: updatedSession.hintCount >= FREE_HINT_LIMIT ? HINT_COOLDOWN_SECONDS : 0,
      });
    } catch (error) {
      await prisma.session.updateMany({
        where: { id: sessionId, userId: req.user.sub, hintRequestStartedAt: now },
        data: { hintRequestStartedAt: null },
      });
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// ─── UPDATE SESSION LANGUAGE ──────────────────────────

export const updateSessionLanguage: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const sessionId = req.params.sessionId as string;
    const { language } = z.object({ language: z.enum(['id', 'en']) }).parse(req.body);

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user.sub, status: 'active' },
      select: { id: true },
    });
    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan.');

    await prisma.session.update({
      where: { id: sessionId },
      data: { language },
    });

    res.json({ language, persisted: true });
  } catch (error) {
    next(error);
  }
};

export const beginSession: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const sessionId = req.params.sessionId as string;
    const now = new Date();
    await prisma.session.updateMany({
      where: { id: sessionId, userId: req.user.sub, status: 'active', hasStarted: false, turnCount: 0 },
      data: { hasStarted: true, startedAt: now },
    });
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user.sub, status: 'active' },
      select: { hasStarted: true, startedAt: true },
    });
    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan.');
    if (!session.hasStarted) throw new HttpError(409, 'Sesi sudah berubah. Muat ulang sebelum mulai.');
    res.json({ status: 'active', startedAt: session.startedAt });
  } catch (error) {
    next(error);
  }
};

export const abandonSession: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');

    const abandoned = await abandonEmptySession(req.params.sessionId as string, req.user.sub);
    if (!abandoned) throw new HttpError(409, 'Sesi sudah dimulai atau tidak lagi aktif.');
    res.json({ status: 'abandoned' });
  } catch (error) {
    next(error);
  }
};

// ─── 2.2 GENERATOR DRAF FOLLOW-UP (WHATSAPP & EMAIL) ──
export const generateFollowUpDraft: RequestHandler = async (req, res, next) => {
  try {
    if (!req.user) throw new HttpError(401, 'Login diperlukan.');
    const sessionId = req.params.sessionId as string;

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.user.sub },
      include: {
        course: { select: { title: true, productName: true, personaName: true, personaRole: true } },
        messages: { orderBy: { createdAt: 'asc' }, take: 20 },
      },
    });

    if (!session) throw new HttpError(404, 'Sesi tidak ditemukan.');

    const prospectName = session.course?.personaName || 'Bapak/Ibu';
    const productName = session.course?.productName || 'Solusi Kami';
    const outcome = session.outcome || 'follow_up';
    const isClosed = outcome === 'closed';

    let whatsappDraft = isClosed
      ? `Halo ${prospectName}, selamat siang! Terima kasih atas waktu dan diskusi positif terkait implementasi ${productName} hari ini. Senang sekali atas respon baik Bapak/Ibu. Sesuai kesepakatan, saya siapkan jadwal demo teknis minggu ini. Boleh info waktu luang terbaik Anda? Terima kasih! 🙏`
      : `Halo ${prospectName}, selamat siang! Terima kasih banyak atas waktu dan insight saat berdiskusi tentang ${productName} tadi. Saya sudah merangkum poin efisiensi dan alternatif solusi atas kendala yang sempat dibahas. Kapan kira-kira ada waktu 15 menit pekan ini untuk kita ulas proposal ringkasnya? Terima kasih! 🙏`;

    let emailSubject = isClosed
      ? `Konfirmasi Kesepakatan & Jadwal Next Step: Solusi ${productName} untuk ${prospectName}`
      : `Rangkuman Diskusi & Proposal Solusi ${productName} untuk ${prospectName}`;

    let emailBody = isClosed
      ? `Yth. ${prospectName},\n\nTerima kasih atas waktu dan diskusi produktif kita hari ini mengenai ${productName}.\n\nKami sangat senang dapat menyepakati langkah awal implementasi solusi ini untuk membantu meningkatkan performa dan efisiensi operasional tim Anda. Sesuai kesepakatan sesi tadi, kami sedang mempersiapkan materi demo teknis dan garis besar timeline onboarding.\n\nLangkah tindak lanjut yang kami usulkan:\n1. Sesi walkthrough teknis dan penyesuaian kebutuhan tim.\n2. Finalisasi proposal implementasi.\n\nMohon konfirmasi ketersediaan jadwal terbaik Anda melalui balasan email ini.\n\nSalam hangat,\nTim Konsultan ${productName}`
      : `Yth. ${prospectName},\n\nTerima kasih atas kesempatan berdiskusi mengenai implementasi ${productName} hari ini.\n\nKami memahami fokus utama Bapak/Ibu saat ini adalah memastikan efisiensi investasi dan kemudahan adopsi tim. Sebagai tindak lanjut, kami telah merangkum ringkasan solusi dan estimasi proyeksi efisiensi yang disesuaikan dengan kebutuhan Anda.\n\nApakah Bapak/Ibu berkenan meluangkan waktu 15-20 menit pada hari Kamis atau Jumat pekan ini untuk mendiskusikan opsi terbaik tersebut?\n\nTerima kasih dan semoga sukses selalu.\n\nHormat kami,\nTim Solusi ${productName}`;

    try {
      const transcriptExcerpt = session.messages
        .slice(-6)
        .map(m => `${m.role === 'user' ? 'Sales' : 'Prospek'}: ${m.content}`)
        .join('\n');

      if (transcriptExcerpt && process.env.OPENAI_API_KEY) {
        const aiPrompt = `Buat 1 draf WhatsApp dan 1 draf Email follow-up profesional bahasa Indonesia dari sales kepada prospek (${prospectName}) setelah simulasi sales produk ${productName}. Status sesi: ${outcome}.\nKutipan transkrip terakhir:\n${transcriptExcerpt}\nKembalikan JSON dengan format persis:\n{\n  "whatsappDraft": "string",\n  "emailSubject": "string",\n  "emailBody": "string"\n}`;
        const generated = await callGPTJson<any>([
          { role: 'system', content: 'Anda adalah sales coach ahli copywriting follow-up B2B/B2C Indonesia yang persuasif, sopan, dan konversi tinggi. Tanpa karakter em dash.' },
          { role: 'user', content: aiPrompt }
        ], { temperature: 0.4 });

        if (generated?.whatsappDraft) whatsappDraft = generated.whatsappDraft;
        if (generated?.emailSubject) emailSubject = generated.emailSubject;
        if (generated?.emailBody) emailBody = generated.emailBody;
      }
    } catch {
      // Menggunakan draf template yang sudah disiapkan
    }

    res.json({
      sessionId,
      prospectName,
      productName,
      outcome,
      whatsappDraft,
      emailSubject,
      emailBody,
    });
  } catch (error) {
    next(error);
  }
};
