"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { ArrowLeft, CheckCircle2, Target, XCircle, MessageSquare, Award, TrendingUp } from "lucide-react";
import { SessionTimelineReplay, type TimelineMoment } from "../../../../components/session/SessionTimelineReplay";

// 1. Interface disesuaikan dengan schema ManagerAuditSessionDetail di OpenAPI
interface ManagerAuditSessionDetail {
  id: string;
  userName: string;
  courseTitle: string;
  status: string;
  totalScore?: number;
  outcome?: string;
  trustLevel?: number;
  customerStage?: string;
  completedAt?: string;
  scoreBreakdown?: { category: string; score: number; comment?: string }[];
  feedbackReport?: {
    narrative?: string;
    keyMoments?: { turn: number; type: 'strength' | 'weakness'; description: string; salesMessage: string; }[];
    recommendations?: string[];
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
  messages?: { role: string; content: string; turnScore?: number; coachingHint?: any }[];
}

const outcomeConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  closed: { label: "Deal Closed", color: "text-[var(--color-success)]", bg: "bg-[var(--color-success-light)]", icon: CheckCircle2 },
  follow_up: { label: "Follow-up Needed", color: "text-[var(--color-warning)]", bg: "bg-[var(--color-warning-light)]", icon: Target },
  rejected: { label: "Rejected", color: "text-[var(--color-danger)]", bg: "bg-[var(--color-danger-light)]", icon: XCircle },
};

const scoreColor = (score: number) => {
  if (score >= 80) return "text-[var(--color-success)]";
  if (score >= 60) return "text-[var(--color-warning)]";
  return "text-[var(--color-danger)]";
};

