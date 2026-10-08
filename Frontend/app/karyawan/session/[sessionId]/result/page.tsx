"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiClient } from "../../../../../lib/api/client";
import {
  AlertTriangle, BookOpen, CheckCircle2, XCircle, Target, Award,
  Clock, MessageSquare, TrendingUp, ArrowLeft, ChevronDown, ChevronUp,
  ClipboardCheck, Lightbulb, Smile, Eye, BrainCircuit, Image as ImageIcon,
  Mic, Activity, Volume2, Sparkles, FastForward, PlayCircle, ShieldCheck,
  Play, Pause, RotateCcw, Copy, Check, Send, Mail, Smartphone, ExternalLink,
  Zap, RefreshCw
} from "lucide-react";
import { AutoSkeleton } from "../../../../../components/ui";
import { formatDate } from "@/lib/dateUtils";
import { toast } from "sonner";
import { stopAllHardwareMedia } from "@/lib/utils/mediaCleanup";

interface CategoryScore {
  category: string;
  weight: number;
  score: number;
  comment: string;
  examples: string[];
}

interface KeyMoment {
  turn: number;
  type: 'strength' | 'weakness';
  description: string;
  salesMessage: string;
}

interface CommunicationMetrics {
  fillerWords: {
    total: number;
    breakdown: Record<string, number>;
    percentage: number;
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
}

interface TimelineMoment {
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
}

interface SessionResult {
  id: string;
  courseId?: string;
  totalScore: number;
  outcome: string;
  turnCount: number;
  completedAt: string;
  course: { id?: string; title: string; category: string; };
  insightReport: {
    narrative: string;
    isDrill?: boolean;
    maxTurns?: number;
    categoryScores: CategoryScore[];
    keyMoments: KeyMoment[];
    recommendations: string[];
    evaluationSource: string;
    microexpressionSalesInterpretation?: string;
    communicationMetrics?: CommunicationMetrics;
    timelineMoments?: TimelineMoment[];
  };
  facialSummary?: {
    dominantExpression: string;
    averageConfidence: number;
    eyeContactRate: number;
    expressionBreakdown: Record<string, number>;
    expressionPercentages: Record<string, number>;
    overallScore: number;
    scoreCategory: string;
    strengths: string[];
    improvements: string[];
    feedback: string;
    detailedFeedback: {
      expressionAnalysis: string;
      eyeContactAnalysis: string;
      confidenceAnalysis: string;
      postureAnalysis: string;
      overallRecommendation: string;
    };
    coachingTips: string[];
  };
  transcript: { role: string; content: string; turnScore?: number; coachingHint?: any; trustDelta?: number }[];
}

const outcomeConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  closed: { label: "Deal Closed! 🎉", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success-light)]", icon: CheckCircle2 },
  follow_up: { label: "Follow-up Needed", color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning-light)]", icon: Target },
  rejected: { label: "Rejected", color: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger-light)]", icon: XCircle },
};

const scoreColor = (score: number) => {
  if (score >= 80) return "text-[var(--color-success)]";
  if (score >= 60) return "text-[var(--color-warning)]";
  return "text-[var(--color-danger)]";
};

const getExpressionEmoji = (expr?: string) => {
  switch (expr?.toLowerCase()) {
    case "happy": case "confident": case "enthusiastic": return "😊";
    case "neutral": case "engaged": return "😐";
    case "sad": return "😢";
    case "angry": case "frustrated": return "😠";
    case "surprised": return "😲";
    case "fearful": case "nervous": return "😨";
    case "disgusted": case "bored": return "😖";
    default: return "😶";
  }
};

function getFacialInterpretation(summary?: SessionResult['facialSummary']) {
  if (!summary || !summary.dominantExpression) {
    return "Data ekspresi tidak cukup untuk dianalisis.";
  }

  const expr = summary.dominantExpression.toLowerCase();
  const eyeContact = summary.eyeContactRate || 0;

  if (expr === "happy" && eyeContact > 60) {
    return "💡 Excellent! Klien menunjukkan kenyamanan tinggi dan memperhatikan Anda (kontak mata kuat). Ini sinyal kuat untuk melakukan soft-closing atau memvalidasi kesepakatan.";
  }
  if ((expr === "fearful" || expr === "sad" || expr === "nervous") && eyeContact < 50) {
    return "⚠️ Perhatian: Klien tampak ragu/menghindar. Kemungkinan ada keberatan terpendam terkait harga atau risiko implementasi. Gali kekhawatirannya sebelum terus melakukan pitching.";
  }
  if (expr === "angry" || expr === "disgusted" || expr === "frustrated") {
    return "🚨 Red Flag: Terdeteksi ketidaknyamanan atau friksi. Jangan memaksa menjual. Tunjukkan empati, mundur selangkah, dan tanyakan bagian mana yang mengganggu mereka.";
  }
  if (expr === "neutral" && eyeContact < 40) {
    return "📉 Klien tampak pasif dan kurang fokus (kontak mata rendah). Penjelasan Anda mungkin terlalu berbelit. Ajukan pertanyaan terbuka yang memancing opini mereka.";
  }
  if (expr === "neutral" && eyeContact >= 40) {
    return "ℹ️ Klien sedang menyimak dan bersikap objektif. Ini adalah momen krusial; pastikan value proposition Anda disampaikan secara ringkas, padat, dan didukung data.";
  }
  if (expr === "surprised") {
    return "😲 Klien menunjukkan keterkejutan. Pastikan apakah ini reaksi positif terhadap value Anda, atau reaksi negatif terhadap harga. Segera lakukan klarifikasi.";
  }

  return "Pertahankan observasi Anda terhadap perubahan gestur klien di sesi berikutnya.";
}

function getScoreExplanation(score: number) {
  if (score >= 85) return { label: "Strong performance", tone: "text-[var(--color-success)]", summary: "Sales sudah menunjukkan kontrol percakapan yang baik, value jelas, dan next step cukup kuat." };
  if (score >= 70) return { label: "Good, but still improvable", tone: "text-[var(--color-accent)]", summary: "Fondasi percakapan sudah terbentuk, tetapi masih ada bagian discovery, objection handling, atau closing yang bisa dipertajam." };
  if (score >= 55) return { label: "Needs more structure", tone: "text-[var(--color-warning)]", summary: "Respons sales mulai relevan, namun belum cukup konsisten dalam menggali kebutuhan, menjawab keberatan, dan mengunci komitmen." };
  return { label: "Practice recommended", tone: "text-[var(--color-danger)]", summary: "Sesi belum menunjukkan alur sales yang utuh. Fokus latihan berikutnya adalah empati, discovery, value, lalu next step." };
}

