"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import {
  Users,
  TrendingUp,
  TrendingDown,
  PlayCircle,
  AlertCircle,
  Award,
  BarChart2,
  CheckCircle2,
  Trophy,
  Medal,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, AutoSkeleton } from "../../../components/ui";

interface DashboardData {
  teamCompletionRate: number;
  teamAvgScore: { current: number; delta: number };
  activeSessions: number;
  dueDateAlerts: { id: string; userName: string; courseTitle: string; dueAt: string }[];
  followUpItems: { id: string; type: "score_drop" | "assignment" | "weakness"; name: string; detail: string; href: string; priority: number }[];
  top3Ranking: { rank: number; userId: string; name: string; sawScore: number; avgScore: number }[];
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy className="w-4 h-4 text-[var(--color-warning)]" />;
  if (rank === 2) return <Medal className="w-4 h-4 text-[var(--color-text-muted)]" />;
  return <Award className="w-4 h-4 text-[var(--color-orange)]" />;
}

export default function ManagerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get("/manager/dashboard")
      .then(res => { if (res?.data) setData(res.data); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title="Team Dashboard"
        subtitle="Monitor your team performance and assignments."
      />

      {error && (
        <div className="card p-3 bg-[var(--color-warning-light)] border-[var(--color-warning)] text-sm text-[var(--color-warning)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* KPI Stats */}
      <AutoSkeleton isLoading={loading} type="stats">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Avg Score</span>
            <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="stat-value">{data?.teamAvgScore?.current ?? "-"}</div>
          {data?.teamAvgScore?.delta !== undefined && (
            <p className={`flex items-center gap-1 text-xs mt-1 ${data.teamAvgScore.delta >= 0 ? "stat-delta-up" : "stat-delta-down"}`}>
              {data.teamAvgScore.delta >= 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {Math.abs(data.teamAvgScore.delta)} vs last week
            </p>
          )}
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Completion Rate</span>
            <CheckCircle2 className="w-4 h-4 text-[var(--color-success)]" />
          </div>
          <div className="stat-value">
            {data?.teamCompletionRate ?? "-"}
            <span className="text-lg font-normal text-[var(--color-text-muted)]">%</span>
          </div>
          <div className="w-full progress-bar mt-2">
            <div className="progress-fill bg-[var(--color-success)]" style={{ width: `${data?.teamCompletionRate ?? 0}%` }} />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Active Sessions</span>
            <PlayCircle className="w-4 h-4 text-[var(--color-purple)]" />
          </div>
          <div className="stat-value">{data?.activeSessions ?? 0}</div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-2">
            <span className="stat-label">Due Date Alerts</span>
            <AlertCircle className="w-4 h-4 text-[var(--color-warning)]" />
          </div>
          <div className="stat-value text-[var(--color-warning)]">{data?.dueDateAlerts?.length ?? 0}</div>
        </div>
        </div>
      </AutoSkeleton>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top 3 Leaderboard */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">
              Top Performers
            </h2>
            <Link href="/manager/analytics" className="text-xs text-[var(--color-accent)] hover:underline">
              Full Leaderboard →
            </Link>
          </div>
          {data?.top3Ranking?.length ? (
            <div className="divide-y divide-[var(--color-border)]">
              {data.top3Ranking.map((row) => (
                <div key={row.userId} className="flex items-center gap-3 py-2.5">
                  {/* Rank badge */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    row.rank === 1 ? "bg-[var(--color-warning-light)] text-[var(--color-warning)]" :
                    row.rank === 2 ? "bg-[var(--color-bg)] text-[var(--color-text-muted)]" :
                    "bg-[var(--color-orange-light)] text-[var(--color-orange)]"
                  }`}>
                    {row.rank}
                  </span>
                  {/* Icon */}
                  <RankIcon rank={row.rank} />
                  {/* Initial avatar */}
                  <div className="w-7 h-7 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {row.name.charAt(0).toUpperCase()}
                  </div>
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{row.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">SAW {(row.sawScore * 100).toFixed(0)}%</p>
                  </div>
                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold">{row.avgScore}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">avg</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No data yet</p>}
        </div>

        {/* Follow-up queue */}
        <div className="card p-4">
          <h2 className="font-semibold mb-3 text-sm">Coach Follow-ups</h2>
          {data?.followUpItems?.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center bg-[var(--color-bg)] rounded-lg border border-dashed border-[var(--color-border)]">
              <CheckCircle2 className="w-7 h-7 text-[var(--color-success)] mb-2 opacity-80" />
              <p className="text-sm font-medium text-[var(--color-text)]">No follow-ups needed</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">Scores, skills, and assignments are on track.</p>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {data?.followUpItems?.map(item => (
                <Link key={item.id} href={item.href} className="block p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg)] transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <span className={`text-[10px] font-semibold uppercase ${item.priority === 0 ? "text-[var(--color-danger)]" : item.priority === 1 ? "text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}`}>
                      {item.type === "score_drop" ? "Score drop" : item.type === "weakness" ? "Skill gap" : "Assignment"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{item.detail}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
