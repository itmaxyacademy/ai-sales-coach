"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { TrendingUp, Award, Target, BarChart3, CheckCircle2, XCircle, RefreshCw, History } from "lucide-react";
import { PageHeader, PeriodSwitcher, SearchInput, EmptyState, AutoSkeleton } from "../../../components/ui";
import { formatDate } from "@/lib/dateUtils";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface StatsData {
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  completionRate: number;
  improvementRate: number;
  deadlineRate: number;
  sawScore: number;
  sawRank: number | null;
  sawBreakdown: any;
  outcomeRate: { closed: number; follow_up: number; rejected: number };
}

interface ProgressData {
  scores: { sessionIndex?: number; score: number; outcome: string; completedAt: string }[];
  categoryTrends: { category: string; months: { month: string; avgScore: number }[] }[];
}

interface StrengthsData {
  strongest: { category: string; avgScore: number }[];
  weakest: { category: string; avgScore: number }[];
  recommendedCourses: { id: string; title: string; difficulty: string }[];
}

const scoreColor = (s: number) =>
  s >= 80
    ? "text-[var(--color-success)]"
    : s >= 60
    ? "text-[var(--color-warning)]"
    : "text-[var(--color-danger)]";

const PERIOD_OPTIONS = [
  { key: "7days", label: "7D" },
  { key: "30days", label: "30D" },
  { key: "90days", label: "90D" },
  { key: "alltime", label: "All" },
];

