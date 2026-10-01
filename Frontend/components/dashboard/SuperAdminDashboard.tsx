"use client";
import { getErrorMessage } from "@/lib/api/client";


import { useEffect, useState } from "react";
import { apiClient } from "../../lib/api/client";
import { 
  Users, Activity, BookOpen, AlertTriangle, Shield, DollarSign, Cpu, BarChart2, TrendingUp, RefreshCw,
  Server, Database, Trash2, ClipboardList, CheckCircle2, Zap
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell 
} from "recharts";
import { PageHeader, PeriodSwitcher, AutoSkeleton } from "../../components/ui";

interface AdminDashboardData {
  totalUsers: number;
  totalSessionsPeriod: number;
  activeUsersPeriod: number;
  assignmentsAssigned: number;
  assignmentsCompleted: number;
  assignmentCompletionRate: number | null;
  avgScoreGlobal: number;
  globalScoreTrend?: { date: string; avgScore: number }[];
  totalCourses: number;
  estimatedAiCost: number;
  alerts: {
    stuckSessions: number;
  };
}

interface SystemInfo {
  app: {
    name: string;
    version: string;
    nodeVersion: string;
    env: string;
    uptime: number;
  };
  memory: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  database: {
    status: string;
    provider: string;
    pooling: boolean;
  };
  ai: {
    provider: string;
    defaultModel: string;
    apiKeyConfigured: boolean;
  };
  timestamp: string;
}

interface SystemHealth {
  data: {
    db: string;
    ai: string;
    pgvector: string;
    avgResponseTime: number | null;
    errorRate: number | null;
  };
}

interface TokenUsageSummary {
  summary: {
    totalTokens: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalRequests: number;
  };
  byModel: {
    model: string;
    totalTokens: number;
    requests: number;
    avgTokensPerRequest: number;
  }[];
  byDay: {
    date: string;
    totalTokens: number;
    requests: number;
  }[];
  byService: {
    service: string;
    totalTokens: number;
    requests: number;
  }[];
}

interface TokenUsageCost {
  totalEstimatedUSD: number;
  byModel: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUSD: number;
  }[];
  byService: {
    service: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUSD: number;
  }[];
}

interface AuditLog {
  id: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string;
  createdAt: string;
}

interface DemoReadinessItem {
  key: string;
  label: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

interface DemoReadinessData {
  checkedAt: string;
  overallStatus: "ready" | "partial" | "blocked";
  items: DemoReadinessItem[];
  metrics: {
    totalUsers: number;
    activeKaryawan: number;
    totalManagers: number;
    totalAdmins: number;
    activeCourses: number;
    completedSessions: number;
    activeAiKeys: number;
    ttsOnline: boolean;
  };
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageSummary | null>(null);
  const [tokenUsageCost, setTokenUsageCost] = useState<TokenUsageCost | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [demoReadiness, setDemoReadiness] = useState<DemoReadinessData | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "costs">("overview");
  const [period, setPeriod] = useState<string>("30days");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);

