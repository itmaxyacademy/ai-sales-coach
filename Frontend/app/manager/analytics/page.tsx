"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { BarChart3, TrendingUp, TrendingDown, Award, BookOpen, AlertCircle, Medal, Trophy, Link as LinkIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader, PeriodSwitcher, EmptyState, AutoSkeleton } from "../../../components/ui";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface Overview { avgScore: number; outcomeRate: number; completionRate: number; }
interface Comparison { avgScore: number; outcomeRate: number; completionRate: number; }
interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  sawScore: number;
  avgScore: number;
  completionRate: number;
  outcomeRate: number;
  sawBreakdown?: {
    c1_avgScore: number;
    c2_outcomeRate: number;
    c3_improvementRate: number;
    c4_completionRate: number;
    c5_deadlineRate: number;
  };
}
interface CourseAnalytics { id: string; title: string; totalSessions: number; avgScore: number; outcomeRate: number; abandonRate: number; completionRate: number; }
interface TrendData { week: string; avgScore: number; outcomeRate: number; }
interface CategoryTrend { category: string; weeks: { week: string; avgScore: number }[]; }
interface WeaknessData { category: string; avgScore: number; weakPercentage: number; }

const delta = (curr: number, prev: number) => {
  const d = curr - prev;
  return d >= 0
    ? <span className="stat-delta-up flex items-center gap-1"><TrendingUp className="w-3 h-3" /> {Math.abs(d)} vs last wk</span>
    : <span className="stat-delta-down flex items-center gap-1"><TrendingDown className="w-3 h-3" /> {Math.abs(d)} vs last wk</span>;
};

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="w-3.5 h-3.5 text-amber-500" />;
  if (rank === 2) return <Medal className="w-3.5 h-3.5 text-slate-400" />;
  if (rank === 3) return <Award className="w-3.5 h-3.5 text-amber-700" />;
  return <span className="text-[var(--color-text-muted)] font-bold text-xs">#{rank}</span>;
};