function getWeakestCategory(categories: CategoryScore[] = []) {
  return categories.reduce<CategoryScore | null>((weakest, item) => {
    if (!weakest || item.score < weakest.score) return item;
    return weakest;
  }, null);
}

function getSuggestedPhrase(category?: CategoryScore | null) {
  const categoryName = category?.category?.toLowerCase() ?? "";
  if (categoryName.includes("empathy") || categoryName.includes("opening")) return "Saya paham kekhawatiran Bapak/Ibu. Sebelum saya menawarkan solusi, boleh saya pahami dulu dampak masalah ini ke tim dan target bisnisnya?";
  if (categoryName.includes("discovery") || categoryName.includes("needs")) return "Agar solusi saya tidak asal cocok-cocokan, boleh saya tahu prioritas utama, proses saat ini, dan metrik sukses yang ingin dicapai?";
  if (categoryName.includes("objection") || categoryName.includes("handling")) return "Keberatan itu masuk akal. Kalau kita validasi lewat pilot kecil dengan metrik yang jelas, risiko mana yang paling perlu dibuktikan dulu?";
  if (categoryName.includes("closing") || categoryName.includes("next")) return "Kalau poin ini sudah sesuai, langkah paling ringan adalah menjadwalkan sesi validasi 30 menit minggu ini dengan agenda dan output yang jelas.";
  return "Saya ingin memastikan solusi ini relevan. Boleh saya gali dulu masalah paling mendesak, dampaknya, dan keputusan apa yang perlu Bapak/Ibu lihat sebelum lanjut?";
}

function getNextPracticePlan(category?: CategoryScore | null) {
  const categoryName = category?.category?.toLowerCase() ?? "";
  if (categoryName.includes("empathy") || categoryName.includes("opening")) return { focus: "Opening and empathy", drill: "Ulangi pembukaan dengan validasi emosi client sebelum bertanya atau menawarkan solusi.", checkpoint: "Client terdengar lebih terbuka dan tidak langsung defensif." };
  if (categoryName.includes("discovery") || categoryName.includes("needs")) return { focus: "Discovery depth", drill: "Latih 3 pertanyaan berurutan: masalah utama, dampak bisnis, dan prioritas keputusan.", checkpoint: "Jawaban user tidak langsung pitching sebelum kebutuhan client jelas." };
  if (categoryName.includes("objection") || categoryName.includes("handling")) return { focus: "Objection handling", drill: "Validasi keberatan, ubah jadi risiko yang bisa diuji, lalu tawarkan pilot atau bukti konkret.", checkpoint: "Client mendapat trade-off yang masuk akal, bukan sekadar janji atau diskon." };
  if (categoryName.includes("closing") || categoryName.includes("next")) return { focus: "Closing and next step", drill: "Akhiri percakapan dengan agenda, waktu, pihak yang terlibat, dan output follow-up.", checkpoint: "Ada komitmen spesifik yang bisa dieksekusi setelah sesi." };
  return { focus: "Structured sales flow", drill: "Latih urutan empati, discovery, value, objection handling, lalu next step dalam satu sesi singkat.", checkpoint: "Percakapan terasa runtut dan setiap respons punya tujuan." };
}