    let fromDate: string | undefined;
    const now = new Date();
    if (period === '7days') fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === '30days') fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    else if (period === '90days') fromDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const usageQuery = `?groupBy=day${fromDate ? `&from=${fromDate}` : ''}`;
    const costQuery = `${fromDate ? `?from=${fromDate}` : ''}`;

    Promise.allSettled([
      apiClient.get(`/admin/dashboard?period=${period}`),
      apiClient.get('/admin/system/info'),
      apiClient.get('/admin/system/health'),
      apiClient.get(`/admin/token-usage${usageQuery}`),
      apiClient.get(`/admin/token-usage/cost${costQuery}`),
      apiClient.get('/admin/audit-logs?limit=10'),
      apiClient.get('/admin/readiness'),
    ]).then(([dashRes, infoRes, healthRes, usageRes, costRes, auditRes, readinessRes]) => {
      if (dashRes.status === 'fulfilled') setData(dashRes.value.data);
      if (infoRes.status === 'fulfilled') setSystemInfo(infoRes.value);
      if (healthRes.status === 'fulfilled') setSystemHealth(healthRes.value);
      if (usageRes.status === 'fulfilled') setTokenUsage(usageRes.value);
      if (costRes.status === 'fulfilled') setTokenUsageCost(costRes.value);
      if (auditRes.status === 'fulfilled') setAuditLogs(auditRes.value.data || []);
      if (readinessRes.status === 'fulfilled') setDemoReadiness(readinessRes.value.data);
    }).catch(err => {
      setError(getErrorMessage(err, 'Something went wrong while fetching telemetry data.'));
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handleCleanupSessions = async () => {
    setActionLoading("cleanup");
    setActionMessage(null);
    try {
      const res = await apiClient.post("/admin/system/cleanup-sessions", {});
      setActionMessage({ text: res.message || "Sessions cleaned up successfully.", type: "success" });
      fetchData();
    } catch (err) {
      setActionMessage({ text: getErrorMessage(err, "Failed to cleanup sessions."), type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReindexRag = async () => {
    setActionLoading("reindex");
    setActionMessage(null);
    try {
      const res = await apiClient.post("/admin/system/reindex-rag", {});
      setActionMessage({ text: res.message || "RAG reindexing triggered successfully in the background.", type: "success" });
    } catch (err) {
      setActionMessage({ text: getErrorMessage(err, "Failed to trigger RAG reindexing."), type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  // Dynamic values based on backend telemetry
  const totalCost = tokenUsageCost?.totalEstimatedUSD ?? data?.estimatedAiCost ?? 0;
  const totalTokens = tokenUsage?.summary?.totalTokens ?? 0;
  const promptTokens = tokenUsage?.summary?.totalPromptTokens ?? 0;
  const completionTokens = tokenUsage?.summary?.totalCompletionTokens ?? 0;
  const limitThresholdPct = Math.min(Math.round((totalCost / 50) * 100), 100); // Monthly budget cap $50
  const readinessCopy = {
    ready: {
      label: "Demo siap",
      tone: "border-cyan-400/40 bg-cyan-500/10 text-cyan-200 shadow-[0_0_32px_rgba(34,211,238,0.10)]",
      description: "Semua komponen utama siap untuk dipresentasikan.",
    },
    partial: {
      label: "Demo hampir siap",
      tone: "border-sky-400/35 bg-sky-500/10 text-sky-200 shadow-[0_0_32px_rgba(56,189,248,0.08)]",
      description: "Fitur inti sudah jalan, tetapi ada layanan pendukung yang perlu dicek.",
    },
    blocked: {
      label: "Demo perlu dicek",
      tone: "border-red-400/35 bg-red-500/10 text-red-200",
      description: "Ada komponen wajib yang belum siap untuk alur demo penuh.",
    },
  }[demoReadiness?.overallStatus ?? "partial"];
  const readinessItemTone = {
    ok: "border-cyan-400/25 bg-cyan-500/5 text-cyan-300",
    warning: "border-blue-400/25 bg-blue-500/5 text-blue-300",
    error: "border-red-400/25 bg-red-500/5 text-red-300",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <PageHeader
        title="Admin System Control Panel"
        subtitle="Platform telemetry, tokens audit & cost tracking."
        // icon={<Shield className="w-5 h-5 text-red-500" />}
        actions={
          <button 
            onClick={fetchData}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh Status
          </button>
        }
      />

      <AutoSkeleton isLoading={loading && !data} type="stats">
      {error && (
        <div className="card p-4 border-[var(--color-danger)] bg-[var(--color-danger-light)] text-[var(--color-danger)] flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4" /> Failed to load metrics: {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        <button
          onClick={() => { setActiveTab("overview"); setActionMessage(null); }}
          className={`px-4 py-2.5 font-medium text-xs border-b-2 transition-all cursor-pointer -mb-px ${
            activeTab === "overview" 
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-bold" 
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          System Overview
        </button>
        <button
          onClick={() => { setActiveTab("costs"); setActionMessage(null); }}
          className={`px-4 py-2.5 font-medium text-xs border-b-2 transition-all cursor-pointer -mb-px ${
            activeTab === "costs" 
              ? "border-[var(--color-accent)] text-[var(--color-accent)] font-bold" 
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          Token & API Cost Monitor
        </button>
      </div>

      {/* Overview Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {demoReadiness && (
            <div className={`card p-5 border ${readinessCopy.tone}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-cyan-400/10 border border-cyan-300/25 flex items-center justify-center shadow-[0_0_24px_rgba(34,211,238,0.18)]">
                    <Zap className="w-5 h-5 text-cyan-200" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] font-bold opacity-80">Demo readiness</p>
                    <h3 className="text-lg font-black mt-1">{readinessCopy.label}</h3>
                    <p className="text-sm mt-1 text-[var(--color-text-muted)] max-w-2xl">{readinessCopy.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 min-w-full lg:min-w-[420px]">
                  <div className="rounded-xl border border-cyan-300/15 bg-cyan-500/[0.03] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)]">Karyawan</p>
                    <p className="text-lg font-black text-cyan-200">{demoReadiness.metrics.activeKaryawan}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/15 bg-cyan-500/[0.03] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)]">Course</p>
                    <p className="text-lg font-black text-cyan-200">{demoReadiness.metrics.activeCourses}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/15 bg-cyan-500/[0.03] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)]">Hasil sesi</p>
                    <p className="text-lg font-black text-cyan-200">{demoReadiness.metrics.completedSessions}</p>
                  </div>
                  <div className="rounded-xl border border-cyan-300/15 bg-cyan-500/[0.03] p-3">
                    <p className="text-[10px] text-[var(--color-text-muted)]">TTS</p>
                    <p className="text-sm font-black mt-1 text-cyan-200">{demoReadiness.metrics.ttsOnline ? "Online" : "Offline"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-black text-[var(--color-text)] flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-[var(--color-accent)]" />
                      Checklist alur demo
                    </h4>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      Terakhir dicek {new Date(demoReadiness.checkedAt).toLocaleString("id-ID", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button onClick={fetchData} className="btn btn-secondary btn-sm flex items-center gap-1.5 self-start sm:self-auto">
                    <RefreshCw className="w-3.5 h-3.5" /> Cek ulang
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {demoReadiness.items.map((item) => {
                    const tone = readinessItemTone[item.status];
                    const Icon = item.status === "ok" ? CheckCircle2 : AlertTriangle;

                    return (
                      <div key={item.key} className={`rounded-xl border p-3 ${tone}`}>
                        <div className="flex items-start gap-2.5">
                          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-black text-[var(--color-text)]">{item.label}</p>
                              <span className="rounded-full border border-current/30 px-2 py-0.5 text-[9px] font-bold uppercase">
                                {item.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 leading-relaxed">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">Total Registered Users</span>
                <Users className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="stat-value text-xl font-bold">{data?.totalUsers ?? "-"}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Platform capacity level</p>
            </div>
            
            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">Simulations Active Today</span>
                <Activity className="w-4 h-4 text-purple-400" />
              </div>
              <div className="stat-value text-xl font-bold">{data?.totalSessionsPeriod ?? "-"}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Roleplay sessions in selected period</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2"><span className="stat-label">Active Employees</span><Users className="w-4 h-4 text-[var(--color-accent)]" /></div>
              <div className="stat-value text-xl font-bold">{data?.activeUsersPeriod ?? "-"}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Employees with a session</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2"><span className="stat-label">Training Completion</span><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
              <div className="stat-value text-xl font-bold">{data?.assignmentCompletionRate == null ? "-" : `${data.assignmentCompletionRate}%`}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{data?.assignmentsCompleted ?? 0} of {data?.assignmentsAssigned ?? 0} assignments</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">Active Training Courses</span>
                <BookOpen className="w-4 h-4 text-amber-500" />
              </div>
              <div className="stat-value text-xl font-bold">{data?.totalCourses ?? "-"}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Published by Sales Managers</p>
            </div>

            <div className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label">Global Rep Score Avg</span>
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-0.5">★</span>
              </div>
              <div className="stat-value text-xl font-bold text-emerald-500">{data?.avgScoreGlobal ?? "-"}%</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Average rep quality score</p>
            </div>

            <div className="stat-card border-red-500/30 bg-red-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label text-red-500 font-semibold">Incident Telemetry</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="stat-value text-lg font-bold text-red-400">{data?.alerts?.stuckSessions ?? 0}</div>
                  <p className="text-[10px] text-red-400/80 mt-0.5">Idle Sessions &gt; 2h</p>
                </div>
                <div>
                  <div className="stat-value text-lg font-bold text-[var(--color-text-muted)]">-</div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">API error rate not tracked</p>
                </div>
              </div>
            </div>

            <div className="stat-card border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="stat-label text-emerald-500 font-semibold">Current AI Billing Period</span>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="stat-value text-xl font-bold text-emerald-500">${totalCost.toFixed(4)}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Calculated Cerebras LLM cost</p>
            </div>
          </div>

          {/* System Telemetry, Health, and Actions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* System Info */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Platform Telemetry
              </h3>
              {systemInfo ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-muted)]">App Version</span>
                    <span className="font-semibold">{systemInfo.app.version}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-muted)]">Node Version</span>
                    <span className="font-semibold">{systemInfo.app.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-muted)]">Process RSS Memory</span>
                    <span className="font-semibold">{systemInfo.memory.rss} MB</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-muted)]">Heap Memory</span>
                    <span className="font-semibold">{systemInfo.memory.heapUsed} / {systemInfo.memory.heapTotal} MB</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[var(--color-border)]">
                    <span className="text-[var(--color-text-muted)]">Uptime</span>
                    <span className="font-semibold">{Math.round(systemInfo.app.uptime / 3600)} hours</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--color-text-muted)]">Database</span>
                    <span className="font-semibold capitalize">{systemInfo.database.provider} {systemInfo.database.pooling ? "(Pooled)" : ""}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-[var(--color-text-muted)]">No telemetry data loaded.</div>
              )}
            </div>

            {/* Platform Health Status */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Platform Health Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${systemHealth?.data?.ai === "configured" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-semibold">AI Provider Keys</span>
                  </div>
                  <span className={`font-medium ${systemHealth?.data?.ai === "configured" ? "text-emerald-500" : "text-amber-500"}`}>
                    {systemHealth?.data?.ai === "configured" ? "Configured" : "Missing key"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${systemHealth?.data?.db === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className="font-semibold">PostgreSQL Database</span>
                  </div>
                  <span className={`font-medium ${systemHealth?.data?.db === "ok" ? "text-emerald-500" : "text-red-500"}`}>
                    {systemHealth?.data?.db === "ok" ? "Operational" : "Disconnected"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${systemHealth?.data?.pgvector === "ok" ? "bg-emerald-500" : "bg-amber-500"}`} />
                    <span className="font-semibold">pgvector Extension</span>
                  </div>
                  <span className={`font-medium ${systemHealth?.data?.pgvector === "ok" ? "text-emerald-500" : "text-amber-500"}`}>
                    {systemHealth?.data?.pgvector === "ok" ? "Installed" : systemHealth?.data?.pgvector === "missing" ? "Not installed" : "Unknown"}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] pt-1">Response time and API error rate are not currently recorded.</p>
              </div>
            </div>

            {/* System Actions */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Administrative Actions
              </h3>
              <div className="space-y-3">
                <button
                  disabled={actionLoading !== null}
                  onClick={handleCleanupSessions}
                  className="btn btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading === "cleanup" ? (
                    <div className="w-3.5 h-3.5 border-2 border-[var(--color-text)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  )}
                  Clean Up Idle Sessions
                </button>
                <button
                  disabled={actionLoading !== null}
                  onClick={handleReindexRag}
                  className="btn btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {actionLoading === "reindex" ? (
                    <div className="w-3.5 h-3.5 border-2 border-[var(--color-text)] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-purple-500" />
                  )}
                  Trigger RAG Reindexing
                </button>
              </div>

              {actionMessage && (
                <div className={`p-2.5 rounded-lg text-[10px] flex items-start gap-1.5 border ${
                  actionMessage.type === "success" 
                    ? "bg-[var(--color-success-light)] border-[var(--color-success)] text-[var(--color-success)]" 
                    : "bg-[var(--color-danger-light)] border-[var(--color-danger)] text-[var(--color-danger)]"
                }`}>
                  {actionMessage.type === "success" ? <CheckCircle2 className="w-3 h-3 flex-shrink-0 mt-0.5" /> : <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />}
                  <span>{actionMessage.text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chart: Global Score Trend */}
          <div className="card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm">
                  Global Rep Score Trend
                </h3>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Average quality score across all employee roleplays.</p>
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

            {(!data?.globalScoreTrend || data.globalScoreTrend.length === 0) ? (
              <div className="h-48 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                <BarChart2 className="w-8 h-8 opacity-20 mb-2" />
                <p className="text-sm">Not enough data to calculate trends for this period.</p>
              </div>
            ) : (
              <AutoSkeleton isLoading={loading} type="chart">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.globalScoreTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAvgScore" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      domain={[0, 100]} 
                      tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: "var(--color-surface)", 
                        border: "1px solid var(--color-border)", 
                        borderRadius: "8px", 
                        fontSize: "12px",
                        color: "var(--color-text)"
                      }} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="avgScore" 
                      stroke="var(--color-accent)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorAvgScore)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              </AutoSkeleton>
            )}
          </div>

          {/* Audit Logs */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--color-text)]">
                Platform Audit Trail
              </h3>
              <span className="text-[10px] text-[var(--color-text-muted)]">Latest 10 security & action events</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="text-center py-6 text-xs text-[var(--color-text-muted)]">
                No recent administrative events logged.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)] font-medium">
                      <th className="py-2 pr-4">Timestamp</th>
                      <th className="py-2 px-4">Actor ID</th>
                      <th className="py-2 px-4">Role</th>
                      <th className="py-2 px-4">Action</th>
                      <th className="py-2 px-4">Target Type</th>
                      <th className="py-2 pl-4">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors">
                        <td className="py-2 pr-4 text-[var(--color-text-muted)]">
                          {new Date(log.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2 px-4 font-mono text-[10px] truncate max-w-[120px]" title={log.actorId}>{log.actorId}</td>
                        <td className="py-2 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase ${
                            log.actorRole === "super_admin" 
                              ? "bg-purple-500/10 text-purple-600 border border-purple-500/20" 
                              : "bg-red-500/10 text-red-600 border border-red-500/20"
                          }`}>
                            {log.actorRole.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-2 px-4 font-semibold">{log.action}</td>
                        <td className="py-2 px-4 text-[var(--color-text-muted)] capitalize">{log.targetType || "-"}</td>
                        <td className="py-2 pl-4 font-mono text-[10px]">{log.ipAddress || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cost Monitor Tab Content */}
      {activeTab === "costs" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="stat-card">
              <span className="stat-label">Estimated AI Cost ({period})</span>
              <div className="text-2xl font-black mt-1 text-emerald-500">${totalCost.toFixed(5)}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Cerebras SDK usage billing</p>
            </div>

            <div className="stat-card">
              <span className="stat-label">Token Consumption</span>
              <div className="text-2xl font-black mt-1 text-purple-400">{totalTokens.toLocaleString()}</div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                Prompt: {promptTokens.toLocaleString()} | Comp: {completionTokens.toLocaleString()}
              </p>
            </div>

            <div className="stat-card">
              <span className="stat-label">Monthly API Budget Usage</span>
              <div className="text-2xl font-black mt-1">{limitThresholdPct}%</div>
              <div className="w-full progress-bar mt-2">
                <div className="progress-fill bg-emerald-500" style={{ width: `${limitThresholdPct}%` }} />
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">Spent ${totalCost.toFixed(2)} of $50.00 Limit</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart: Daily Token Usage */}
            <div className="card p-5 space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-[var(--color-text)]">
                  Daily Token Consumption
                </h3>
                <span className="text-xs text-[var(--color-text-muted)]">Chosen Period</span>
              </div>
              
              {!tokenUsage?.byDay || tokenUsage.byDay.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                  <BarChart2 className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">No token transactions logged for this period.</p>
                </div>
              ) : (
                <AutoSkeleton isLoading={loading} type="chart">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={tokenUsage.byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
                        tickFormatter={(str) => {
                          try {
                            return new Date(str).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
                          } catch {
                            return str;
                          }
                        }}
                      />
                      <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
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
                        dataKey="totalTokens" 
                        name="Total Tokens"
                        stroke="var(--color-accent)" 
                        fillOpacity={1} 
                        fill="url(#colorCost)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                </AutoSkeleton>
              )}
            </div>

            {/* Breakdown per service */}
            <div className="card p-5 space-y-4">
              <h3 className="font-bold text-sm">
                Cost by AI Service
              </h3>
              
              {!tokenUsageCost?.byService || tokenUsageCost.byService.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                  <Cpu className="w-8 h-8 opacity-20 mb-2" />
                  <p className="text-sm">No service breakdown data.</p>
                </div>
              ) : (
                <AutoSkeleton isLoading={loading} type="chart">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tokenUsageCost.byService} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                      <XAxis 
                        dataKey="service" 
                        tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} 
                        tickFormatter={(str) => str.charAt(0).toUpperCase() + str.slice(1)}
                      />
                      <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'var(--color-card)', 
                          borderColor: 'var(--color-border)',
                          borderRadius: '12px',
                          color: 'var(--color-text)',
                          fontSize: '12px'
                        }}
                        formatter={(val: any) => [`$${Number(val || 0).toFixed(5)}`, 'Estimated Cost']}
                      />
                      <Bar dataKey="estimatedCostUSD" name="Cost ($)" radius={[4, 4, 0, 0]}>
                        {tokenUsageCost.byService.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={
                              entry.service === "roleplay" 
                                ? "var(--color-accent)" 
                                : entry.service === "coaching" 
                                ? "var(--color-purple)" 
                                : entry.service === "insight" 
                                ? "var(--color-warning)" 
                                : "var(--color-success)"
                            } 
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                </AutoSkeleton>
              )}
            </div>
          </div>
        </div>
      )}
      </AutoSkeleton>
    </div>
  );
}

