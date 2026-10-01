"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line
} from "recharts";
import { TrendingUp, Sparkles, AlertCircle, BookOpen, ChevronRight, Activity } from "lucide-react";
import Link from "next/link";
import { AutoSkeleton } from "../../../components/ui";

interface ProgressData {
  scores: { sessionId: string; score: number; outcome: string; completedAt: string | null }[];
  categoryTrends: { category: string; months: { month: string; avgScore: number }[] }[];
  improvementChart: { sessionIndex: number; rollingAvg: number }[];
}

interface StrengthsData {
  strongest: { category: string; avgScore: number; sampleCount: number }[];
  weakest: { category: string; avgScore: number; sampleCount: number }[];
  recommendedCourses: { id: string; title: string; difficulty: string; category: string }[];
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [strengths, setStrengths] = useState<StrengthsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("30days");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      apiClient.get(`/me/progress?period=${period}`),
      apiClient.get("/me/strengths"),
    ]).then(([progRes, strengthRes]) => {
      if (progRes.status === "fulfilled" && progRes.value?.data) setProgress(progRes.value.data);
      if (strengthRes.status === "fulfilled" && strengthRes.value?.data) setStrengths(strengthRes.value.data);
      setLoading(false);
    }).catch(err => {
      setError(getErrorMessage(err, "Terjadi kesalahan."));
      setLoading(false);
    });
  }, [period]);

  const difficultyColor: Record<string, string> = {
    Beginner: "badge-green", Intermediate: "badge-yellow", Advanced: "badge-red"
  };
  const categoryColors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];
  const categoryChart = (progress?.categoryTrends ?? []).reduce<{ month: string; [key: string]: string | number }[]>((rows, trend, index) => {
    for (const point of trend.months) {
      let row = rows.find(item => item.month === point.month);
      if (!row) {
        row = { month: point.month };
        rows.push(row);
      }
      row[`skill${index}`] = point.avgScore;
    }
    return rows;
  }, []).sort((a, b) => String(a.month).localeCompare(String(b.month)));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {/* <Activity className="w-6 h-6 text-[var(--color-accent)] animate-pulse" />  */}
            Your Progress Tracker
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-0.5">Visualize your score trends, rolling average improvement, and category analysis.</p>
        </div>
        
        {/* Period Switcher */}
        <div className="flex items-center gap-1.5 bg-[var(--color-bg)] border border-[var(--color-border)] p-1 rounded-xl self-start sm:self-auto">
          {[
            { key: "7days", label: "7 Days" },
            { key: "30days", label: "30 Days" },
            { key: "90days", label: "90 Days" },
            { key: "alltime", label: "All-Time" }
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                period === p.key 
                  ? "bg-[var(--color-accent)] text-white shadow-sm font-bold" 
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--color-danger-light)]/20 border border-[var(--color-danger)]/30 rounded-xl text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Recharts Charts Grid */}
      <AutoSkeleton isLoading={loading} type="card">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rolling Avg Card */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" /> Rolling Average Improvement
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">Past 5 sessions window</span>
          </div>
          {progress?.improvementChart && progress.improvementChart.length > 0 ? (
            <AutoSkeleton isLoading={loading} type="chart">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progress.improvementChart} className="chart-glow" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="improveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="sessionIndex" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)',
                      borderRadius: '12px',
                      color: 'var(--color-text)',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="rollingAvg" 
                    name="Rolling Avg Score"
                    stroke="var(--color-accent)" 
                    strokeWidth={3} 
                    fill="url(#improveGrad)"
                    dot={{ fill: 'var(--color-accent)', strokeWidth: 2 }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </AutoSkeleton>
          ) : (
            <div className="flex items-center justify-center h-64 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg)]/40 rounded-xl">
              Not enough completed sessions data.
            </div>
          )}
        </div>

        {/* Score History card */}
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-success)]" /> Session Score History
            </h2>
            <span className="text-xs text-[var(--color-text-muted)]">Chronological order</span>
          </div>
          {progress?.scores && progress.scores.length > 0 ? (
            <AutoSkeleton isLoading={loading} type="chart">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={progress.scores.map((s, idx) => ({ ...s, index: idx + 1 }))} 
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="index" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--color-card)', 
                      borderColor: 'var(--color-border)',
                      borderRadius: '12px',
                      color: 'var(--color-text)',
                      fontSize: '12px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="score" 
                    name="Session Score"
                    stroke="var(--color-success)" 
                    strokeWidth={3} 
                    fill="url(#scoreGrad)"
                    dot={{ fill: 'var(--color-success)', strokeWidth: 2 }} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </AutoSkeleton>
          ) : (
            <div className="flex items-center justify-center h-64 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg)]/40 rounded-xl">
              Complete sessions to start tracking history.
            </div>
          )}
        </div>
      </div>
      </AutoSkeleton>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" /> Skill Score Trends
        </h2>
        {categoryChart.length === 0 ? (
          <p className="flex items-center justify-center h-48 text-xs text-[var(--color-text-muted)] bg-[var(--color-bg)]/40 rounded-xl">
            Complete sessions with scored skills to see category trends.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={categoryChart} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="month" tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--color-text-muted)", fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--color-card)", borderColor: "var(--color-border)", borderRadius: "12px", color: "var(--color-text)", fontSize: "12px" }} />
                <Legend />
                {progress?.categoryTrends.map((trend, index) => (
                  <Line key={trend.category} type="monotone" dataKey={`skill${index}`} name={trend.category.replace(/_/g, " ")} stroke={categoryColors[index % categoryColors.length]} connectNulls dot={{ r: 2 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Strengths & Weaknesses Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Strongest */}
        <div className="card p-5 space-y-4 border-t-4 border-[var(--color-success)]">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-success)]" /> Strongest Competencies
          </h2>
          {strengths?.strongest && strengths.strongest.length > 0 ? (
            <div className="space-y-3">
              {strengths.strongest.map((c) => (
                <div key={c.category} className="flex justify-between items-center p-3 rounded-lg bg-[var(--color-bg)]/40 border border-[var(--color-border)]/50">
                  <div>
                    <p className="text-sm font-semibold">{c.category}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Based on {c.sampleCount} sessions</p>
                  </div>
                  <span className="text-sm font-black text-[var(--color-success)]">{c.avgScore}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">No strength analytics generated yet.</p>
          )}
        </div>

        {/* Weakest */}
        <div className="card p-5 space-y-4 border-t-4 border-[var(--color-danger)]">
          <h2 className="font-semibold text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[var(--color-danger)]" /> Areas for Improvement
          </h2>
          {strengths?.weakest && strengths.weakest.length > 0 ? (
            <div className="space-y-3">
              {strengths.weakest.map((c) => (
                <div key={c.category} className="flex justify-between items-center p-3 rounded-lg bg-[var(--color-bg)]/40 border border-[var(--color-border)]/50">
                  <div>
                    <p className="text-sm font-semibold">{c.category}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Based on {c.sampleCount} sessions</p>
                  </div>
                  <span className="text-sm font-black text-[var(--color-danger)]">{c.avgScore}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">No weakness analytics generated yet.</p>
          )}
        </div>
      </div>

      {/* Recommended Courses Card */}
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--color-accent)]" /> Recommended Training for Weaknesses
        </h2>
        {(!strengths?.recommendedCourses || strengths.recommendedCourses.length === 0) ? (
          <p className="text-xs text-[var(--color-text-muted)] border border-dashed border-[var(--color-border)] rounded-xl p-6 text-center">
            You don't have enough session data for us to recommend specific training courses yet. Keep practicing!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {strengths.recommendedCourses.map((c) => (
              <Link 
                key={c.id} 
                href={`/karyawan/courses/${c.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)] transition-all duration-200"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.title}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1 capitalize">{c.category}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] font-semibold text-[var(--color-accent)] bg-[var(--color-accent-light)] px-2 py-0.5 rounded-full capitalize">{c.difficulty}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)]" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}