export default function KaryawanHistoryPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [strengths, setStrengths] = useState<StrengthsData | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [compareSelections, setCompareSelections] = useState<any[]>([]);
  const [historySearchInput, setHistorySearchInput] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("30days");

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      apiClient.get("/me/stats"),
      apiClient.get(`/me/progress?period=${period}`),
      apiClient.get("/me/strengths"),
    ]).then(([statsRes, progressRes, strengthsRes]) => {
      if (statsRes.status === "fulfilled") setStats(statsRes.value?.data ?? null);
      if (progressRes.status === "fulfilled") setProgress(progressRes.value?.data ?? null);
      if (strengthsRes.status === "fulfilled") setStrengths(strengthsRes.value?.data ?? null);
      setLoading(false);
    });
  }, [period]);

  useEffect(() => {
    setHistoryLoading(true);
    setHistoryError(null);
    const params = new URLSearchParams({ period, page: String(historyPage) });
    if (historySearch) params.set("search", historySearch);
    apiClient.get(`/sessions/history?${params}`)
      .then(res => {
        setSessions(res?.sessions ?? []);
        setHistoryTotal(res?.meta?.total ?? 0);
        setHistoryTotalPages(res?.meta?.totalPages ?? 1);
      })
      .catch(err => setHistoryError(getErrorMessage(err, "Gagal memuat riwayat sesi.")))
      .finally(() => setHistoryLoading(false));
  }, [period, historySearch, historyPage]);

  // Build chart data from scores
  const chartData = (progress?.scores ?? []).slice(-20).map((s, i) => ({
    name: `#${i + 1}`,
    score: s.score,
    outcome: s.outcome,
    date: s.completedAt
      ? formatDate(s.completedAt, { includeYear: false })
      : `#${i + 1}`,
  }));
  const compareIds = compareSelections.map(session => session.id);
  const comparedSessions = [...compareSelections]
    .sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
  const categoryScores = (session: any): { category: string; score: number }[] =>
    Array.isArray(session?.scoreBreakdown)
      ? session.scoreBreakdown.filter((item: any) => typeof item.category === "string" && typeof item.score === "number")
      : [];
  const comparedCategories = comparedSessions.length === 2
    ? Array.from(new Set(comparedSessions.flatMap(categoryScores).map(item => item.category))).map(category => {
        const first = categoryScores(comparedSessions[0]).find(item => item.category === category)?.score;
        const second = categoryScores(comparedSessions[1]).find(item => item.category === category)?.score;
        return { category, first, second, delta: first !== undefined && second !== undefined ? second - first : null };
      })
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="My Performance"
        subtitle="Your training history and progress analytics."
        // icon={<History className="w-4 h-4" />}
        actions={<PeriodSwitcher options={PERIOD_OPTIONS} value={period} onChange={value => { setPeriod(value); setHistoryPage(1); }} />}
      />

      {/* Top Stats - compact row */}
      <AutoSkeleton isLoading={loading} type="stats">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">Total Sessions</span>
            <BarChart3 className="w-3.5 h-3.5 text-[var(--color-accent)]" />
          </div>
          <div className="stat-value">{stats?.totalSessions ?? 0}</div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">completed</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">Avg Score</span>
            <Target className="w-3.5 h-3.5 text-[var(--color-success)]" />
          </div>
          <div className={`stat-value ${scoreColor(stats?.avgScore ?? 0)}`}>
            {stats?.avgScore ?? "-"}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            Best: {stats?.bestScore ?? "-"}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">Improvement</span>
            <TrendingUp className="w-3.5 h-3.5 text-[var(--color-purple)]" />
          </div>
          <div
            className={`stat-value ${
              (stats?.improvementRate ?? 0) >= 0
                ? "text-[var(--color-success)]"
                : "text-[var(--color-danger)]"
            }`}
          >
            {(stats?.improvementRate ?? 0) >= 0 ? "+" : ""}
            {stats?.improvementRate ?? 0}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">pts vs first 3</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center justify-between mb-1.5">
            <span className="stat-label">SAW Rank</span>
            <Award className="w-3.5 h-3.5 text-[var(--color-warning)]" />
          </div>
          <div className="stat-value">
            {stats?.sawRank ? `#${stats.sawRank}` : "-"}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            {Math.round((stats?.sawScore ?? 0) * 100)}% SAW score
          </p>
        </div>
      </div>
      </AutoSkeleton>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Score Trend Chart - recharts AreaChart */}
        <div className="card p-4 md:col-span-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
              Score Trend
            </h2>
          </div>
          {chartData.length === 0 ? (
            <EmptyState
              icon={<BarChart3 className="w-8 h-8" />}
              title="No sessions yet"
              description="Complete a roleplay session to see your score trend."
              action={
                <Link href="/karyawan/courses" className="btn btn-primary btn-sm">
                  Start first roleplay
                </Link>
              }
            />
          ) : (
            <AutoSkeleton isLoading={loading} type="chart">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  className="chart-glow"
                  data={chartData}
                  margin={{ top: 6, right: 6, left: -24, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-surface)",
                      borderColor: "var(--color-border)",
                      borderRadius: "8px",
                      fontSize: "11px",
                      color: "var(--color-text)",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value) => [`${value} pts`, "Score"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#scoreGrad)"
                    dot={{ fill: "var(--color-accent)", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "var(--color-accent)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            </AutoSkeleton>
          )}
        </div>

        {/* Strengths & Weaknesses */}
        <div className="card p-4 md:col-span-2">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-[var(--color-warning)]" />
            Strengths & Gaps
          </h2>
          {!strengths?.strongest?.length && !strengths?.weakest?.length ? (
            <EmptyState
              icon={<Award className="w-7 h-7" />}
              title="Not enough data"
              description="Complete more sessions to see insights."
              action={
                <Link href="/karyawan/courses" className="btn btn-secondary btn-sm">
                  Browse scenarios
                </Link>
              }
            />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-[var(--color-success)] mb-2 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Top Skills
                </p>
                <div className="space-y-1.5">
                  {strengths?.strongest?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--color-text-muted)] w-24 truncate capitalize">
                        {s.category.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 progress-bar">
                        <div
                          className="progress-fill progress-fill-green"
                          style={{ width: `${s.avgScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-7 text-right">{s.avgScore}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[var(--color-danger)] mb-2 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Areas to Improve
                </p>
                <div className="space-y-1.5">
                  {strengths?.weakest?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--color-text-muted)] w-24 truncate capitalize">
                        {s.category.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 progress-bar">
                        <div
                          className="progress-fill progress-fill-red"
                          style={{ width: `${s.avgScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-7 text-right">{s.avgScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {comparedSessions.length > 0 && (
        <div className="card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-sm">Compare Attempts</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{comparedSessions[0].course?.title}</p>
            </div>
            <button onClick={() => setCompareSelections([])} className="btn btn-secondary btn-xs">Clear</button>
          </div>
          {comparedSessions.length < 2 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Select one more session from this course.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Metric</th><th>Earlier attempt</th><th>Later attempt</th><th>Change</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="font-medium">Total score</td>
                    <td>{comparedSessions[0].totalScore ?? "-"}</td>
                    <td>{comparedSessions[1].totalScore ?? "-"}</td>
                    <td>{comparedSessions[0].totalScore != null && comparedSessions[1].totalScore != null ? `${comparedSessions[1].totalScore - comparedSessions[0].totalScore > 0 ? "+" : ""}${comparedSessions[1].totalScore - comparedSessions[0].totalScore}` : "-"}</td>
                  </tr>
                  {comparedCategories.map(item => (
                    <tr key={item.category}>
                      <td className="font-medium capitalize">{item.category.replace(/_/g, " ")}</td>
                      <td>{item.first ?? "-"}</td>
                      <td>{item.second ?? "-"}</td>
                      <td>{item.delta === null ? "-" : `${item.delta > 0 ? "+" : ""}${item.delta}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Session History Table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-sm">Session History</h2>
          <span className="text-[10px] text-[var(--color-text-muted)]">{historyTotal} sessions</span>
        </div>
        <form className="p-4 flex flex-col sm:flex-row gap-2 border-b border-[var(--color-border)]" onSubmit={event => { event.preventDefault(); setHistoryPage(1); setHistorySearch(historySearchInput.trim()); }}>
          <SearchInput value={historySearchInput} onChange={setHistorySearchInput} placeholder="Cari course atau kategori..." className="flex-1" />
          <button type="submit" className="btn btn-primary btn-sm">Cari</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setHistorySearchInput(""); setHistorySearch(""); setHistoryPage(1); }}>Reset</button>
        </form>
        {historyLoading ? (
          <p className="p-6 text-sm text-[var(--color-text-muted)]">Memuat riwayat sesi...</p>
        ) : historyError ? (
          <p role="alert" className="p-6 text-sm text-[var(--color-danger)]">{historyError}</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<RefreshCw className="w-8 h-8" />}
            title={historySearch ? "Sesi tidak ditemukan" : "Belum ada sesi pada periode ini"}
            description={historySearch ? "Ubah kata pencarian atau reset filter." : "Mulai roleplay untuk mengisi riwayat latihan."}
            action={
              <Link href="/karyawan/courses" className="btn btn-primary btn-sm">
                Start roleplay
              </Link>
            }
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Score</th>
                  <th>Outcome</th>
                  <th>Turns</th>
                  <th>Date</th>
                  <th>Compare</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.course?.title ?? "-"}</td>
                    <td>
                      <span className={`font-bold text-sm ${scoreColor(s.totalScore ?? 0)}`}>
                        {s.totalScore ?? "-"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          s.outcome === "closed"
                            ? "badge-green"
                            : s.outcome === "follow_up"
                            ? "badge-yellow"
                            : "badge-red"
                        } capitalize`}
                      >
                        {s.outcome?.replace("_", " ") ?? "-"}
                      </span>
                    </td>
                    <td className="text-[var(--color-text-muted)]">{s.turnCount}</td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                      {formatDate(s.completedAt)}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Compare ${s.course?.title ?? "course"} session from ${formatDate(s.completedAt)}`}
                        checked={compareIds.includes(s.id)}
                        disabled={(!compareIds.includes(s.id) && compareIds.length >= 2) || (compareIds.length === 1 && compareSelections[0]?.course?.id !== s.course?.id)}
                        onChange={() => setCompareSelections(current => {
                          const existingIndex = current.findIndex(session => session.id === s.id);
                          if (existingIndex >= 0) return current.filter(session => session.id !== s.id);
                          if (current.length >= 2 || (current.length === 1 && current[0].course?.id !== s.course?.id)) return current;
                          return [...current, s];
                        })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!historyLoading && !historyError && historyTotalPages > 1 && <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--color-border)]"><span className="text-xs text-[var(--color-text-muted)]">{(historyPage - 1) * 20 + 1}–{Math.min(historyPage * 20, historyTotal)} dari {historyTotal} sesi</span><div className="flex items-center gap-2"><button className="btn btn-secondary btn-sm" disabled={historyPage <= 1} onClick={() => setHistoryPage(page => page - 1)}>Sebelumnya</button><span className="text-xs text-[var(--color-text-muted)]">{historyPage} / {historyTotalPages}</span><button className="btn btn-secondary btn-sm" disabled={historyPage >= historyTotalPages} onClick={() => setHistoryPage(page => page + 1)}>Berikutnya</button></div></div>}
      </div>
    </div>
  );
}
