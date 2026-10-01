"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore } from "../../../store/authStore";
import {
  PlayCircle,
  Clock,
  CheckCircle2,
  BookOpen,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Award,
  Flame,
  BarChart2,
  Target,
  Zap,
  RefreshCw,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { PageHeader, EmptyState, AutoSkeleton } from "../../../components/ui";

interface DashboardData {
  pendingAssignments: {
    id: string;
    courseId: string;
    courseTitle: string;
    difficulty: string;
    category: string;
    status: string;
    dueAt: string | null;
  }[];
  avgScoreThisWeek: number | null;
  rankingPosition: number | null;
  lastSession: {
    courseTitle: string;
    score: number;
    outcome: string;
    completedAt: string;
  } | null;
  streakDays: number;
}

interface StatsData {
  totalSessions: number;
  avgScore: number;
  bestScore: number;
  completionRate: number;
  outcomeRate: { closed: number; follow_up: number; rejected: number };
  sawScore: number;
  sawRank: number | null;
}

const difficultyColor: Record<string, string> = {
  Beginner: "badge-green",
  Intermediate: "badge-yellow",
  Advanced: "badge-red",
};

const outcomeColor: Record<string, string> = {
  closed: "text-[var(--color-success)] bg-[var(--color-success-light)]",
  follow_up: "text-[var(--color-warning)] bg-[var(--color-warning-light)]",
  rejected: "text-[var(--color-danger)] bg-[var(--color-danger-light)]",
};

const outcomeIcon: Record<string, React.ReactNode> = {
  closed: <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />,
  follow_up: <RefreshCw className="w-3.5 h-3.5 flex-shrink-0" />,
  rejected: <XCircle className="w-3.5 h-3.5 flex-shrink-0" />,
};

export default function KaryawanDashboard() {
  const { user } = useAuthStore();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any | null>(null);
  const [pendingAssignmentsRaw, setPendingAssignmentsRaw] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiClient.get("/me/dashboard"),
      apiClient.get("/me/stats"),
      apiClient.get("/courses"),
      apiClient.get("/me/stats/weekly"),
      apiClient.get("/assignments"),
    ]).then(([dashRes, statsRes, coursesRes, weeklyRes, assignRes]) => {
      if (dashRes.status === "fulfilled" && dashRes.value?.data)
        setDashboard(dashRes.value.data);
      if (statsRes.status === "fulfilled" && statsRes.value?.data)
        setStats(statsRes.value.data);
      if (coursesRes.status === "fulfilled" && coursesRes.value?.courses)
        setCourses(coursesRes.value.courses.slice(0, 3));
      if (weeklyRes.status === "fulfilled" && weeklyRes.value?.data)
        setWeeklyStats(weeklyRes.value.data);
      if (assignRes.status === "fulfilled" && assignRes.value?.assignments) {
        const pending = assignRes.value.assignments
          .filter((a: any) => a.status !== "completed")
          .slice(0, 5);
        setPendingAssignmentsRaw(pending);
      }
      setLoading(false);
    });
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Track your training progress."
        actions={
          <Link href="/karyawan/history" className="btn btn-secondary btn-sm">
            View History
          </Link>
        }
      />

      {/* KPI Stats Row */}
      <AutoSkeleton isLoading={loading} type="stats">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="stat-label">Total Sessions</span>
              <BarChart2 className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            <div className="stat-value">{stats?.totalSessions ?? 0}</div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              completed
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="stat-label">Avg Score</span>
              <Target className="w-4 h-4 text-[var(--color-success)]" />
            </div>
            <div
              className={`stat-value ${(stats?.avgScore ?? 0) >= 80 ? "text-[var(--color-success)]" : (stats?.avgScore ?? 0) >= 60 ? "text-[var(--color-warning)]" : "text-[var(--color-danger)]"}`}
            >
              {stats?.avgScore ?? "-"}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              best: {stats?.bestScore ?? "-"}
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="stat-label">This Week</span>
              <Zap className="w-4 h-4 text-[var(--color-warning)]" />
            </div>
            <div className="stat-value">
              {dashboard?.avgScoreThisWeek ?? "-"}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              avg score
            </p>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-1.5">
              <span className="stat-label">Streak</span>
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div className="stat-value text-orange-400">
              {dashboard?.streakDays ?? 0}
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              days active
            </p>
          </div>
        </div>
      </AutoSkeleton>

      {/* SAW Rank + Outcome + Weekly Progress */}
      <AutoSkeleton isLoading={loading} type="stat-row">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* SAW Rank */}
          <div className="stat-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="stat-label">SAW Rank</span>
              <Award className="w-4 h-4 text-[var(--color-warning)]" />
            </div>
            <div className="text-4xl font-black">
              {stats?.sawRank ? `#${stats.sawRank}` : "-"}
            </div>
            <div className="w-full progress-bar">
              <div
                className="progress-fill bg-[var(--color-accent)]"
                style={{
                  width: `${Math.round((stats?.sawScore ?? 0) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              SAW Score: {Math.round((stats?.sawScore ?? 0) * 100)}%
            </p>
          </div>

          {/* Outcome Distribution */}
          <div className="stat-card flex flex-col gap-2">
            <span className="stat-label">Outcome Distribution</span>
            {stats?.totalSessions === 0 ? (
              <EmptyState
                icon={<Target className="w-7 h-7" />}
                title="No outcomes yet"
                description="Complete your first roleplay to see closed, follow-up, and rejected rates."
                action={
                  <Link
                    href="/karyawan/courses"
                    className="btn btn-secondary btn-sm"
                  >
                    Start roleplay
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2 mt-0.5">
                {[
                  {
                    key: "closed",
                    label: "Closed",
                    color: "bg-[var(--color-success)]",
                  },
                  {
                    key: "follow_up",
                    label: "Follow-up",
                    color: "bg-[var(--color-warning)]",
                  },
                  {
                    key: "rejected",
                    label: "Rejected",
                    color: "bg-[var(--color-danger)]",
                  },
                ].map(({ key, label, color }) => {
                  const pct = (stats?.outcomeRate as any)?.[key] ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[10px] w-14 text-[var(--color-text-muted)] truncate">
                        {label}
                      </span>
                      <div className="flex-1 progress-bar">
                        <div
                          className={`progress-fill ${color}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold w-7 text-right">
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Progress */}
          <div className="stat-card flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="stat-label">Weekly Progress</span>
              <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
            </div>
            {weeklyStats ? (
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      Avg Score
                    </p>
                    <p className="text-lg font-bold leading-tight">
                      {weeklyStats.thisWeek.avgScore ?? "-"}{" "}
                      <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
                        vs {weeklyStats.lastWeek.avgScore ?? "-"}
                      </span>
                    </p>
                  </div>
                  {weeklyStats.delta.avgScore !== null && (
                    <span
                      className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                        weeklyStats.delta.trend === "up"
                          ? "bg-[var(--color-success-light)] text-[var(--color-success)]"
                          : weeklyStats.delta.trend === "down"
                            ? "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
                            : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {weeklyStats.delta.trend === "up" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : weeklyStats.delta.trend === "down" ? (
                        <TrendingDown className="w-3 h-3" />
                      ) : null}
                      {Math.abs(weeklyStats.delta.avgScore)} pts
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      Sessions
                    </p>
                    <p className="text-lg font-bold leading-tight">
                      {weeklyStats.thisWeek.totalSessions}{" "}
                      <span className="text-[10px] font-normal text-[var(--color-text-muted)]">
                        vs {weeklyStats.lastWeek.totalSessions}
                      </span>
                    </p>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {weeklyStats.delta.sessions >= 0
                      ? `+${weeklyStats.delta.sessions}`
                      : weeklyStats.delta.sessions}{" "}
                    this week
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<BarChart2 className="w-7 h-7" />}
                title="No weekly trend yet"
                description="Your weekly comparison appears after you complete a roleplay session."
                action={
                  <Link
                    href="/karyawan/courses"
                    className="btn btn-secondary btn-sm"
                  >
                    Practice now
                  </Link>
                }
              />
            )}
          </div>
        </div>
      </AutoSkeleton>

      {/* Pending Assignments + Last Session & Quick Start */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending Assignments */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Pending Assignments</h2>
            <Link
              href="/karyawan/assignments"
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              All →
            </Link>
          </div>
          {pendingAssignmentsRaw.length === 0 && !loading ? (
            <EmptyState
              icon={
                <CheckCircle2 className="w-8 h-8 text-[var(--color-success)] opacity-80" />
              }
              title="All clear!"
              description="No pending assignments."
            />
          ) : (
            <div className="space-y-2">
              {pendingAssignmentsRaw.map((a) => {
                const isOverdue = a.dueAt && new Date(a.dueAt) < new Date();
                return (
                  <Link
                    key={a.id}
                    href={`/karyawan/courses/${a.course.id}?assignment=${a.id}`}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      isOverdue
                        ? "bg-[var(--color-danger-light)] border-[var(--color-danger)]/20 hover:border-[var(--color-danger)]/40"
                        : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-gray-400"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                      {isOverdue ? (
                        <AlertTriangle className="w-5 h-5 text-[var(--color-danger)]" />
                      ) : (
                        <PlayCircle className="w-5 h-5 text-[var(--color-accent)]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {a.course.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`badge ${difficultyColor[a.course.difficulty] || "badge-gray"} text-[10px] px-1.5 py-0`}
                        >
                          {a.course.difficulty}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] truncate">
                          {a.course.category}
                        </span>
                      </div>
                    </div>
                    {a.dueAt && (
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-[10px] flex items-center gap-1 ${isOverdue ? "text-[var(--color-danger)] font-bold" : "text-[var(--color-text-muted)]"}`}
                        >
                          <Clock className="w-3 h-3" />
                          {new Date(a.dueAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Last Session */}
          <div className="card p-5 space-y-4 relative overflow-hidden group">
            <h2 className="font-semibold text-sm mb-2">Latest Result</h2>
            {dashboard?.lastSession ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm truncate pr-2">
                    {dashboard.lastSession.courseTitle}
                  </p>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${outcomeColor[dashboard.lastSession.outcome] || "text-[var(--color-text-muted)] bg-[var(--color-bg)]"}`}
                  >
                    {outcomeIcon[dashboard.lastSession.outcome]}
                    <span className="capitalize">
                      {dashboard.lastSession.outcome.replace("_", " ")}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] flex items-center justify-center">
                      <Target className="w-5 h-5 text-[var(--color-accent)]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider font-semibold">
                        Score
                      </p>
                      <p className="font-bold text-lg leading-none">
                        {dashboard.lastSession.score}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {new Date(
                      dashboard.lastSession.completedAt,
                    ).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Award className="w-8 h-8" />}
                title="No result yet"
                description="Finish a roleplay session to unlock your first score and coaching feedback."
                action={
                  <Link
                    href="/karyawan/courses"
                    className="btn btn-primary btn-sm"
                  >
                    Choose scenario
                  </Link>
                }
              />
            )}
          </div>

          {/* Quick Start Courses */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Quick Start</h2>
              <Link
                href="/karyawan/courses"
                className="text-xs text-[var(--color-accent)] hover:underline"
              >
                Browse all →
              </Link>
            </div>
            {courses.length === 0 ? (
              <EmptyState
                icon={<BookOpen className="w-8 h-8" />}
                title="No courses available"
                description="Training scenarios will appear here after manager or admin publishes a course."
                action={
                  <Link
                    href="/karyawan/assignments"
                    className="btn btn-secondary btn-sm"
                  >
                    Check assignments
                  </Link>
                }
              />
            ) : (
              <div className="space-y-2">
                {courses.map((c) => (
                  <Link
                    key={c.id}
                    href={`/karyawan/courses/${c.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-bg)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-border)] transition-all"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center flex-shrink-0">
                      <TrendingUp className="w-4 h-4 text-[var(--color-accent)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.title}</p>
                    </div>
                    <span
                      className={`badge ${difficultyColor[c.difficulty] || "badge-gray"} flex-shrink-0`}
                    >
                      {c.difficulty}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
