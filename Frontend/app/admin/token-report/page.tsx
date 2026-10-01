// Frontend/app/admin/token-report/page.tsx
"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { PageHeader, PeriodSwitcher, StatCard, AutoSkeleton } from "../../../components/ui";
import { Cpu, DollarSign, Activity, Sparkles, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend
} from "recharts";

interface UsageData {
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
  logs: {
    id: string;
    createdAt: string;
    userName: string;
    teamName: string;
    courseTitle: string;
    score: number | null;
    service: string;
    model: string;
    totalTokens: number;
  }[];
  meta: { page: number; total: number; totalPages: number };
}

type TokenFilters = { team: string; course: string; from: string; to: string; minScore: string; maxScore: string };
const emptyFilters: TokenFilters = { team: "", course: "", from: "", to: "", minScore: "", maxScore: "" };
const paramsForFilters = (filters: TokenFilters, period: string) => {
  const params = new URLSearchParams();
  if (!filters.from && !filters.to && period !== "all") {
    const days = Number(period);
    params.set("from", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  }
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  return params;
};

interface CostData {
  totalEstimatedUSD: number;
  byModel: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUSD: number;
  }[];
}

export default function TokenReportPage() {
  const [period, setPeriod] = useState("30");
  const [filters, setFilters] = useState<TokenFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<TokenFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [cost, setCost] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = paramsForFilters(appliedFilters, period);
        params.set("groupBy", "day");
        params.set("page", String(page));
        params.set("limit", "10");
        const query = params.toString();

        const [usageRes, costRes] = await Promise.all([
          apiClient.get(`/admin/token-usage?${query}`),
          apiClient.get(`/admin/token-usage/cost?${query}`)
        ]);

        setUsage(usageRes);
        setCost(costRes);
        setTotalPages(usageRes?.meta?.totalPages ?? 1);
      } catch (err) {
        console.error("Failed to load token usage reports:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [appliedFilters, page, period]);

  const exportCsv = async () => {
    try {
      const params = paramsForFilters(appliedFilters, period);
      const blob = await apiClient.get(`/admin/token-usage/export?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "token-usage-export.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export token usage:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <PageHeader title="Token Usage Report" subtitle="Loading analytics..." />
        <AutoSkeleton isLoading={true} type="card">
          <div />
        </AutoSkeleton>
      </div>
    );
  }

  // Pisahkan Cerebras vs GPT secara visual
  const isCerebras = (model: string) => model.includes('gpt-oss') || model.includes('llama3') || model.includes('zai');
  const isGPT = (model: string) => model.toLowerCase().includes('gpt-4') || model.toLowerCase().includes('gpt-3');

  const totalTokens = usage?.summary.totalTokens || 0;
  const totalRequests = usage?.summary.totalRequests || 0;
  const estimatedCost = cost?.totalEstimatedUSD || 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Token Usage Report"
        subtitle="Analisis dan statistik komprehensif penggunaan Cerebras & OpenAI GPT"
        icon={<Cpu className="w-5 h-5" />}
        actions={<PeriodSwitcher options={[{ key: "7", label: "7 Hari Terakhir" }, { key: "30", label: "30 Hari Terakhir" }, { key: "90", label: "90 Hari Terakhir" }, { key: "all", label: "Semua" }]} value={period} onChange={setPeriod} />}
      />

      <form className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end" onSubmit={event => { event.preventDefault(); setPage(1); setAppliedFilters(filters); }}>
        <label className="text-xs">Team<input className="input mt-1 w-full" value={filters.team} onChange={event => setFilters({ ...filters, team: event.target.value })} /></label>
        <label className="text-xs">Course<input className="input mt-1 w-full" value={filters.course} onChange={event => setFilters({ ...filters, course: event.target.value })} /></label>
        <label className="text-xs">From<input type="date" className="input mt-1 w-full" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
        <label className="text-xs">To<input type="date" className="input mt-1 w-full" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
        <label className="text-xs">Min score<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.minScore} onChange={event => setFilters({ ...filters, minScore: event.target.value })} /></label>
        <label className="text-xs">Max score<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.maxScore} onChange={event => setFilters({ ...filters, maxScore: event.target.value })} /></label>
        <div className="flex gap-2"><button className="btn btn-primary btn-sm" type="submit">Filter</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => { setFilters(emptyFilters); setAppliedFilters(emptyFilters); setPage(1); }}>Reset</button><button className="btn btn-secondary btn-sm" type="button" onClick={exportCsv}>Export CSV</button></div>
      </form>

      {/* Grid Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Token Terpakai"
          value={totalTokens.toLocaleString()}
          icon={<Sparkles className="w-5 h-5 text-[var(--color-accent)]" />}
          footer={<p className="text-xs text-[var(--color-text-muted)]">Input + Output Tokens</p>}
        />
        <StatCard
          label="Estimasi Pengeluaran (USD)"
          value={`$${estimatedCost.toFixed(4)}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          footer={<p className="text-xs text-[var(--color-text-muted)]">Berdasarkan volume token real-time</p>}
        />
        <StatCard
          label="Total Request API"
          value={totalRequests.toLocaleString()}
          icon={<Activity className="w-5 h-5 text-cyan-400" />}
          footer={<p className="text-xs text-[var(--color-text-muted)]">Rata-rata {totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0} token per request</p>}
        />
      </div>

      {/* Area Chart: Penggunaan Harian */}
      <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Tren Penggunaan Token Harian</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usage?.byDay || []}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
              <XAxis dataKey="date" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-card-bg)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text)"
                }}
              />
              <Area type="monotone" dataKey="totalTokens" name="Total Token" stroke="var(--color-accent)" fillOpacity={1} fill="url(#colorTokens)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Grid: Breakdown Model & Provider */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribusi Token Berdasarkan Model */}
        <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Penggunaan Per Model</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage?.byModel || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis dataKey="model" type="category" stroke="var(--color-text-muted)" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card-bg)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)"
                  }}
                />
                <Bar dataKey="totalTokens" name="Tokens" radius={[0, 4, 4, 0]}>
                  {usage?.byModel.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={isGPT(entry.model) ? "#10B981" : "#8B5CF6"} // Emerald untuk GPT, Purple untuk Cerebras
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabel Rekapitulasi Cost & Provider */}
        <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Rincian Biaya per Provider</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
                  <th className="pb-3 font-semibold">Model</th>
                  <th className="pb-3 font-semibold">Provider</th>
                  <th className="pb-3 font-semibold text-right">Prompt Tokens</th>
                  <th className="pb-3 font-semibold text-right">Completion Tokens</th>
                  <th className="pb-3 font-semibold text-right">Est. Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)] text-sm">
                {cost?.byModel.map((item) => {
                  const provider = isGPT(item.model) ? "OpenAI GPT" : "Cerebras";
                  const badgeColor = isGPT(item.model)
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/20";

                  return (
                    <tr key={item.model} className="hover:bg-white/5 transition-colors">
                      <td className="py-3.5 font-medium text-[var(--color-text)]">{item.model}</td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${badgeColor}`}>
                          {provider}
                        </span>
                      </td>
                      <td className="py-3.5 text-right text-[var(--color-text-muted)]">{item.promptTokens.toLocaleString()}</td>
                      <td className="py-3.5 text-right text-[var(--color-text-muted)]">{item.completionTokens.toLocaleString()}</td>
                      <td className="py-3.5 text-right font-semibold text-[var(--color-text)]">${item.estimatedCostUSD.toFixed(5)}</td>
                    </tr>
                  );
                })}
                {(!cost?.byModel || cost.byModel.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-[var(--color-text-muted)]">
                      Tidak ada log data penggunaan AI pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]"><h2 className="font-semibold">Token request details</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]"><th className="p-3">Date</th><th className="p-3">User / Team</th><th className="p-3">Course</th><th className="p-3">Score</th><th className="p-3">Service / Model</th><th className="p-3 text-right">Tokens</th></tr></thead><tbody>
          {usage?.logs.map(log => <tr key={log.id} className="border-b border-[var(--color-border-light)]"><td className="p-3 whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</td><td className="p-3">{log.userName || "-"}<div className="text-xs text-[var(--color-text-muted)]">{log.teamName}</div></td><td className="p-3">{log.courseTitle || "-"}</td><td className="p-3">{log.score ?? "-"}</td><td className="p-3">{log.service}<div className="text-xs text-[var(--color-text-muted)]">{log.model}</div></td><td className="p-3 text-right">{log.totalTokens.toLocaleString()}</td></tr>)}
          {(!usage?.logs.length) && <tr><td colSpan={6} className="p-6 text-center text-[var(--color-text-muted)]">No token logs match these filters.</td></tr>}
        </tbody></table></div>
        <div className="flex items-center justify-between gap-3 p-4"><span className="text-xs text-[var(--color-text-muted)]">{usage?.meta.total ?? 0} requests · Page {page} of {totalPages}</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Next</button></div></div>
      </section>
      <section className="card p-6">
        <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Pemakaian Token per Layanan</h3>
        {!usage?.byService.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">Belum ada log penggunaan pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead><tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]"><th className="pb-3">Layanan</th><th className="pb-3 text-right">Request</th><th className="pb-3 text-right">Total token</th></tr></thead>
              <tbody className="divide-y divide-[var(--color-border-light)] text-sm">
                {usage.byService.map(item => <tr key={item.service}><td className="py-3 font-medium text-[var(--color-text)]">{item.service}</td><td className="py-3 text-right">{item.requests.toLocaleString()}</td><td className="py-3 text-right">{item.totalTokens.toLocaleString()}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
