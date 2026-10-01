/**
 * AI Insight & Feedback Service.
 * Evaluasi SELURUH sesi berdasarkan rubrik yang dibuat Sales Manager.
 * Dipanggil saat session di-complete.
 */
import { callGPTJson } from './openaiClient.js';
import { z } from 'zod';
import type { Course, ScoringRubric, Message } from '@prisma/client';

export type CategoryScore = {
  category: string;
  weight: number;
  score: number;       // 0-100
  comment: string;
  examples: string[];  // contoh kalimat dari transcript
};

export type CommunicationMetrics = {
  fillerWords: {
    total: number;
    breakdown: Record<string, number>;
    percentage: number; // percentage of total sales words
    rating: 'Clean' | 'Moderate' | 'Frequent';
    tips: string;
  };
  pacing: {
    averageWpm: number;
    rating: 'Optimal' | 'Fast' | 'Slow';
    label: string;
  };
  talkToListenRatio: {
    salesPercentage: number;
    prospectPercentage: number;
    salesWords: number;
    prospectWords: number;
    advice: string;
  };
};

export type TimelineMoment = {
  turn: number;
  salesSnippet: string;
  customerSnippet: string;
  trustLevel: number;
  trustDelta?: number;
  mood?: string;
  stage?: string;
  type: 'breakthrough' | 'friction' | 'objection' | 'neutral';
  badgeLabel: string;
  annotation: string;
  fillerCountInTurn: number;
};

export type InsightReport = {
  totalScore: number;
  outcome: 'closed' | 'follow_up' | 'rejected';
  narrative: string;
  categoryScores: CategoryScore[];
  keyMoments: Array<{
    turn: number;
    type: 'strength' | 'weakness';
    description: string;
    salesMessage: string;
  }>;
  recommendations: string[];
  microexpressionSalesInterpretation?: string;
  evaluationSource: 'ai' | 'fallback';
  communicationMetrics?: CommunicationMetrics;
  timelineMoments?: TimelineMoment[];
};

function formatTranscript(messages: Message[]): string {
  return messages
    .map((m, i) => `[Turn ${Math.floor(i / 2) + 1}] ${m.role === 'user' ? 'Sales' : 'Customer'}: ${m.content}`)
    .join('\n');
}

export function validateInsightEvidence(report: InsightReport, messages: Pick<Message, 'role' | 'content'>[]) {
  if (!report || typeof report !== 'object') return report;
  const salesTurns = messages.flatMap((message, index) => message.role === 'user'
    ? [{ turn: Math.floor(index / 2) + 1, content: message.content }]
    : []);
  const normalize = (value: unknown) => typeof value === 'string'
    ? value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
    : '';
  const matches = (quote: unknown, content: string) => {
    const normalizedQuote = normalize(quote);
    return normalizedQuote.length >= 8
      && normalizedQuote.split(/\s+/).length >= 2
      && normalize(content).includes(normalizedQuote);
  };

  return {
    ...report,
    categoryScores: Array.isArray(report.categoryScores)
      ? report.categoryScores.map(category => ({
          ...category,
          examples: Array.isArray(category.examples)
            ? category.examples.filter((example: unknown) => salesTurns.some(turn => matches(example, turn.content))).slice(0, 2)
            : []
        }))
      : [],
    keyMoments: Array.isArray(report.keyMoments)
      ? report.keyMoments.filter(moment => Number.isInteger(moment.turn)
          && salesTurns.some(turn => turn.turn === moment.turn && matches(moment.salesMessage, turn.content)))
      : []
  };
}

function formatRubric(rubric: ScoringRubric): string {
  const categories = rubric.categories as any[] | null | undefined;
  if (!Array.isArray(categories) || categories.length === 0) {
    return `Default rubrik:\n- Opening (20%)\n- Discovery (30%)\n- Objection Handling (30%)\n- Closing (20%)`;
  }
  return categories
    .map(cat =>
      `${cat.name} (bobot ${cat.weight}%):\n` +
      (Array.isArray(cat.criteria)
        ? cat.criteria.map((c: any) => `  - ${c.label}: ${c.score > 0 ? '+' : ''}${c.score} poin`).join('\n')
        : '  (no criteria)')
    )
    .join('\n\n');
}

