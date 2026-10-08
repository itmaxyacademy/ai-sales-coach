"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { ArrowLeft, Award, TrendingUp, BookOpen, CheckCircle2, Target, BarChart2, Clock } from "lucide-react";
import Link from "next/link";
import { AutoSkeleton } from "../../../../components/ui";

interface MemberDetail {
  profile: { id: string; name: string; email: string; createdAt: string };
  sawDetail: {
    sawScore: number;
    rank: number | null;
    criteriaValues?: Record<string, number>;
    sawBreakdown?: { criterion: string; weight: number; normalizedValue: number; weightedScore: number }[];
  } | null;
  trend30Days: { sessionId: string; score: number | null; completedAt: string }[];
  recentSessions: { id: string; courseTitle: string; score: number | null; outcome: string; completedAt: string }[];
}

const outcomeColor: Record<string, string> = {
  closed: "badge-green", follow_up: "badge-yellow", rejected: "badge-red"
};
const scoreColor = (s: number) => s >= 80 ? "text-[var(--color-success)]" : s >= 60 ? "text-[var(--color-warning)]" : "text-[var(--color-danger)]";

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;
  const [data, setData] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("30days");

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    apiClient.get(`/manager/team/${userId}?period=${period}`)
      .then(res => { if (res?.data) setData(res.data); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [userId, period]);

  if (error || (!loading && !data)) return (
    <div className="p-6">
      <div className="card p-8 text-center text-[var(--color-danger)]">{error || "Member not found"}</div>
    </div>
  );

  const criteriaLabels: Record<string, string> = {
    c1_avgScore: "Avg Score",
    c2_outcomeRate: "Outcome Rate",
    c3_improvement: "Improvement",
    c4_completionRate: "Completion",
    c5_deadlineCompliance: "Deadline"
  };

  return (
    <AutoSkeleton isLoading={loading} type="profile">
      {data && (() => {
        const saw = data.sawDetail;
        const sawPct = Math.round((saw?.sawScore ?? 0) * 100);
        const trendScores = data.trend30Days.map(p => p.score ?? 0);
        const maxTrend = trendScores.length ? Math.max(...trendScores, 1) : 100;
        const avgScore = trendScores.length ? Math.round(trendScores.reduce((a, b) => a + b, 0) / trendScores.length) : 0;
        const bestScore = trendScores.length ? Math.max(...trendScores) : 0;

        return (
          <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-xs text-[var(--color-text-muted)] mb-0.5">
            <Link href="/manager/team" className="hover:text-[var(--color-accent)]">Team</Link> › {data.profile.name}
          </div>
          <h1 className="text-xl font-bold">{data.profile.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">{data.profile.email}</p>
        </div>
        {saw?.rank && (
          <div className="text-center">
            <div className="text-3xl font-black text-[var(--color-warning)]">#{saw.rank}</div>
            <p className="text-xs text-[var(--color-text-muted)]">Team Rank</p>
          </div>
        )}
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">SAW Score</span>
            <Award className="w-4 h-4 text-[var(--color-warning)]" />
          </div>
          <div className="stat-value text-[var(--color-accent)]">{sawPct}<span className="text-base font-normal text-[var(--color-text-muted)]">%</span></div>
          <div className="progress-bar mt-2"><div className="progress-fill bg-[var(--color-accent)]" style={{ width: `${sawPct}%` }} /></div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Avg Score (30d)</span>
            <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className={`stat-value ${scoreColor(avgScore)}`}>{avgScore || "-"}</div>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Best: {bestScore || "-"}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Sessions (30d)</span>
            <Target className="w-4 h-4 text-[var(--color-purple)]" />
          </div>
          <div className="stat-value">{data.trend30Days.length}</div>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Recent Sessions</span>
            <Clock className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>
          <div className="stat-value">{data.recentSessions.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* SAW Breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-[var(--color-warning)]" /> SAW Performance Breakdown
          </h2>
          {saw?.criteriaValues ? (
            <div className="space-y-3">
              {Object.entries(saw.criteriaValues).map(([key, value]) => {
                const pct = Math.round((value as number) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-muted)]">{criteriaLabels[key] || key}</span>
                      <span className="font-bold">{pct}%</span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className={`progress-fill ${pct >= 70 ? "bg-[var(--color-success)]" : pct >= 50 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-5xl font-black text-[var(--color-accent)] mb-2">{sawPct}%</div>
              <p className="text-xs text-[var(--color-text-muted)]">Composite SAW Score</p>
              {!saw && <p className="text-xs text-[var(--color-text-muted)] mt-3">No sessions completed yet.</p>}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="card p-5 md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--color-accent)]" /> Recent Sessions
            </h2>
          </div>
          {data.recentSessions.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-[var(--color-text-muted)]">
              <CheckCircle2 className="w-8 h-8 opacity-20 mb-2" />
              <p className="text-sm">No completed sessions yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentSessions.map(s => (
                <Link
                  href={`/manager/sessions/${s.id}`}
                  key={s.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-border)] hover:shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.courseTitle}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {s.completedAt ? new Date(s.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : "-"}
                    </p>
                  </div>
                  <span className={`badge ${outcomeColor[s.outcome] || "badge-gray"} capitalize`}>
                    {s.outcome?.replace("_", " ") || "-"}
                  </span>
                  <span className={`font-bold text-sm ${scoreColor(s.score ?? 0)}`}>{s.score ?? "-"}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Score Trend Chart */}
      {data.trend30Days.length > 0 && (
        <div className="card p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" /> Score Trend
            </h2>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 bg-[var(--color-bg)] border border-[var(--color-border)] p-0.5 rounded-lg">
                {[
                  { key: "7days", label: "7D" },
                  { key: "30days", label: "30D" },
                  { key: "90days", label: "90D" },
                  { key: "alltime", label: "All" }
                ].map(p => (
                  <button
                    key={p.key}
                    onClick={() => setPeriod(p.key)}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                      period === p.key 
                        ? "bg-[var(--color-accent)] text-white shadow-sm font-bold" 
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className="text-xs text-[var(--color-text-muted)]">{data.trend30Days.length} sessions</span>
            </div>
          </div>
          <div className="flex items-end gap-1 h-28">
            {data.trend30Days.map((point, i) => {
              const score = point.score ?? 0;
              const h = Math.round((score / maxTrend) * 100);
              const color = score >= 80 ? "bg-[var(--color-success)]" : score >= 60 ? "bg-[var(--color-warning)]" : "bg-[var(--color-danger)]";
              return (
                <div key={i} className="flex-1 h-full group relative flex flex-col justify-end items-center">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                    {score} pts
                  </div>
                  <div
                    className={`w-full rounded-t-sm ${color} opacity-80 hover:opacity-100 transition-opacity cursor-pointer`}
                    style={{ height: `${Math.max(h, 4)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-2">
            <span>{new Date(data.trend30Days[0].completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            <span>{new Date(data.trend30Days[data.trend30Days.length - 1].completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </div>
        </div>
      )}
          </div>
        );
      })()}
    </AutoSkeleton>
  );
}