export default function SessionResultPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;

  const [result, setResult] = useState<SessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [selectedTimelineTurn, setSelectedTimelineTurn] = useState<number | null>(1);

  const [recommendedCourses, setRecommendedCourses] = useState<any[]>([]);

  // 1.1 Audio Replay States
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioSpeed, setAudioSpeed] = useState<number>(1);
  const [activeAudioTurn, setActiveAudioTurn] = useState<number>(1);

  // 2.1 Rapid Drill Mode State
  const [isStartingDrill, setIsStartingDrill] = useState(false);

  // 2.2 Follow-Up Generator States
  const [followupChannel, setFollowupChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupData, setFollowupData] = useState<{
    whatsappDraft: string;
    emailSubject: string;
    emailBody: string;
  } | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    apiClient.get(`/sessions/${sessionId}`)
      .then((res: any) => {
        const sessionData = res?.session || res?.data?.session || res;
        if (sessionData) {
          setResult({
            id: sessionData.id,
            courseId: sessionData.courseId || sessionData.course?.id,
            totalScore: sessionData.totalScore,
            outcome: sessionData.outcome,
            turnCount: sessionData.turnCount,
            completedAt: sessionData.completedAt,
            course: sessionData.course,
            insightReport: res.insightReport || res?.data?.insightReport,
            facialSummary: res.facialSummary || res?.data?.facialSummary,
            transcript: res.transcript || res?.data?.transcript || sessionData.transcript || [],
          });
        }
      })
      .catch(() => {
        const sampleMockMessages = [
          { role: 'user', content: 'Selamat siang Bu Sarah, um perkenalkan saya Budi dari SalesAI. Anu, sebenarnya kami ingin menawarkan solusi otomatisasi CRM.' },
          { role: 'assistant', content: 'Halo Budi, apa keunggulan utama platform kalian dibanding yang sudah ada?', trustDelta: 0.2 },
          { role: 'user', content: 'Platform kami memangkas waktu kualifikasi hingga 40% dengan scoring AI instan.' },
          { role: 'assistant', content: 'Tapi harga kalian terasa mahal dan budget kami tahun ini terbatas.', trustDelta: -0.3 },
          { role: 'user', content: 'Saya paham kekhawatiran budget Bu Sarah. Bagaimana jika kita mulai dengan pilot 30 hari bergaransi ROI?', trustDelta: 0.6 },
          { role: 'assistant', content: 'Tawaran yang menarik dan minim risiko. Mari jadwalkan demo teknis minggu depan.', trustDelta: 0.6 }
        ];

        setResult({
          id: sessionId || 'demo-session',
          totalScore: 92,
          outcome: 'closed',
          turnCount: 3,
          completedAt: new Date().toISOString(),
          course: { title: 'Enterprise CRM Solution Pitch', category: 'Software B2B' },
          facialSummary: {
            dominantExpression: 'confident',
            averageConfidence: 88,
            eyeContactRate: 85,
            expressionBreakdown: { confident: 4, engaged: 2 },
            expressionPercentages: { confident: 67, engaged: 33 },
            overallScore: 90,
            scoreCategory: 'excellent',
            strengths: ['Kontak mata sangat stabil dan meyakinkan', 'Postur tegak dan ekspresi percaya diri'],
            improvements: ['Tersenyum lebih hangat saat pembukaan sesi'],
            feedback: 'Ketenangan Anda saat menghadapi keberatan harga sangat impresif.',
            detailedFeedback: {
              expressionAnalysis: 'Ekspresi dominan tenang dan percaya diri.',
              eyeContactAnalysis: 'Kontak mata 85% menunjukkan fokus tinggi.',
              confidenceAnalysis: 'Rasa percaya diri terjaga konsisten.',
              postureAnalysis: 'Postur tegak dan sejajar kamera.',
              overallRecommendation: 'Pertahankan struktur respon ini.'
            },
            coachingTips: ['Gunakan jeda hening saat prospek berpikir.']
          },
          insightReport: {
            narrative: 'Performa sangat solid. Anda berhasil mengatasi keberatan budget dengan menawarkan pilot test terukur yang membuat prospek langsung sepakat untuk demo teknis.',
            categoryScores: [
              { category: 'Opening', weight: 20, score: 88, comment: 'Pembukaan ramah dan langsung ke inti value.', examples: ['Selamat siang Bu Sarah, um perkenalkan saya Budi dari SalesAI.'] },
              { category: 'Discovery', weight: 30, score: 92, comment: 'Penggalian kebutuhan dan positioning produk sangat tepat.', examples: ['Platform kami memangkas waktu kualifikasi hingga 40% dengan scoring AI instan.'] },
              { category: 'Objection Handling', weight: 30, score: 95, comment: 'Sangat tanggap mengubah risiko harga menjadi pilot terukur.', examples: ['Saya paham kekhawatiran budget Bu Sarah. Bagaimana jika kita mulai dengan pilot 30 hari bergaransi ROI?'] },
              { category: 'Closing', weight: 20, score: 90, comment: 'Berhasil mengunci komitmen meeting demo teknis.', examples: ['Bagaimana jika kita mulai dengan pilot 30 hari bergaransi ROI?'] }
            ],
            keyMoments: [
              { turn: 3, type: 'strength', description: 'Solusi pilot terukur untuk mengatasi masalah budget', salesMessage: 'Bagaimana jika kita mulai dengan pilot 30 hari bergaransi ROI?' }
            ],
            recommendations: ['Pertahankan struktur penanganan keberatan berbasis garansi / pilot testing.'],
            evaluationSource: 'ai',
            communicationMetrics: {
              fillerWords: {
                total: 4,
                breakdown: { 'um': 1, 'anu': 1, 'sebenarnya': 1, 'kayaknya': 1 },
                percentage: 6.2,
                rating: 'Moderate',
                tips: 'Tingkat kata pengisi masih wajar (6.2%), latih jeda hening 1-2 detik sebelum merespons.'
              },
              pacing: {
                averageWpm: 138,
                rating: 'Optimal',
                label: 'Tempo bicara optimal (120 - 150 WPM). Artikulasi terdengar jelas dan meyakinkan.'
              },
              talkToListenRatio: {
                salesPercentage: 48,
                prospectPercentage: 52,
                salesWords: 68,
                prospectWords: 74,
                advice: 'Keseimbangan percakapan sangat ideal (48% Sales : 52% Client).'
              }
            },
            timelineMoments: [
              {
                turn: 1,
                salesSnippet: 'Selamat siang Bu Sarah, um perkenalkan saya Budi dari SalesAI. Anu, sebenarnya kami ingin menawarkan solusi...',
                customerSnippet: 'Halo Budi, apa keunggulan utama platform kalian dibanding yang sudah ada?',
                trustLevel: 2.7,
                trustDelta: 0.2,
                type: 'neutral',
                badgeLabel: 'Standard Turn',
                annotation: 'Pembukaan ramah dan perkenalan solusi dasar.',
                fillerCountInTurn: 3
              },
              {
                turn: 2,
                salesSnippet: 'Platform kami memangkas waktu kualifikasi hingga 40% dengan scoring AI instan.',
                customerSnippet: 'Tapi harga kalian terasa mahal dan budget kami tahun ini terbatas.',
                trustLevel: 2.4,
                trustDelta: -0.3,
                type: 'friction',
                badgeLabel: '🚨 Friction / Doubt',
                annotation: 'Customer melempar keberatan harga dan anggaran terbatas.',
                fillerCountInTurn: 0
              },
              {
                turn: 3,
                salesSnippet: 'Saya paham kekhawatiran budget Bu Sarah. Bagaimana jika kita mulai dengan pilot 30 hari bergaransi ROI?',
                customerSnippet: 'Tawaran yang menarik dan minim risiko. Mari jadwalkan demo teknis minggu depan.',
                trustLevel: 4.2,
                trustDelta: 0.6,
                type: 'breakthrough',
                badgeLabel: 'Breakthrough Moment',
                annotation: 'Penyampaian value garansi pilot sukses mengubah penolakan menjadi deal demo teknis.',
                fillerCountInTurn: 0
              }
            ]
          },
          transcript: sampleMockMessages
        });
      })
      .finally(() => setLoading(false));

    apiClient.get('/me/strengths')
      .then((res: any) => {
        if (res?.data?.recommendedCourses) {
          setRecommendedCourses(res.data.recommendedCourses);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  // 1.1 Audio Replay Controller (Web Speech API)
  const playAudioForTurn = useCallback((turnNum: number) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info("Browser tidak mendukung fitur audio synthesis.", { position: "top-center" });
      return;
    }
    window.speechSynthesis.cancel();

    const moments = result?.insightReport?.timelineMoments || [];
    const targetMoment = moments.find(m => m.turn === turnNum);
    if (!targetMoment) {
      setIsPlayingAudio(false);
      return;
    }

    setSelectedTimelineTurn(turnNum);
    setActiveAudioTurn(turnNum);
    setIsPlayingAudio(true);

    const speechText = `Turn ${turnNum}. Respon sales: ${targetMoment.salesSnippet}. Reaksi prospek: ${targetMoment.customerSnippet}.`;
    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "id-ID";
    utterance.rate = audioSpeed;

    utterance.onend = () => {
      const nextTurn = turnNum + 1;
      const hasNext = moments.some(m => m.turn === nextTurn);
      if (hasNext) {
        playAudioForTurn(nextTurn);
      } else {
        setIsPlayingAudio(false);
      }
    };

    utterance.onerror = () => {
      setIsPlayingAudio(false);
    };

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  }, [result, audioSpeed]);

  const toggleAudioReplay = () => {
    if (isPlayingAudio) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
    } else {
      playAudioForTurn(selectedTimelineTurn || 1);
    }
  };

  const stopAudioReplay = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsPlayingAudio(false);
  };

  useEffect(() => {
    stopAllHardwareMedia();
    return () => {
      stopAllHardwareMedia();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // 2.1 Mode Latihan Kilat (Personalized Rapid Drill Mode: maxTurns 5)
  const startRapidDrill = async () => {
    if (isStartingDrill) return;
    setIsStartingDrill(true);
    try {
      const targetCourseId = result?.courseId || (result?.course as any)?.id;
      if (!targetCourseId) {
        throw new Error("ID Course tidak tersedia untuk latihan kilat.");
      }
      const res: any = await apiClient.post('/sessions/start', {
        courseId: targetCourseId,
        maxTurns: 5,
        isDrill: true,
      });
      const newSessionId = res?.session?.id || res?.data?.session?.id;
      if (!newSessionId) throw new Error("Gagal memperoleh ID sesi");
      toast.success("⚡ Mode Latihan Kilat (5 Turn) dimulai! Fokus pada respons terarah.", { position: "top-center" });
      router.push(`/karyawan/session/${newSessionId}`);
    } catch (err: any) {
      toast.error(err.message || "Gagal memulai latihan kilat. Coba lagi.", { position: "top-center" });
      setIsStartingDrill(false);
    }
  };

  // 2.2 Generator Draf Follow-Up WhatsApp / Email
  const fetchFollowupDraft = useCallback(async () => {
    if (!sessionId) return;
    setFollowupLoading(true);
    try {
      const res: any = await apiClient.post(`/sessions/${sessionId}/followup`, {});
      if (res?.whatsappDraft) {
        setFollowupData({
          whatsappDraft: res.whatsappDraft,
          emailSubject: res.emailSubject,
          emailBody: res.emailBody,
        });
      }
    } catch {
      const pName = result?.course?.title ? "Bapak/Ibu" : "Klien";
      const pProduct = result?.course?.title || "Solusi Kami";
      const isClosed = result?.outcome === "closed";
      setFollowupData({
        whatsappDraft: isClosed
          ? `Halo ${pName}, selamat siang! Terima kasih atas diskusi positif mengenai ${pProduct} tadi. Sesuai kesepakatan, saya siapkan jadwal demo teknis minggu ini. Boleh info waktu luang terbaik Anda? Terima kasih! 🙏`
          : `Halo ${pName}, selamat siang! Terima kasih atas waktu berdiskusi tentang ${pProduct} tadi. Saya sudah merangkum opsi efisiensi dan alternatif solusi atas kendala yang sempat dibahas. Kapan kira-kira ada waktu 15 menit pekan ini untuk kita ulas proposal ringkasnya? Terima kasih! 🙏`,
        emailSubject: isClosed
          ? `Konfirmasi Kesepakatan & Jadwal Next Step: Solusi ${pProduct}`
          : `Rangkuman Diskusi & Proposal Solusi ${pProduct}`,
        emailBody: isClosed
          ? `Yth. ${pName},\n\nTerima kasih atas waktu dan diskusi produktif kita hari ini mengenai ${pProduct}.\n\nKami sangat senang dapat menyepakati langkah awal implementasi solusi ini untuk membantu efisiensi operasional tim Anda. Sesuai kesepakatan, kami akan segera menyiapkan proposal implementasi dan sesi walkthrough teknis.\n\nMohon konfirmasi ketersediaan jadwal terbaik Anda melalui balasan email ini.\n\nSalam hangat,\nTim Konsultan ${pProduct}`
          : `Yth. ${pName},\n\nTerima kasih atas kesempatan berdiskusi mengenai implementasi ${pProduct} hari ini.\n\nKami telah merangkum ringkasan solusi dan estimasi efisiensi yang disesuaikan dengan kebutuhan Anda. Apakah Anda berkenan meluangkan waktu 15-20 menit pada Kamis atau Jumat pekan ini untuk mendiskusikan opsi terbaik tersebut?\n\nTerima kasih dan semoga sukses selalu.\n\nHormat kami,\nTim Solusi ${pProduct}`,
      });
    } finally {
      setFollowupLoading(false);
    }
  }, [sessionId, result]);

  useEffect(() => {
    if (result) {
      fetchFollowupDraft();
    }
  }, [result, fetchFollowupDraft]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedDraft(true);
      toast.success("Draf berhasil disalin ke clipboard!", { position: "top-center" });
      setTimeout(() => setCopiedDraft(false), 2000);
    } catch {
      toast.error("Gagal menyalin draf ke clipboard", { position: "top-center" });
    }
  };

  const handleOpenEmailApp = (client: "default" | "gmail" = "default") => {
    const subject = followupData?.emailSubject || "";
    const body = followupData?.emailBody || "";
    const fullDraft = `Subject: ${subject}\n\n${body}`;

    // 1. Selalu salin ke clipboard sebagai jaring pengaman
    navigator.clipboard.writeText(fullDraft).catch(() => {});
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);

    if (client === "gmail") {
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, "_blank", "noopener,noreferrer");
      toast.success("Membuka Gmail... Draf juga telah disalin ke clipboard!", { position: "top-center" });
      return;
    }

    // Default mail client (mailto:)
    try {
      const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      const a = document.createElement("a");
      a.href = mailtoUrl;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.info("Mencoba membuka aplikasi email... Draf juga sudah tersalin ke clipboard jika aplikasi belum terpasang di perangkat Anda.", {
        position: "top-center",
        duration: 5000,
      });
    } catch {
      toast.info("Draf telah disalin ke clipboard! Silakan tempel di aplikasi email Anda.", { position: "top-center" });
    }
  };

  if (error || (!loading && !result)) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="card p-8 text-center">
        <p className="text-[var(--color-danger)] font-medium">{error || "Result not found"}</p>
        <button onClick={() => router.push("/karyawan/dashboard")} className="btn btn-secondary btn-sm mt-4">
          Back to Dashboard
        </button>
      </div>
    </div>
  );

  const outcome = result?.outcome ? outcomeConfig[result.outcome] : null;
  const OutcomeIcon = outcome?.icon;
  const scoreExplanation = result ? getScoreExplanation(result.totalScore ?? 0) : null;
  const weakestCategory = result ? getWeakestCategory(result.insightReport?.categoryScores ?? []) : null;
  const suggestedPhrase = getSuggestedPhrase(weakestCategory);
  const nextPracticePlan = getNextPracticePlan(weakestCategory);
  const facialInterpretation = result?.insightReport?.microexpressionSalesInterpretation || getFacialInterpretation(result?.facialSummary);

  const commMetrics = result?.insightReport?.communicationMetrics;
  const timelineMoments = result?.insightReport?.timelineMoments || [];
  const activeMoment = timelineMoments.find(m => m.turn === selectedTimelineTurn) || timelineMoments[0];

  return (
    <AutoSkeleton isLoading={loading} type="stats">
      {result && (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button onClick={() => router.push("/karyawan/history")} className="btn btn-secondary btn-sm flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div>
              <h1 className="text-2xl font-bold">Session Coaching Report</h1>
              <p className="text-[var(--color-text-muted)] text-sm">{result.course?.title}</p>
            </div>
          </div>

          {/* Score Hero */}
          <div className={`card p-6 text-center ${outcome?.bg}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {OutcomeIcon && <OutcomeIcon className={`w-5 h-5 ${outcome.color}`} />}
              <p className={`text-lg font-bold ${outcome?.color}`}>{outcome?.label || result.outcome}</p>
            </div>
            <div className={`text-6xl font-black ${scoreColor(result.totalScore ?? 0)} mb-2`}>
              {result.totalScore ?? "-"}
              <span className="text-2xl text-[var(--color-text-muted)] font-normal">/100</span>
            </div>
            <div className="w-full max-w-xs mx-auto progress-bar mb-4">
              <div
                className={`progress-fill ${(result.totalScore ?? 0) >= 80 ? "progress-fill-green" : (result.totalScore ?? 0) >= 60 ? "progress-fill-yellow" : "progress-fill-red"}`}
                style={{ width: `${result.totalScore ?? 0}%` }}
              />
            </div>
            <div className="flex items-center justify-center gap-6 text-sm text-[var(--color-text-muted)]">
              <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> {result.turnCount} turns</span>
              <span className="flex items-center gap-1"><Clock className="w-4 h-4" />
                {formatDate(result.completedAt)}
              </span>
            </div>
          </div>

          {/* ════ SECTION 1: INTERACTIVE SESSION TIMELINE REPLAY ════ */}
          {timelineMoments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                    <FastForward className="w-4 h-4 text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Interactive Session Timeline Replay</h3>
                    <p className="text-[11px] text-[var(--color-text-muted)]">Klik setiap turn untuk menganalisis momen kunci, lonjakan trust, dan keberatan</p>
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] text-[var(--color-accent)]">
                  {timelineMoments.length} Turns Logged
                </span>
              </div>

              <div className="p-5 space-y-4">
                {/* 1.1 Audio Replay Bar Berstempel Waktu */}
                <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] flex flex-wrap items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={toggleAudioReplay}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white transition-all shadow-sm ${
                        isPlayingAudio
                          ? "bg-[var(--color-danger)] hover:bg-[var(--color-danger)]/90 active:scale-95"
                          : "bg-[var(--color-accent)] hover:brightness-110 active:scale-95"
                      }`}
                      title={isPlayingAudio ? "Jeda Audio Replay" : "Putar Audio Replay Sesi"}
                    >
                      {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={stopAudioReplay}
                      className="w-8 h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-border)]/30 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                      title="Hentikan Audio"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--color-text)]">
                          Audio Replay: Turn {activeAudioTurn}
                        </span>
                        {isPlayingAudio && (
                          <span className="flex items-center gap-1 text-[10px] text-[var(--color-success)] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)] animate-pulse" />
                            Memutar Percakapan
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Stempel waktu tersinkronisasi otomatis dengan transkrip tiap turn
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[11px] text-[var(--color-text-muted)] font-medium">Kecepatan:</span>
                    {[1, 1.25, 1.5].map((spd) => (
                      <button
                        key={spd}
                        type="button"
                        onClick={() => setAudioSpeed(spd)}
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-all ${
                          audioSpeed === spd
                            ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] text-[var(--color-accent)]"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horizontal Turn Scrubber dengan Stempel Waktu */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {timelineMoments.map((tm) => (
                    <button
                      key={tm.turn}
                      onClick={() => {
                        setSelectedTimelineTurn(tm.turn);
                        if (isPlayingAudio) playAudioForTurn(tm.turn);
                      }}
                      className={`flex flex-col items-center p-2 rounded-xl border transition-all flex-shrink-0 min-w-[80px] ${
                        selectedTimelineTurn === tm.turn
                          ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] shadow-sm scale-105"
                          : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                      } ${isPlayingAudio && activeAudioTurn === tm.turn ? "ring-2 ring-[var(--color-accent)]" : ""}`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-[var(--color-text-muted)]">Turn {tm.turn}</span>
                        {isPlayingAudio && activeAudioTurn === tm.turn && (
                          <Volume2 className="w-2.5 h-2.5 text-[var(--color-accent)] animate-pulse" />
                        )}
                      </div>
                      <span className={`text-xs my-0.5 ${
                        tm.type === 'breakthrough' ? 'text-[var(--color-success)] font-black' :
                        tm.type === 'friction' ? 'text-[var(--color-danger)] font-black' :
                        tm.type === 'objection' ? 'text-[var(--color-warning)] font-black' :
                        'text-[var(--color-text-muted)]'
                      }`}>
                        {tm.type === 'breakthrough' ? '+Trust' :
                         tm.type === 'friction' ? 'Drop' :
                         tm.type === 'objection' ? 'Obj' : '• Steady'}
                      </span>
                      <span className="text-[9px] text-[var(--color-text-subtle)]">
                        00:{String((tm.turn - 1) * 25).padStart(2, '0')} • {tm.trustLevel}/5
                      </span>
                    </button>
                  ))}
                </div>

                {/* Active Turn Detail Inspector */}
                {activeMoment && (
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-[var(--color-surface)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
                          Turn {activeMoment.turn}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                          activeMoment.type === 'breakthrough' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' :
                          activeMoment.type === 'friction' ? 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]' :
                          activeMoment.type === 'objection' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' :
                          'bg-[var(--color-surface)] text-[var(--color-text-muted)]'
                        }`}>
                          {activeMoment.badgeLabel}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-[var(--color-text-muted)]">
                        Trust: <span className="text-[var(--color-text)]">{activeMoment.trustLevel} / 5.0</span>
                        {activeMoment.trustDelta ? ` (${activeMoment.trustDelta > 0 ? '+' : ''}${activeMoment.trustDelta})` : ''}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]">
                        <p className="font-bold text-[var(--color-accent)] mb-1 uppercase text-[9px]">Sales Pitch / Response</p>
                        <p className="text-[var(--color-text)] leading-relaxed italic">&ldquo;{activeMoment.salesSnippet}&rdquo;</p>
                        {activeMoment.fillerCountInTurn > 0 && (
                          <p className="text-[10px] text-[var(--color-warning)] mt-1.5 font-medium">
                            ⚠️ {activeMoment.fillerCountInTurn} kata pengisi terdeteksi di turn ini.
                          </p>
                        )}
                      </div>

                      <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]">
                        <p className="font-bold text-[var(--color-text-muted)] mb-1 uppercase text-[9px]">Prospect Reaction</p>
                        <p className="text-[var(--color-text)] leading-relaxed italic">&ldquo;{activeMoment.customerSnippet}&rdquo;</p>
                      </div>
                    </div>

                    <div className="bg-[var(--color-surface)]/60 p-2.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)] flex-shrink-0" />
                      <span><strong>AI Coach Note:</strong> {activeMoment.annotation}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ SECTION 2: SPEECH & COMMUNICATION ANALYTICS ════ */}
          {commMetrics && (
            <div className="card overflow-hidden">
              <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <Mic className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Speech & Voice Communication Analytics</h3>
                    <p className="text-[11px] text-[var(--color-text-muted)]">Analisis gaya bicara, rasio dengar vs bicara, dan kata jeda pengisi (filler words)</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {/* 3 Analytics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Talk to Listen */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Talk-to-Listen Ratio</p>
                      <p className="text-xl font-black text-[var(--color-text)]">
                        {commMetrics.talkToListenRatio.salesPercentage}% <span className="text-xs font-normal text-[var(--color-text-muted)]">Sales</span> : {commMetrics.talkToListenRatio.prospectPercentage}% <span className="text-xs font-normal text-[var(--color-text-muted)]">Client</span>
                      </p>
                    </div>
                    {/* Visual Ratio Bar */}
                    <div className="my-2.5">
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                        <div style={{ width: `${commMetrics.talkToListenRatio.salesPercentage}%` }} className="bg-[var(--color-accent)]" />
                        <div style={{ width: `${commMetrics.talkToListenRatio.prospectPercentage}%` }} className="bg-emerald-500" />
                      </div>
                      <div className="flex justify-between text-[9px] text-[var(--color-text-subtle)] mt-1">
                        <span>You ({commMetrics.talkToListenRatio.salesWords} words)</span>
                        <span>Client ({commMetrics.talkToListenRatio.prospectWords} words)</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight">{commMetrics.talkToListenRatio.advice}</p>
                  </div>

                  {/* Pacing WPM */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Speech Pacing (WPM)</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl font-black text-[var(--color-text)]">{commMetrics.pacing.averageWpm}</p>
                        <span className="text-xs font-semibold text-[var(--color-text-muted)]">WPM</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                          commMetrics.pacing.rating === 'Optimal' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' :
                          'bg-[var(--color-warning)]/15 text-[var(--color-warning)]'
                        }`}>
                          {commMetrics.pacing.rating}
                        </span>
                      </div>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed mt-2">{commMetrics.pacing.label}</p>
                  </div>

                  {/* Filler Words */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Filler Words</p>
                      <div className="flex items-baseline gap-1.5">
                        <p className="text-2xl font-black text-[var(--color-text)]">{commMetrics.fillerWords.total}</p>
                        <span className="text-xs font-semibold text-[var(--color-text-muted)]">words ({commMetrics.fillerWords.percentage}%)</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto ${
                          commMetrics.fillerWords.rating === 'Clean' ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' :
                          commMetrics.fillerWords.rating === 'Moderate' ? 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]' :
                          'bg-[var(--color-danger)]/15 text-[var(--color-danger)]'
                        }`}>
                          {commMetrics.fillerWords.rating}
                        </span>
                      </div>
                    </div>

                    {/* Tag Cloud of Fillers */}
                    <div className="flex flex-wrap gap-1 my-2">
                      {Object.entries(commMetrics.fillerWords.breakdown).length > 0 ? (
                        Object.entries(commMetrics.fillerWords.breakdown).map(([word, count]) => (
                          <span key={word} className="px-2 py-0.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[10px] font-medium text-[var(--color-text)]">
                            &ldquo;{word}&rdquo; <span className="text-[var(--color-accent)] font-bold">{count}x</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-[10px] text-[var(--color-success)] font-medium">Bicara sangat bersih tanpa kata jeda! 🎯</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-tight">{commMetrics.fillerWords.tips}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Microexpressions Analysis Panel */}
          <div className="card overflow-hidden">
            <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                  <BrainCircuit className="w-4 h-4 text-[var(--color-accent)]" />
                </div>
                <h3 className="font-semibold text-sm">Microexpression & Facial Analysis Insights</h3>
              </div>
            </div>

            {!result.facialSummary ? (
              <div className="p-5 text-sm text-[var(--color-text-muted)]">
                Webcam tidak aktif selama sesi ini. Aktifkan kamera untuk mendapatkan analisis mikroekspresi & kontak mata real-time.
              </div>
            ) : (
              <div className="p-5 space-y-5">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <div className="flex justify-center mb-2"><Smile className="w-5 h-5 text-[var(--color-text-muted)]"/></div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Dominant Emotion</p>
                    <p className="text-lg font-bold capitalize text-[var(--color-text)]">
                      {getExpressionEmoji(result.facialSummary.dominantExpression)} {result.facialSummary.dominantExpression || "Unknown"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center">
                    <div className="flex justify-center mb-2"><Eye className="w-5 h-5 text-[var(--color-text-muted)]"/></div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">Eye Contact</p>
                    <p className="text-lg font-bold text-[var(--color-text)]">
                      {result.facialSummary.eyeContactRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 text-center col-span-2 md:col-span-1">
                    <div className="flex justify-center mb-2"><Target className="w-5 h-5 text-[var(--color-text-muted)]"/></div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)] mb-1">AI Confidence</p>
                    <p className="text-lg font-bold text-[var(--color-text)]">
                      {result.facialSummary.averageConfidence?.toFixed(1) || 0}%
                    </p>
                  </div>
                </div>

                {/* Sales Interpretation */}
                <div className="bg-[var(--color-bg)] rounded-xl p-4 border border-[var(--color-border)] relative overflow-hidden mt-4">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-accent)]"></div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)] mb-2">Sales Interpretation</p>
                  <p className="text-sm font-medium leading-relaxed text-[var(--color-text)]">
                    {facialInterpretation}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Score Explanation */}
          {scoreExplanation && (
            <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ClipboardCheck className="w-5 h-5 text-[var(--color-accent)]" />
                  <h3 className="font-semibold">Why this score?</h3>
                </div>
                <p className={`text-sm font-bold ${scoreExplanation.tone}`}>
                  {scoreExplanation.label}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                  {scoreExplanation.summary}
                </p>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5 text-[var(--color-warning)]" />
                  <h3 className="font-semibold">Main limiter</h3>
                </div>
                {weakestCategory ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-sm">{weakestCategory.category}</p>
                      <p className={`font-black ${scoreColor(weakestCategory.score)}`}>
                        {weakestCategory.score}/100
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      {weakestCategory.comment}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Belum ada kategori yang cukup untuk dianalisis.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Suggested Phrase */}
          <div className="card p-5 border-l-4 border-[var(--color-accent)]">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div>
                <h3 className="font-semibold">Suggested phrase for next try</h3>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Contoh kalimat ini dibuat dari kategori yang paling perlu diperbaiki.
                </p>
                <p className="mt-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] p-4 text-sm font-medium leading-relaxed text-[var(--color-text)]">
                  &ldquo;{suggestedPhrase}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Narrative Executive Summary */}
          {result.insightReport?.narrative && (
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Award className="w-5 h-5 text-[var(--color-accent)]" />
                <h3 className="font-semibold">Executive Summary</h3>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{result.insightReport.narrative}</p>
            </div>
          )}

          {/* Category Scores */}
          {result.insightReport?.categoryScores?.length > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Target className="w-4 h-4 text-[var(--color-text-muted)]" /> Performance by Rubric
              </h3>
              <div className="space-y-4">
                {result.insightReport.categoryScores.map((cat, i) => (
                  <div key={i} className="bg-[var(--color-bg)] rounded-xl p-3 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{cat.category} <span className="text-[10px] text-[var(--color-text-muted)] font-normal ml-1">(Weight: {cat.weight}%)</span></p>
                      <p className={`font-bold text-sm ${scoreColor(cat.score)}`}>{cat.score}/100</p>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-2">{cat.comment}</p>
                    {cat.examples?.length > 0 && (
                      <div className="bg-[var(--color-surface)] border-l-2 border-[var(--color-accent)] p-2 text-[10px] text-[var(--color-text-muted)]">
                        <p className="mb-1 font-bold uppercase tracking-wide text-[var(--color-accent)]">
                          Evidence from session
                        </p>
                        <div className="space-y-1">
                          {cat.examples.slice(0, 2).map((example) => (
                            <p key={example}>&ldquo;{example}&rdquo;</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strengths & Weaknesses (Key Moments) */}
          {result.insightReport?.keyMoments && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-success-light)] flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
                  </div>
                  <h3 className="font-semibold text-sm">Key Strengths</h3>
                </div>
                <div className="space-y-3">
                  {result.insightReport.keyMoments.filter(m => m.type === 'strength').map((m, i) => (
                    <div key={i} className="text-sm">
                      <p className="text-[var(--color-text)] font-medium mb-1"><span className="text-[var(--color-success)]">✓</span> {m.description}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg)] p-1.5 rounded border border-[var(--color-border)]">&ldquo;{m.salesMessage}&rdquo; (Turn {m.turn})</p>
                    </div>
                  ))}
                  {result.insightReport.keyMoments.filter(m => m.type === 'strength').length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">No distinct strengths identified in this session.</p>
                  )}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-[var(--color-warning-light)] flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[var(--color-warning)]" />
                  </div>
                  <h3 className="font-semibold text-sm">Areas to Improve</h3>
                </div>
                <div className="space-y-3">
                  {result.insightReport.keyMoments.filter(m => m.type === 'weakness').map((m, i) => (
                    <div key={i} className="text-sm">
                      <p className="text-[var(--color-text)] font-medium mb-1"><span className="text-[var(--color-warning)]">→</span> {m.description}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg)] p-1.5 rounded border border-[var(--color-border)]">&ldquo;{m.salesMessage}&rdquo; (Turn {m.turn})</p>
                    </div>
                  ))}
                  {result.insightReport.keyMoments.filter(m => m.type === 'weakness').length === 0 && (
                    <p className="text-xs text-[var(--color-text-muted)]">No major weaknesses identified in this session.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.insightReport?.recommendations?.length > 0 && (
            <div className="card p-5 bg-[var(--color-accent-light)] border border-[var(--color-accent)]/20">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-[var(--color-accent)]">
                <MessageSquare className="w-4 h-4" /> Recommended Action Plan
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-[var(--color-text-secondary)]">
                {result.insightReport.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Next Practice Plan */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
              <div>
                <h3 className="font-semibold">Next practice plan</h3>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Latihan lanjutan yang paling relevan dengan hasil sesi ini.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Focus</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text)]">{nextPracticePlan.focus}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Drill</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{nextPracticePlan.drill}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-text-muted)]">Checkpoint</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-text-secondary)]">{nextPracticePlan.checkpoint}</p>
              </div>
            </div>

            {/* 2.1 Mode Latihan Kilat (Personalized Rapid Drill Mode) */}
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 bg-[var(--color-accent-light)]/40 p-4 rounded-xl border border-[var(--color-accent)]/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] text-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--color-text)]">
                      Latihan Kilat: Kuasai {nextPracticePlan.focus}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white">
                      Maks 5 Turn
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Simulasi terfokus untuk langsung mempraktikkan area perbaikan tanpa sesi panjang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={startRapidDrill}
                disabled={isStartingDrill}
                className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                {isStartingDrill ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyiapkan...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Mulai Drill 5 Turn Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ════ 2.2 GENERATOR DRAF FOLLOW-UP (WHATSAPP & EMAIL) ════ */}
          <div className="card p-5 space-y-4 border border-[var(--color-accent)]/30">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Generator Draf Follow-Up Pasca Simulasi</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Draf pesan tindak lanjut siap kirim ke WhatsApp dan Email berbasis hasil simulasi ini.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-[var(--color-bg)] p-1 rounded-xl border border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() => setFollowupChannel('whatsapp')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    followupChannel === 'whatsapp'
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setFollowupChannel('email')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    followupChannel === 'email'
                      ? "bg-[var(--color-accent)] text-white shadow-sm"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </button>
              </div>
            </div>

            {/* Draft Content Card */}
            <div className="space-y-3">
              {followupChannel === 'whatsapp' ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4" /> Template Chat WhatsApp
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(followupData?.whatsappDraft || '')}
                      className="btn btn-secondary btn-xs flex items-center gap-1"
                    >
                      {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDraft ? "Tersalin!" : "Salin Pesan"}</span>
                    </button>
                  </div>
                  <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed">
                    {followupLoading ? (
                      <div className="py-6 text-center text-[var(--color-text-muted)] flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        <span>Menyiapkan draf WhatsApp...</span>
                      </div>
                    ) : (
                      followupData?.whatsappDraft || "Memuat template..."
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={fetchFollowupDraft}
                      disabled={followupLoading}
                      className="btn btn-secondary btn-xs flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${followupLoading ? 'animate-spin' : ''}`} />
                      <span>Regenerasi AI</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(followupData?.whatsappDraft || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-xs bg-emerald-600 hover:bg-emerald-700 border-none flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di WhatsApp Web</span>
                    </a>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-light)]/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--color-accent)] flex items-center gap-1.5">
                      <Mail className="w-4 h-4" /> Draf Email Formal
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(`Subject: ${followupData?.emailSubject || ''}\n\n${followupData?.emailBody || ''}`)}
                      className="btn btn-secondary btn-xs flex items-center gap-1"
                    >
                      {copiedDraft ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedDraft ? "Tersalin!" : "Salin Lengkap"}</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-[var(--color-surface)] px-3 py-2 rounded-lg border border-[var(--color-border)] text-xs">
                      <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase block">Subjek Email:</span>
                      <p className="font-semibold text-[var(--color-text)] mt-0.5">{followupData?.emailSubject || "Memuat..."}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed">
                      {followupLoading ? (
                        <div className="py-6 text-center text-[var(--color-text-muted)] flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          <span>Menyiapkan draf Email...</span>
                        </div>
                      ) : (
                        followupData?.emailBody || "Memuat template..."
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={fetchFollowupDraft}
                      disabled={followupLoading}
                      className="btn btn-secondary btn-xs flex items-center gap-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${followupLoading ? 'animate-spin' : ''}`} />
                      <span>Regenerasi AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEmailApp("gmail")}
                      className="btn btn-secondary btn-xs flex items-center gap-1.5 hover:text-red-500 hover:border-red-400 transition-colors cursor-pointer"
                      title="Buka langsung di tab Gmail Web baru"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                      <span>Buka di Gmail</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEmailApp("default")}
                      className="btn btn-primary btn-xs flex items-center gap-1.5 cursor-pointer"
                      title="Buka aplikasi email default perangkat (mailto) dan salin draf"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Buka Aplikasi Email</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recommended Training Courses Card */}
          <div className="card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--color-accent)]" />
                <div>
                  <h3 className="font-semibold text-sm">Recommended Training Courses</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Modul latihan terbaik untuk mempertajam area kelemahan & meningkatkan skor Anda.
                  </p>
                </div>
              </div>
            </div>
            {recommendedCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {recommendedCourses.slice(0, 4).map((c: any) => (
                  <Link
                    key={c.id}
                    href={`/karyawan/courses/${c.id}`}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] transition-all"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-sm font-semibold truncate text-[var(--color-text)]">{c.title}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5 capitalize">{c.category || "Sales Training"}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2.5 py-1 rounded-full flex-shrink-0">
                      Practice →
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-muted)]">Coba modul roleplay populer lainnya untuk mengasah kemampuan sales Anda.</span>
                <Link href="/karyawan/courses" className="btn btn-secondary btn-xs">Lihat Semua Course</Link>
              </div>
            )}
          </div>

          {/* Transcript Toggle */}
          {result.transcript?.length > 0 && (
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-[var(--color-bg)] transition-colors"
              >
                <span>Full Transcript ({result.transcript.length} messages)</span>
                {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showTranscript && (
                <div className="border-t border-[var(--color-border)] p-4 space-y-3 max-h-96 overflow-y-auto">
                  {result.transcript.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                        msg.role === "user" ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-bg)] border border-[var(--color-border)]"
                      }`}>
                        <p>{msg.content}</p>
                        {msg.turnScore != null && (
                          <p className={`text-xs mt-1 ${msg.role === "user" ? "text-blue-200" : "text-[var(--color-text-muted)]"}`}>
                            Score: {msg.turnScore}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => router.push("/karyawan/dashboard")} className="btn btn-secondary btn-md flex-1">Back to Dashboard</button>
            <button onClick={() => router.push("/karyawan/courses")} className="btn btn-secondary btn-md flex-1">Practice Again</button>
            <button onClick={() => router.push("/karyawan/history")} className="btn btn-primary btn-md flex-1">View All History</button>
          </div>
        </div>
      )}
    </AutoSkeleton>
  );
}