const INDO_FILLER_WORDS = [
  // Hesitation sounds & vocalized pauses
  'um', 'umm', 'uh', 'uhh', 'eh', 'ehh', 'em', 'emm', 'er', 'err', 'hmm', 'anu',
  
  // Crutch phrases & filler questions
  'apa namanya', 'apa ya', 'gimana ya', 'gimana gitu',
  
  // Discourse markers & filler hedges
  'sebenarnya', 'sebetulnya', 'pada dasarnya', 'pada intinya',
  'bisa dibilang', 'ibaratnya', 'istilahnya', 'katakanlah',
  'maksud saya', 'maksudnya', 'kurang lebih', 'pokoknya',
  
  // Common colloquial Indonesian fillers
  'kayak', 'kayaknya', 'keknya', 'kek',
  'gini', 'gitu', 'ya gitu', 'jadi gini', 'gini lho', 'gitu lho',
  'ya kan', 'tahu kan', 'ngerti kan'
];

const ENG_FILLER_WORDS = [
  // Hesitation sounds
  'um', 'umm', 'uh', 'uhh', 'er', 'err', 'hmm',
  
  // Bilingual / Corporate sales crutch words
  'like', 'literally', 'basically', 'actually', 'honestly',
  'you know', 'i mean', 'sort of', 'kind of',
  'so yeah', 'right', 'okay so', 'well',
  'to be honest', 'at the end of the day'
];

// ponytail: deduplicated and sorted by length descending so phrases match before individual words
const ALL_FILLER_WORDS = Array.from(new Set([...INDO_FILLER_WORDS, ...ENG_FILLER_WORDS]))
  .sort((a, b) => b.length - a.length);

