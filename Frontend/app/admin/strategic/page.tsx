"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import {
  TrendingUp, TrendingDown, Users, BookOpen, Target,
  Activity, DollarSign, Zap, AlertTriangle, CheckCircle2,
  BarChart3, Trophy, Medal, Award, RefreshCw, ChevronRight,
  Layers, Globe, Clock, Shield, Cpu
} from "lucide-react";
import Link from "next/link";
import { PageHeader, PeriodSwitcher, EmptyState, AutoSkeleton } from "../../../components/ui";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, BarChart, Bar, Cell, PieChart, Pie, Legend
} from "recharts";

interface StrategicData {
  totalUsers: number;
  totalSessions: number;
  totalSessionsToday: number;
  totalSessionsPeriod: number;
  activeUsersPeriod: number;
  assignmentsAssigned: number;
  assignmentsCompleted: number;
  assignmentCompletionRate: number | null;
  avgScoreGlobal: number;
  totalCourses: number;
  estimatedAiCost: number;
  activeSessionsNow: number;
  alerts: { stuckSessions: number };
  globalScoreTrend?: { date: string; avgScore: number }[];
  topManagers?: { name: string; teamSize: number; teamAvgScore: number }[];
  roleDistribution?: { role: string; count: number }[];
  courseEngagement?: { title: string; totalSessions: number; avgScore: number }[];
}

const ROLE_COLORS: Record<string, string> = {
  karyawan: "var(--color-accent)",
  manager: "var(--color-purple)",
  admin: "var(--color-danger)",
  super_admin: "#0f172a",
};

const PIE_COLORS = ["var(--color-accent)", "var(--color-purple)", "var(--color-danger)", "var(--color-warning)"];