export default function ManagerSessionReviewPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string;
  const [data, setData] = useState<ManagerAuditSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    apiClient.get(`/manager/sessions/${sessionId}`)
      .then((res: any) => { 
        // 2. Mengambil data dari res.data karena endpoint membungkus response di dalam properti "data"
        const sessionData = res?.data || res; 
        if (sessionData) setData(sessionData); 
      })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="p-6 text-center text-[var(--color-text-muted)] animate-pulse">Loading session details...</div>;
  if (error || !data) return <div className="p-6 text-center text-[var(--color-danger)]">{error || "Data not found"}</div>;

  const outcome = data.outcome ? outcomeConfig[data.outcome] : null;
  const OutcomeIcon = outcome?.icon;
  // Menghitung jumlah turn berdasarkan panjang messages
  const turnCount = data.messages ? Math.floor(data.messages.length / 2) : 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-1.5"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-xl font-bold">Session Review</h1>
          {/* 3. Menggunakan data.userName dan data.courseTitle */}
          <p className="text-[var(--color-text-muted)] text-sm">{data.userName || "Unknown User"} • {data.courseTitle || "Unknown Course"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Overview */}
        <div className="space-y-6">
          <div className={`card p-5 text-center ${outcome?.bg || "bg-[var(--color-bg)]"}`}>
            <div className={`text-4xl font-black ${scoreColor(data.totalScore ?? 0)} mb-1`}>{data.totalScore ?? "-"}</div>
            <div className="flex items-center justify-center gap-1 text-sm font-semibold mb-4">
              {OutcomeIcon && <OutcomeIcon className={`w-4 h-4 ${outcome.color}`} />}
              <span className={outcome?.color || "text-[var(--color-text)]"}>{outcome?.label || data.outcome || data.status}</span>
            </div>
            <div className="text-xs text-[var(--color-text-muted)] space-y-1 text-left bg-white/50 p-3 rounded">
              <p className="flex justify-between"><span>Turns:</span> <strong>{turnCount}</strong></p>
              <p className="flex justify-between"><span>Date:</span> <strong>{data.completedAt ? new Date(data.completedAt).toLocaleDateString() : "-"}</strong></p>
              {data.facialSummary?.dominantExpression && (
                <p className="flex justify-between"><span>Expression:</span> <strong className="capitalize">{data.facialSummary.dominantExpression}</strong></p>
              )}
            </div>
          </div>

          {/* Narrative (Feedback Report) */}
          {/* 4. Menyesuaikan nama dengan data.feedbackReport */}
          {data.feedbackReport?.narrative && (
            <div className="card p-4 text-sm text-[var(--color-text-secondary)]">
              <h3 className="font-semibold text-[var(--color-text)] flex items-center gap-1 mb-2"><Award className="w-4 h-4 text-[var(--color-accent)]" /> Summary</h3>
              <p className="leading-relaxed">{data.feedbackReport.narrative}</p>
            </div>
          )}

          {/* Key Moments */}
          <div className="card p-4 space-y-4">
            <div>
              <h3 className="font-semibold text-sm flex items-center gap-1 mb-3 text-[var(--color-success)]"><CheckCircle2 className="w-4 h-4" /> Key Strengths</h3>
              <div className="space-y-3">
                {data.feedbackReport?.keyMoments?.filter(m => m.type === 'strength').map((m, i) => (
                  <div key={i} className="text-xs">
                    <p className="font-medium mb-0.5">• {m.description}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] pl-2 border-l border-[var(--color-border)]">"{m.salesMessage}"</p>
                  </div>
                ))}
                {(!data.feedbackReport?.keyMoments || data.feedbackReport.keyMoments.filter(m => m.type === 'strength').length === 0) && (
                  <p className="text-xs text-[var(--color-text-muted)]">No distinct strengths identified.</p>
                )}
              </div>
            </div>
            <div className="border-t border-[var(--color-border)] pt-4">
              <h3 className="font-semibold text-sm flex items-center gap-1 mb-3 text-[var(--color-warning)]"><TrendingUp className="w-4 h-4" /> Areas to Improve</h3>
              <div className="space-y-3">
                {data.feedbackReport?.keyMoments?.filter(m => m.type === 'weakness').map((m, i) => (
                  <div key={i} className="text-xs">
                    <p className="font-medium mb-0.5">• {m.description}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] pl-2 border-l border-[var(--color-border)]">"{m.salesMessage}"</p>
                  </div>
                ))}
                {(!data.feedbackReport?.keyMoments || data.feedbackReport.keyMoments.filter(m => m.type === 'weakness').length === 0) && (
                  <p className="text-xs text-[var(--color-text-muted)]">No major weaknesses identified.</p>
                )}
              </div>
            </div>
          </div>

          {/* Category Scores (Score Breakdown) */}
          {/* 5. Menyesuaikan nama dengan data.scoreBreakdown */}
          {data.scoreBreakdown && data.scoreBreakdown.length > 0 && (
            <div className="card p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-1 mb-2"><Target className="w-4 h-4 text-[var(--color-text-muted)]" /> Rubric Scores</h3>
              {data.scoreBreakdown.map((cat, i) => (
                <div key={i} className="bg-[var(--color-bg)] rounded p-2 text-xs border border-[var(--color-border)]">
                  <div className="flex justify-between font-semibold mb-1">
                    <span>{cat.category}</span>
                    <span className={scoreColor(cat.score)}>{cat.score}/100</span>
                  </div>
                  {cat.comment && <p className="text-[10px] text-[var(--color-text-muted)]">{cat.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Col: Transcript (Messages) */}
        {/* 6. Menyesuaikan array pesan dengan data.messages */}
        <div className="md:col-span-2">
          <div className="card h-full flex flex-col">
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Full Transcript</h2>
              <span className="badge badge-gray">{data.messages?.length || 0} messages</span>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto max-h-[600px] bg-[var(--color-bg)]">
              {data.messages?.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`px-3 py-2 rounded-lg text-sm max-w-[80%] ${
                    msg.role === "user" ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)]"
                  }`}>
                    <p>{msg.content}</p>
                    {msg.turnScore != null && (
                      <p className={`text-[10px] mt-1 text-right ${msg.role === "user" ? "text-blue-200" : "text-[var(--color-text-muted)]"}`}>
                        Score: {msg.turnScore}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SessionTimelineReplay timelineMoments={data.feedbackReport?.timelineMoments || []} />
    </div>
  );
}