export function analyzeCommunicationMetrics(messages: Message[], durationSeconds?: number): CommunicationMetrics {
  const salesMessages = messages.filter(m => m.role === 'user');
  const customerMessages = messages.filter(m => m.role === 'assistant');

  let salesWords = 0;
  let prospectWords = 0;
  const fillerBreakdown: Record<string, number> = {};
  let totalFillers = 0;

  salesMessages.forEach(msg => {
    const text = msg.content.toLowerCase();
    const words = text.match(/\b[\w'-]+\b/g) || [];
    salesWords += words.length;

    ALL_FILLER_WORDS.forEach(filler => {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        fillerBreakdown[filler] = (fillerBreakdown[filler] || 0) + matches.length;
        totalFillers += matches.length;
      }
    });
  });

  customerMessages.forEach(msg => {
    const words = msg.content.toLowerCase().match(/\b[\w'-]+\b/g) || [];
    prospectWords += words.length;
  });

  const totalWords = salesWords + prospectWords || 1;
  const salesPercentage = Math.round((salesWords / totalWords) * 100);
  const prospectPercentage = 100 - salesPercentage;

  let ratioAdvice = "Keseimbangan percakapan sudah sangat baik (ideal: 40-55% Sales).";
  if (salesPercentage > 65) {
    ratioAdvice = "Kamu terlalu banyak mendominasi percakapan (>65%). Kurangi pitching panjang dan ajukan lebih banyak pertanyaan terbuka (discovery questions).";
  } else if (salesPercentage < 35 && salesMessages.length > 0) {
    ratioAdvice = "Kamu terlalu pasif (<35%). Tuntun percakapan lebih aktif dengan memberikan value proposition dan arahan komitmen.";
  }

  const fillerPercentage = salesWords > 0 ? Number(((totalFillers / salesWords) * 100).toFixed(1)) : 0;
  let fillerRating: 'Clean' | 'Moderate' | 'Frequent' = 'Clean';
  let fillerTips = "Sangat baik! Gaya bicaramu bersih dan lugas tanpa banyak kata jeda.";

  if (fillerPercentage > 5.0) {
    fillerRating = 'Frequent';
    const topFillers = Object.entries(fillerBreakdown).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`"${k}" (${v}x)`).join(', ');
    fillerTips = `Terdeteksi ${totalFillers} kata pengisi (${topFillers || 'um/eh'}). Latih jeda hening (pause) 1-2 detik daripada menggunakan kata pengisi.`;
  } else if (fillerPercentage >= 2.0) {
    fillerRating = 'Moderate';
    fillerTips = `Tingkat kata pengisi masih wajar (${fillerPercentage}%), tapi bisa lebih dipoles dengan menarik napas sebelum menjawab.`;
  }

  const estimatedMinutes = (durationSeconds && durationSeconds > 10)
    ? durationSeconds / 60
    : Math.max(1, (salesMessages.length * 20) / 60);
  const averageWpm = Math.round(salesWords / estimatedMinutes);
  let pacingRating: 'Optimal' | 'Fast' | 'Slow' = 'Optimal';
  let pacingLabel = 'Tempo bicara optimal (120 - 150 WPM). Artikulasi terdengar jelas dan percaya diri.';

  if (averageWpm > 165) {
    pacingRating = 'Fast';
    pacingLabel = 'Tempo bicara agak terlalu cepat (>160 WPM). Beri jeda agar prospek mencerna informasi penting.';
  } else if (averageWpm < 105 && salesWords > 30) {
    pacingRating = 'Slow';
    pacingLabel = 'Tempo bicara sedikit lambat (<110 WPM). Tingkatkan dinamika suara agar prospek tetap engaged.';
  }

  return {
    fillerWords: {
      total: totalFillers,
      breakdown: fillerBreakdown,
      percentage: fillerPercentage,
      rating: fillerRating,
      tips: fillerTips,
    },
    pacing: {
      averageWpm: averageWpm || 135,
      rating: pacingRating,
      label: pacingLabel,
    },
    talkToListenRatio: {
      salesPercentage,
      prospectPercentage,
      salesWords,
      prospectWords,
      advice: ratioAdvice,
    },
  };
}

export function buildTimelineMoments(messages: Message[]): TimelineMoment[] {
  const turns: TimelineMoment[] = [];

  let currentTrust = 2.5;

  for (let i = 0; i < messages.length; i += 2) {
    const userMsg = messages[i];
    const assistantMsg = messages[i + 1];
    if (!userMsg) break;

    const turnIndex = Math.floor(i / 2) + 1;
    const trustDelta = assistantMsg?.trustDelta ?? 0;
    currentTrust = Math.max(1, Math.min(5, currentTrust + trustDelta));

    let fillersInTurn = 0;
    const textLower = userMsg.content.toLowerCase();
    ALL_FILLER_WORDS.forEach(f => {
      const matches = textLower.match(new RegExp(`\\b${f}\\b`, 'gi'));
      if (matches) fillersInTurn += matches.length;
    });

    let type: 'breakthrough' | 'friction' | 'objection' | 'neutral' = 'neutral';
    let badgeLabel = 'Standard Turn';
    let annotation = 'Percakapan berjalan stabil.';

    if (trustDelta >= 0.4) {
      type = 'breakthrough';
      badgeLabel = 'Breakthrough Moment';
      annotation = 'Penyampaian value sangat meyakinkan, kepercayaan customer melonjak positif.';
    } else if (trustDelta <= -0.3) {
      type = 'friction';
      badgeLabel = 'Friction / Doubt';
      annotation = 'Customer merasa ragu atau tidak puas dengan respons yang diberikan.';
    } else if (assistantMsg?.content?.toLowerCase()?.includes('mahal') || assistantMsg?.content?.toLowerCase()?.includes('ragu') || assistantMsg?.content?.toLowerCase()?.includes('kompetitor') || assistantMsg?.content?.toLowerCase()?.includes('budget')) {
      type = 'objection';
      badgeLabel = 'Objection Point';
      annotation = 'Customer melontarkan penolakan / keraguan terkait harga, fitur, atau risiko.';
    }

    turns.push({
      turn: turnIndex,
      salesSnippet: userMsg.content.slice(0, 120) + (userMsg.content.length > 120 ? '...' : ''),
      customerSnippet: assistantMsg ? assistantMsg.content.slice(0, 120) + (assistantMsg.content.length > 120 ? '...' : '') : '(No response)',
      trustLevel: Number(currentTrust.toFixed(1)),
      trustDelta,
      type,
      badgeLabel,
      annotation,
      fillerCountInTurn: fillersInTurn,
    });
  }

  return turns;
}

export async function generateInsightReport({
  course,
  rubric,
  messages,
  finalState,
  facialSummary,
  durationSeconds,
}: {
  course: Course;
  rubric: ScoringRubric | null;
  messages: Message[];
  finalState: {
    trustLevel: number;
    customerStage: string;
    turnCount: number;
    hintCount?: number;
  };
  facialSummary?: any;
  durationSeconds?: number;
}): Promise<InsightReport> {
  const commMetrics = analyzeCommunicationMetrics(messages, durationSeconds);
  const timelineMoments = buildTimelineMoments(messages);

  if (messages.length < 2) {
    return fallbackInsight(messages, finalState);
  }

  const transcript = formatTranscript(messages);
  const rubricCategories = rubric?.categories as any[] | null | undefined;
  const hasValidRubric = rubric && Array.isArray(rubricCategories) && rubricCategories.length > 0;

  const rubricText = hasValidRubric
    ? formatRubric(rubric)
    : `Default rubrik:\n- Opening (20%)\n- Discovery (30%)\n- Objection Handling (30%)\n- Closing (20%)`;

  const categories = hasValidRubric
    ? rubricCategories!.map(c => c.name)
    : ['Opening', 'Discovery', 'Objection Handling', 'Closing'];

  const facialContext = facialSummary ? `
DATA MIKROEKSPRESI (ANALISIS WAJAH SALES SELAMA SESI):
- Emosi Dominan: ${facialSummary.dominantExpression || 'Tidak diketahui'}
- Kontak Mata: ${facialSummary.eyeContactRate || 0}%
- Tingkat Kepercayaan Diri: ${facialSummary.averageConfidence || 0}%
` : '';

  const prompt = `
Kamu adalah sales evaluator senior di industri ${course.category}.

KOURSE: ${course.title}
PRODUK: ${course.productName}
PERSONA CUSTOMER: ${course.personaName} - ${course.personaBackground}
OUTCOME IDEAL: ${course.idealOutcome}

RUBRIK PENILAIAN:
${rubricText}

HASIL AKHIR SESI:
- Trust level akhir: ${finalState.trustLevel.toFixed(1)}/5
- Stage terakhir: ${finalState.customerStage}
- Total turn: ${finalState.turnCount}
${facialContext}

DATA KOMUNIKASI & SPEECH:
- Rasio Bicara Sales vs Prospek: ${commMetrics.talkToListenRatio.salesPercentage}% : ${commMetrics.talkToListenRatio.prospectPercentage}%
- Kata Pengisi (Filler Words): ${commMetrics.fillerWords.total} kata (${commMetrics.fillerWords.percentage}%)
- Tempo Bicara (WPM): ${commMetrics.pacing.averageWpm} WPM (${commMetrics.pacing.rating})

TRANSCRIPT LENGKAP:
${transcript}

Evaluasi transcript di atas berdasarkan rubrik.
Tentukan outcome: "closed" (deal tercapai), "follow_up" (ada kemajuan tapi belum deal), atau "rejected" (gagal total).

Balas HANYA JSON:
{
  "totalScore": <0-100>,
  "outcome": "closed|follow_up|rejected",
  "narrative": "narasi evaluasi 2-3 kalimat, jujur dan konstruktif",
  "microexpressionSalesInterpretation": "Tuliskan 2-3 kalimat yang sangat tajam dan spesifik mengaitkan Data Mikroekspresi (emosi dominan, kontak mata, kepercayaan diri) dengan apa yang terjadi di Transcript (misal: 'Saat kamu merespons objection soal harga di Turn 3, kontak matamu turun drastis yang membuat customer makin ragu'). Jika tidak ada data mikroekspresi, beri pesan singkat bahwa kamera tidak aktif.",
  "categoryScores": [
    ${categories.map(cat => `{
      "category": "${cat}",
      "weight": <bobot persen>,
      "score": <0-100>,
      "comment": "feedback spesifik 1-2 kalimat",
      "examples": ["contoh kalimat dari transcript yang relevan"]
    }`).join(',\n    ')}
  ],
  "keyMoments": [
    {
      "turn": <nomor turn>,
      "type": "strength|weakness",
      "description": "apa yang terjadi",
      "salesMessage": "kalimat sales yang dimaksud"
    }
  ],
  "recommendations": [
    "rekomendasi konkret untuk latihan berikutnya"
  ]
}`;

  try {
    const result = await callGPTJson<Omit<InsightReport, 'evaluationSource'>>(
      [
        { role: 'system', content: 'Kamu sales evaluator. Balas HANYA JSON.' },
        { role: 'user', content: prompt },
      ],
      {
        model: 'gpt-4o-mini', temperature: 0.2,
        schema: z.object({
          totalScore: z.number().min(0).max(100),
          outcome: z.enum(['closed', 'follow_up', 'rejected']),
          narrative: z.string(),
          categoryScores: z.array(z.object({ category: z.string(), weight: z.number(), score: z.number().min(0).max(100), comment: z.string(), examples: z.array(z.string()) })),
          keyMoments: z.array(z.object({ turn: z.number().int().nonnegative(), type: z.enum(['strength', 'weakness']), description: z.string(), salesMessage: z.string() })),
          recommendations: z.array(z.string()),
          microexpressionSalesInterpretation: z.string().optional(),
        }),
      }
    );

    let finalScore = result.totalScore;
    if (finalState.hintCount && finalState.hintCount > 2) {
      const penalty = (finalState.hintCount - 2) * 5;
      finalScore = Math.max(0, finalScore - penalty);
      result.narrative += ` (Penalti skor -${penalty} karena menggunakan ${finalState.hintCount} bantuan).`;
    }

    return validateInsightEvidence({
      ...result,
      totalScore: finalScore,
      evaluationSource: 'ai',
      communicationMetrics: commMetrics,
      timelineMoments,
    }, messages) as InsightReport;
  } catch {
    return fallbackInsight(messages, finalState);
  }
}

function fallbackInsight(
  messages: Message[],
  state: { trustLevel: number; customerStage: string; turnCount: number; hintCount?: number }
): InsightReport {
  let score = Math.min(100, Math.round(
    (state.trustLevel / 5) * 60 + (state.turnCount * 2)
  ));

  if (state.hintCount && state.hintCount > 2) {
    score = Math.max(0, score - ((state.hintCount - 2) * 5));
  }

  const commMetrics = analyzeCommunicationMetrics(messages);
  const timelineMoments = buildTimelineMoments(messages);

  return {
    totalScore: score,
    outcome: state.trustLevel >= 4 ? 'closed'
      : state.trustLevel >= 3 ? 'follow_up' : 'rejected',
    narrative: 'Evaluasi otomatis berdasarkan progress sesi. Jalankan sesi lebih panjang untuk evaluasi AI yang akurat.',
    categoryScores: [
      { category: 'Opening', weight: 20, score, comment: 'Berdasarkan analisis sesi.', examples: [] },
      { category: 'Discovery', weight: 30, score, comment: 'Berdasarkan analisis sesi.', examples: [] },
      { category: 'Objection Handling', weight: 30, score, comment: 'Berdasarkan analisis sesi.', examples: [] },
      { category: 'Closing', weight: 20, score, comment: 'Berdasarkan analisis sesi.', examples: [] },
    ],
    keyMoments: [],
    recommendations: ['Lanjutkan latihan untuk mendapatkan feedback AI yang lebih detail.'],
    evaluationSource: 'fallback',
    communicationMetrics: commMetrics,
    timelineMoments,
  };
}