export default function StrategicDashboard() {
  const [data, setData] = useState<StrategicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30days");
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = () => {
    setLoading(true);
    Promise.allSettled([
      apiClient.get(`/admin/dashboard?period=${period}`),
      apiClient.get("/admin/users"),
      apiClient.get("/admin/courses"),
    ]).then(([dashRes, usersRes, coursesRes]) => {
      const dash = dashRes.status === "fulfilled" ? dashRes.value?.data : null;
      const users = usersRes.status === "fulfilled" ? (usersRes.value?.data || []) : [];
      const courses = coursesRes.status === "fulfilled" ? (coursesRes.value?.data || []) : [];

      // Build role distribution from users
      const roleCount: Record<string, number> = {};
      users.forEach((u: any) => { roleCount[u.role] = (roleCount[u.role] || 0) + 1; });
      const roleDistribution = Object.entries(roleCount).map(([role, count]) => ({ role, count }));

      // Build course engagement
      const courseEngagement = courses.slice(0, 5).map((c: any) => ({
        title: c.title?.slice(0, 20) + (c.title?.length > 20 ? "…" : ""),
        totalSessions: c._count?.sessions || 0,
        avgScore: 0,
      }));

      setData({
        totalUsers: dash?.totalUsers ?? users.length,
        totalSessions: dash?.totalSessionsPeriod ?? 0,
        totalSessionsToday: dash?.totalSessionsToday ?? 0,
        totalSessionsPeriod: dash?.totalSessionsPeriod ?? 0,
        activeUsersPeriod: dash?.activeUsersPeriod ?? 0,
        assignmentsAssigned: dash?.assignmentsAssigned ?? 0,
        assignmentsCompleted: dash?.assignmentsCompleted ?? 0,
        assignmentCompletionRate: dash?.assignmentCompletionRate ?? 0,
        avgScoreGlobal: dash?.avgScoreGlobal ?? 0,
        totalCourses: dash?.totalCourses ?? courses.length,
        estimatedAiCost: dash?.estimatedAiCost ?? 0,
        activeSessionsNow: 0,
        alerts: dash?.alerts ?? { stuckSessions: 0 },
        globalScoreTrend: dash?.globalScoreTrend,
        roleDistribution,
        courseEngagement,
      });
      setLastRefresh(new Date());
      setLoading(false);
    });
  };

  useEffect(() => { fetchData(); }, [period]);

  const estimatedCost = data?.estimatedAiCost ?? 0;
  const budgetUsed = Math.min(Math.round((estimatedCost / 50) * 100), 100);

  const kpis = [
    { label: "Total Users", value: data?.totalUsers ?? "-", icon: Users, color: "text-[var(--color-accent)]", sub: "Registered accounts" },
    { label: "Sessions (Period)", value: data?.totalSessionsPeriod ?? "-", icon: Activity, color: "text-[var(--color-purple)]", sub: "Roleplay sessions" },
    { label: "Active Employees", value: data?.activeUsersPeriod ?? "-", icon: Users, color: "text-[var(--color-accent)]", sub: "Employees with sessions" },
    { label: "Training Completed", value: data?.assignmentCompletionRate == null ? "-" : `${data.assignmentCompletionRate}%`, icon: CheckCircle2, color: "text-[var(--color-success)]", sub: `${data?.assignmentsCompleted ?? 0} of ${data?.assignmentsAssigned ?? 0} assignments` },
    { label: "Avg Score (Period)", value: `${data?.avgScoreGlobal ?? "-"}%`, icon: Target, color: "text-[var(--color-success)]", sub: "Average completed session score" },
    { label: "Total Courses", value: data?.totalCourses ?? "-", icon: BookOpen, color: "text-amber-500", sub: "Published scenarios" },
    { label: "API Cost (Period)", value: `$${estimatedCost.toFixed(2)}`, icon: DollarSign, color: "text-emerald-500", sub: `Budget: ${budgetUsed}% of $50` },
    {
      label: "System Health",
      value: (data?.alerts?.stuckSessions ?? 0) === 0 ? "Healthy" : "Needs Attention",
      icon: (data?.alerts?.stuckSessions ?? 0) === 0 ? Shield : AlertTriangle,
      color: (data?.alerts?.stuckSessions ?? 0) === 0 ? "text-[var(--color-success)]" : "text-[var(--color-danger)]",
      sub: `${data?.alerts?.stuckSessions ?? 0} stuck sessions`,
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <PageHeader
        title="Strategic Dashboard"
        subtitle="Platform-wide decision intelligence for Super Admin."
        // icon={<Layers className="w-4 h-4" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)]">
              Updated {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <PeriodSwitcher
              options={[
                { key: "7days", label: "7D" },
                { key: "30days", label: "30D" },
                { key: "90days", label: "90D" },
              ]}
              value={period}
              onChange={setPeriod}
            />
            <button
              onClick={fetchData}
              className="btn btn-secondary btn-sm flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
        }
      />

      {/* ── KPI Row ── */}
      <AutoSkeleton isLoading={loading} type="stats" count={6} cols={6}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="stat-card">
              <div className="flex items-center justify-between mb-1.5">
                <span className="stat-label">{kpi.label}</span>
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
              </div>
              <div className={`text-xl font-black leading-none ${kpi.color}`}>{kpi.value}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </AutoSkeleton>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Trend - spans 2 cols */}
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm mb-3">
              Global Rep Score Trend
            </h2>
            <span className="text-[10px] text-[var(--color-text-muted)]">Average across all employees</span>
          </div>
          <div className="h-52">
            <AutoSkeleton isLoading={loading} type="chart">
              {!data?.globalScoreTrend?.length ? (
                <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No trend data" description="Not enough session data for this period." />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.globalScoreTrend} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="globalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(s) => { try { return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }); } catch { return s; } }}
                  />
                  <YAxis
                    tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v) => [`${v}%`, "Avg Score"]}
                  />
                  <Area type="monotone" dataKey="avgScore" stroke="var(--color-accent)" strokeWidth={2} fill="url(#globalGrad)" dot={{ r: 3, fill: "var(--color-accent)", strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
              )}
            </AutoSkeleton>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-3">
            User Distribution
          </h2>
          <div className="h-52">
            <AutoSkeleton isLoading={loading} type="chart">
              {!data?.roleDistribution?.length ? (
                <EmptyState icon={<Users className="w-7 h-7" />} title="No data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                  <Pie
                    data={data.roleDistribution}
                    dataKey="count"
                    nameKey="role"
                    cx="50%"
                    cy="50%"
                    innerRadius={42}
                    outerRadius={70}
                    paddingAngle={3}
                  >
                    {data.roleDistribution.map((entry, index) => (
                      <Cell key={entry.role} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v, name) => [`${v} users`, name]}
                  />
                    <Legend
                      formatter={(value) => <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>{value}</span>}
                      iconSize={8}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </AutoSkeleton>
          </div>
        </div>
      </div>

      {/* ── Second Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Course Engagement Bar */}
        <div className="card p-4">
          <h2 className="font-semibold text-sm mb-3">
            Top Courses by Sessions
          </h2>
          <div className="h-44">
            <AutoSkeleton isLoading={loading} type="chart">
              {!data?.courseEngagement?.length ? (
                <EmptyState icon={<BookOpen className="w-7 h-7" />} title="No course data" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.courseEngagement} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} tickLine={false} axisLine={false} />
                    <YAxis dataKey="title" type="category" tick={{ fill: "var(--color-text-muted)", fontSize: 9 }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip contentStyle={{ background: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="totalSessions" name="Sessions" radius={[0, 4, 4, 0]}>
                      {data.courseEngagement.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "var(--color-accent)" : "var(--color-border-strong)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </AutoSkeleton>
          </div>
        </div>

        {/* System Health + Quick Actions */}
        <div className="space-y-3">
          {/* System Health */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-3">
              Platform Health
            </h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
                  <span className="font-medium">Cerebras AI Engine</span>
                </div>
                <span className="text-emerald-500 font-semibold">Operational</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="font-medium">PostgreSQL Database</span>
                </div>
                <span className="text-emerald-500 font-semibold">Operational</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className={`flex items-center gap-2 ${(data?.alerts?.stuckSessions ?? 0) > 0 ? "text-[var(--color-danger)]" : ""}`}>
                  {(data?.alerts?.stuckSessions ?? 0) > 0
                    ? <AlertTriangle className="w-2 h-2 flex-shrink-0" />
                    : <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />}
                  <span className="font-medium">Session Queue</span>
                </div>
                <span className={`font-semibold ${(data?.alerts?.stuckSessions ?? 0) > 0 ? "text-[var(--color-danger)]" : "text-emerald-500"}`}>
                  {data?.alerts?.stuckSessions ?? 0} stuck
                </span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="card p-4">
            <h2 className="font-semibold text-sm mb-3">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Manage Users", href: "/admin/users", icon: Users },
                { label: "Session Audit", href: "/admin/sessions", icon: Activity },
                { label: "Course Audit", href: "/admin/courses", icon: BookOpen },
                { label: "Notifications", href: "/admin/notifications", icon: Zap },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-light)] transition-all group"
                >
                  <link.icon className="w-3.5 h-3.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)]" />
                  <span className="text-xs font-medium text-[var(--color-text)]">{link.label}</span>
                  <ChevronRight className="w-3 h-3 text-[var(--color-text-muted)] ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Cost Band ── */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm mb-2">
            API Budget Monitor
          </h2>
          <Link href="/admin/dashboard" className="text-xs text-[var(--color-accent)] hover:underline flex items-center gap-1">
            Full Token Report <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
              <span>Period spend: <strong className="text-emerald-500">${estimatedCost.toFixed(2)}</strong></span>
              <span>Budget limit: $50.00</span>
            </div>
            <div className="progress-bar h-2">
              <div
                className={`progress-fill h-full ${budgetUsed > 80 ? "progress-fill-red" : budgetUsed > 50 ? "progress-fill-yellow" : "progress-fill-green"}`}
                style={{ width: `${budgetUsed}%` }}
              />
            </div>
          </div>
          <span className={`text-lg font-black ${budgetUsed > 80 ? "text-[var(--color-danger)]" : "text-emerald-500"}`}>
            {budgetUsed}%
          </span>
        </div>
      </div>
    </div>
  );
}