const scoreColor = (s: number) => s >= 80 ? "text-[var(--color-success)]" : s >= 60 ? "text-[var(--color-warning)]" : "text-[var(--color-danger)]";

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<"overview" | "courses" | "trends" | "weaknesses">("overview");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [courses, setCourses] = useState<CourseAnalytics[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [categoryTrends, setCategoryTrends] = useState<CategoryTrend[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessData[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>("30days");
  const [scope, setScope] = useState<"all" | "team">("team");

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (activeTab === "overview") {
      Promise.allSettled([
        apiClient.get(`/manager/dashboard?scope=${scope}`),
        apiClient.get(`/manager/team?scope=${scope}`)
      ]).then(([dashboardRes, teamRes]) => {
        if (dashboardRes.status === "fulfilled" && dashboardRes.value?.data) {
          const d = dashboardRes.value.data;
          setOverview({
            avgScore: d.teamAvgScore?.current ?? 0,
            outcomeRate: 0, // not in dashboard
            completionRate: d.teamCompletionRate ?? 0
          });
          setComparison({
            avgScore: (d.teamAvgScore?.current ?? 0) - (d.teamAvgScore?.delta ?? 0),
            outcomeRate: 0,
            completionRate: 0
          });
        } else setError("Failed to load overview data.");
        if (teamRes.status === "fulfilled" && teamRes.value?.data) {
          // Calculate leaderboard from team data
          const sorted = teamRes.value.data.sort((a: any, b: any) => b.sawScore - a.sawScore);
          setLeaderboard(sorted.map((u: any, i: number) => ({
            rank: i + 1,
            userId: u.id,
            name: u.name,
            sawScore: u.sawScore,
            avgScore: u.avgScore,
            completionRate: u.completionRate,
            outcomeRate: u.sawBreakdown?.c2_outcomeRate ?? 0,
            sawBreakdown: u.sawBreakdown
          })));
        }
        setLoading(false);
      });
    } else if (activeTab === "courses") {
      apiClient.get(`/manager/analytics/courses?scope=${scope}`)
        .then(res => { 
          const coursesList = res?.data?.courses || res?.courses || [];
          if (Array.isArray(coursesList) && coursesList.length > 0) {
            setCourses(coursesList);
          } else if (!Array.isArray(coursesList)) {
            setError("Failed to load courses: invalid data format");
          } else {
            setCourses([]);
          }
        })
        .catch(err => setError(getErrorMessage(err, "Failed to load courses")))
        .finally(() => setLoading(false));
    } else if (activeTab === "trends") {
      apiClient.get(`/manager/analytics/trends?period=${period}&scope=${scope}`)
        .then(res => { 
          const trendsList = res?.data?.weeklyTrends || res?.weeklyTrends || [];
          setCategoryTrends(res?.data?.categoryTrends || []);
          if (Array.isArray(trendsList) && trendsList.length > 0) {
            setTrends(trendsList);
          } else if (!Array.isArray(trendsList)) {
            setError("Failed to load trends: invalid data format");
          } else {
            setTrends([]);
          }
        })
        .catch(err => setError(getErrorMessage(err, "Failed to load trends")))
        .finally(() => setLoading(false));
    } else if (activeTab === "weaknesses") {
      apiClient.get(`/manager/analytics/weaknesses?scope=${scope}`)
        .then(res => { 
          const weaknessesList = res?.data?.weaknesses || res?.weaknesses || [];
          if (Array.isArray(weaknessesList) && weaknessesList.length > 0) {
            setWeaknesses(weaknessesList);
          } else if (!Array.isArray(weaknessesList)) {
            setError("Failed to load weaknesses: invalid data format");
          } else {
            setWeaknesses([]);
          }
        })
        .catch(err => setError(getErrorMessage(err, "Failed to load weaknesses")))
        .finally(() => setLoading(false));
    }
  }, [activeTab, period, scope]);

  const categoryColors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];
  const categoryChart = Array.from(new Set(categoryTrends.flatMap(trend => trend.weeks.map(item => item.week))))
    .sort()
    .map(week => Object.assign({ week }, ...categoryTrends.map((trend, index) => {
      const value = trend.weeks.find(item => item.week === week)?.avgScore;
      return value === undefined ? {} : { [`skill${index}`]: value };
    })));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Team Analytics"
        subtitle="Comprehensive team performance metrics and insights."
        // icon={<BarChart3 className="w-4 h-4" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Scope:</span>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 flex items-center">
              <button 
                onClick={() => setScope("all")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${scope === "all" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
              >
                All Karyawan
              </button>
              <button 
                onClick={() => setScope("team")}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${scope === "team" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
              >
                My Team Only
              </button>
            </div>
          </div>
        }
      />

      <div className="flex border-b border-[var(--color-border)] gap-0 overflow-x-auto">
        {[
          { id: "overview", label: "Overview & SAW", icon: Award },
          { id: "courses", label: "Course Engagement", icon: BookOpen },
          { id: "trends", label: "Score Trends", icon: TrendingUp },
          { id: "weaknesses", label: "Competency Gaps", icon: AlertCircle }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 font-medium text-xs flex items-center gap-1.5 border-b-2 transition-colors whitespace-nowrap -mb-px ${
              activeTab === tab.id ? "border-[var(--color-accent)] text-[var(--color-accent)] font-semibold" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <AutoSkeleton isLoading={loading} type="card">
      {error ? (
        <div className="card p-8 text-center text-[var(--color-danger)]">{error}</div>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="stat-label">Avg Score (This Week)</span>
                    <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" />
                  </div>
                  <div className={`stat-value ${scoreColor(overview?.avgScore ?? 0)}`}>{overview?.avgScore ?? "-"}</div>
                  {overview && comparison && delta(overview.avgScore, comparison.avgScore)}
                </div>
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="stat-label">Completion Rate</span>
                    <TrendingUp className="w-4 h-4 text-[var(--color-purple)]" />
                  </div>
                  <div className="stat-value">{overview?.completionRate ?? "-"}<span className="text-lg font-normal text-[var(--color-text-muted)]">%</span></div>
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-[var(--color-warning)]" />
                    SAW Leaderboard
                  </h2>
                  <Link href="/manager/leaderboard/config" className="text-xs text-[var(--color-accent)] hover:underline">
                    Configure Weights →
                  </Link>
                </div>
                {leaderboard.length === 0 ? (
                  <EmptyState icon={<Award className="w-8 h-8" />} title="No data yet" description="Team data will appear once sessions are completed." />
                ) : (
                  <div className="table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Name</th>
                          <th>SAW Score</th>
                          <th>Avg Score (C1)</th>
                          <th>Outcome (C2)</th>
                          <th>Improvement (C3)</th>
                          <th>Completion (C4)</th>
                          <th>On-Time (C5)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map(row => (
                          <tr key={row.userId}>
                            <td>
                              <div className="flex items-center gap-1.5">
                                {rankIcon(row.rank)}
                                <span className="text-[10px] font-bold text-[var(--color-text-muted)]">#{row.rank}</span>
                              </div>
                            </td>
                            <td>
                              <Link href={`/manager/team/${row.userId}`} className="font-semibold text-xs text-[var(--color-text)] hover:text-[var(--color-accent)] truncate max-w-[120px] block">
                                {row.name}
                              </Link>
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 progress-bar h-1.5"><div className="progress-fill bg-[var(--color-accent)]" style={{ width: `${(row.sawScore * 100).toFixed(0)}%` }} /></div>
                                <span className="text-[10px] font-bold">{(row.sawScore * 100).toFixed(0)}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`font-bold text-xs ${scoreColor(row.sawBreakdown?.c1_avgScore ?? row.avgScore)}`}>
                                {Math.round(row.sawBreakdown?.c1_avgScore ?? row.avgScore)}
                              </span>
                            </td>
                            <td className="text-xs font-medium">
                              {row.sawBreakdown?.c2_outcomeRate !== undefined ? `${Math.round(row.sawBreakdown.c2_outcomeRate)}%` : "-"}
                            </td>
                            <td className="text-xs font-medium">
                              {row.sawBreakdown?.c3_improvementRate !== undefined ? `${Math.round(row.sawBreakdown.c3_improvementRate)}%` : "-"}
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5">
                                <div className="w-12 progress-bar h-1.5">
                                  <div className={`progress-fill ${row.completionRate >= 80 ? "progress-fill-green" : row.completionRate >= 50 ? "" : "progress-fill-red"}`} style={{ width: `${row.completionRate}%` }} />
                                </div>
                                <span className="text-[10px] font-semibold">{row.completionRate}%</span>
                              </div>
                            </td>
                            <td className="text-xs font-medium">
                              {row.sawBreakdown?.c5_deadlineRate !== undefined ? `${Math.round(row.sawBreakdown.c5_deadlineRate)}%` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "courses" && (
            <div className="card">
              {courses.length === 0 ? (
                <div className="p-12 text-center text-[var(--color-text-muted)]">No courses found.</div>
              ) : courses && Array.isArray(courses) ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr><th>Course</th><th>Sessions</th><th>Avg Score</th><th>Outcome Rate (Closed)</th><th>Abandon Rate</th></tr>
                    </thead>
                    <tbody>
                      {courses.length > 0 ? courses.map(c => (
                        <tr key={c.id}>
                          <td className="font-medium">{c.title}</td>
                          <td>{c.totalSessions} plays</td>
                          <td><span className={`font-bold ${scoreColor(c.avgScore)}`}>{c.avgScore}</span></td>
                          <td>{c.outcomeRate}%</td>
                          <td className={c.abandonRate > 20 ? "text-[var(--color-danger)]" : ""}>{c.abandonRate}%</td>
                        </tr>
                      )) : (
                        <tr><td colSpan={5} className="text-center text-[var(--color-text-muted)] py-8">No course data available</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-12 text-center text-[var(--color-text-muted)]">Failed to load course data</div>
              )}
            </div>
          )}

          {activeTab === "trends" && (
            <div className="space-y-4">
            <div className="card p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" /> Weekly Score Trends
                </h2>
                <PeriodSwitcher
                  options={[
                    { key: "7days", label: "7D" },
                    { key: "30days", label: "30D" },
                    { key: "90days", label: "90D" },
                    { key: "alltime", label: "All" }
                  ]}
                  value={period}
                  onChange={setPeriod}
                />
              </div>
              {trends.length === 0 ? (
                <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="Not enough data" description="Score trends will appear after more sessions." />
              ) : (
                <AutoSkeleton isLoading={loading} type="chart">
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trends} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis
                        dataKey="week"
                        tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
                        tickLine={false} axisLine={false}
                        tickFormatter={(str) => { try { return new Date(str).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return str; } }}
                      />
                      <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(v) => [`${v} pts`, "Avg Score"]}
                      />
                      <Area type="monotone" dataKey="avgScore" stroke="var(--color-accent)" strokeWidth={2} fill="url(#trendGrad)" dot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                </AutoSkeleton>
              )}
            </div>
            <div className="card p-4">
              <h2 className="font-semibold text-sm flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-[var(--color-accent)]" /> Weekly Skill Trends
              </h2>
              {categoryChart.length === 0 ? (
                <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No skill trend data" description="Category trends will appear after scored sessions." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={categoryChart} margin={{ top: 6, right: 10, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                      <XAxis dataKey="week" tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px", fontSize: "11px" }} formatter={(value) => [`${value} pts`, "Avg Score"]} />
                      {categoryTrends.map((trend, index) => (
                        <Area key={trend.category} type="monotone" dataKey={`skill${index}`} name={trend.category.replace(/_/g, " ")} stroke={categoryColors[index % categoryColors.length]} fill="none" connectNulls />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
            </div>
          )}

          {activeTab === "weaknesses" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {weaknesses.length === 0 ? (
                <div className="col-span-full p-12 text-center text-[var(--color-text-muted)] card">No competency gaps detected yet.</div>
              ) : weaknesses.map((w, i) => (
                <div key={i} className="card p-5 border-l-4 border-l-[var(--color-warning)]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-[var(--color-text)] capitalize">{w.category.replace(/_/g, " ")}</h3>
                    <span className="badge badge-yellow">{w.weakPercentage}% Team Struggling</span>
                  </div>
                  <div className="flex justify-between items-end border-t border-[var(--color-border)] pt-3 mt-4">
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Average Score</p>
                      <p className={`text-xl font-black leading-none ${scoreColor(w.avgScore)}`}>{w.avgScore}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </AutoSkeleton>
    </div>
  );
}
