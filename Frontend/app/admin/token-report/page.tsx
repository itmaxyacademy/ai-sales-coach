"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore } from "../../../store/authStore";
import { PageHeader, PeriodSwitcher, StatCard, AutoSkeleton } from "../../../components/ui";
import {
  Cpu,
  DollarSign,
  Activity,
  Sparkles,
  Building2,
  Search,
  Download,
  RotateCcw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowRight
} from "lucide-react";
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
  Cell
} from "recharts";

interface CompanyStat {
  companyId: string;
  companyName: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  estimatedCostUSD: number;
}

interface UsageLog {
  id: string;
  createdAt: string;
  userName: string | null;
  teamName: string | null;
  courseTitle: string | null;
  companyId?: string | null;
  companyName?: string | null;
  score: number | null;
  service: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens: number;
  estimatedCostUSD?: number;
}

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
  byCompany?: CompanyStat[];
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
  logs: UsageLog[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type TokenFilters = {
  search: string;
  companyId: string;
  model: string;
  team: string;
  course: string;
  from: string;
  to: string;
  minScore: string;
  maxScore: string;
};

const emptyFilters: TokenFilters = {
  search: "",
  companyId: "",
  model: "",
  team: "",
  course: "",
  from: "",
  to: "",
  minScore: "",
  maxScore: ""
};

const paramsForFilters = (filters: TokenFilters, period: string) => {
  const params = new URLSearchParams();
  if (!filters.from && !filters.to && period !== "all") {
    const days = Number(period);
    params.set("from", new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value && value.trim() !== "") {
      params.set(key, value.trim());
    }
  }
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

interface CompanyItem {
  id: string;
  name: string;
}

export default function TokenReportPage() {
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === "super_admin";

  const [period, setPeriod] = useState("30");
  const [filters, setFilters] = useState<TokenFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<TokenFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [cost, setCost] = useState<CostData | null>(null);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Load companies for super admin filter
  useEffect(() => {
    if (!isSuperAdmin) return;
    async function loadCompanies() {
      try {
        const res = await apiClient.get("/admin/companies");
        setCompanies(res?.data || []);
      } catch (err) {
        console.error("Failed to load companies:", err);
      }
    }
    loadCompanies();
  }, [isSuperAdmin]);

  // Load report data
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const params = paramsForFilters(appliedFilters, period);
        params.set("groupBy", "day");
        params.set("page", String(page));
        params.set("limit", String(limit));
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
  }, [appliedFilters, page, limit, period]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleResetFilter = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const handleFilterByCompany = (companyId: string) => {
    const updated = { ...appliedFilters, companyId };
    setFilters(updated);
    setAppliedFilters(updated);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = paramsForFilters(appliedFilters, period);
      const blob = await apiClient.get(`/admin/token-usage/export?${params}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `token-usage-export-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export token usage:", err);
    } finally {
      setExporting(false);
    }
  };

  const isCerebras = (model: string) =>
    model.includes("gpt-oss") || model.includes("llama3") || model.includes("zai");
  const isGPT = (model: string) =>
    model.toLowerCase().includes("gpt-4") || model.toLowerCase().includes("gpt-3");

  const totalTokens = usage?.summary.totalTokens || 0;
  const totalPromptTokens = usage?.summary.totalPromptTokens || 0;
  const totalCompletionTokens = usage?.summary.totalCompletionTokens || 0;
  const totalRequests = usage?.summary.totalRequests || 0;
  const estimatedCost = cost?.totalEstimatedUSD || 0;
  const companyStats = usage?.byCompany || [];

  if (loading && !usage) {
    return (
      <div className="p-6">
        <PageHeader title="Token Usage & Cost Report" subtitle="Memuat analitik..." />
        <AutoSkeleton isLoading={true} type="card">
          <div />
        </AutoSkeleton>
      </div>
    );
  }

  const startRecord = usage?.meta?.total ? (page - 1) * limit + 1 : 0;
  const endRecord = usage?.meta?.total ? Math.min(page * limit, usage.meta.total) : 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Laporan Penggunaan & Biaya Token AI"
        subtitle="Statistik volume token, estimasi biaya multi-provider (Cerebras & OpenAI GPT), dan rincian per perusahaan"
        icon={<Cpu className="w-5 h-5 text-[var(--color-accent)]" />}
        actions={
          <PeriodSwitcher
            options={[
              { key: "7", label: "7 Hari Terakhir" },
              { key: "30", label: "30 Hari Terakhir" },
              { key: "90", label: "90 Hari Terakhir" },
              { key: "all", label: "Semua Waktu" }
            ]}
            value={period}
            onChange={(val) => {
              setPeriod(val);
              setPage(1);
            }}
          />
        }
      />

      <form
        className="card p-5 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)] space-y-4"
        onSubmit={handleApplyFilter}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border-light)] pb-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <Filter className="w-4 h-4 text-[var(--color-accent)]" />
            <span>Filter & Pencarian Lanjutan</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              type="button"
              onClick={handleResetFilter}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
            <button
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              type="submit"
            >
              <Search className="w-3.5 h-3.5" />
              Terapkan Filter
            </button>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
              type="button"
              disabled={exporting}
              onClick={exportCsv}
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? "Mengekspor..." : "Export CSV"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Pencarian Kata Kunci
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Cari user, tim, course, perusahaan..."
                className="input w-full pl-9"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>

          {isSuperAdmin && (
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
                Perusahaan
              </label>
              <select
                className="input w-full"
                value={filters.companyId}
                onChange={(e) => setFilters({ ...filters, companyId: e.target.value })}
              >
                <option value="">Semua Perusahaan</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              AI Model
            </label>
            <select
              className="input w-full"
              value={filters.model}
              onChange={(e) => setFilters({ ...filters, model: e.target.value })}
            >
              <option value="">Semua Model</option>
              <option value="gpt-4o">GPT-4o (OpenAI)</option>
              <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
              <option value="gpt-oss-120b">Cerebras OSS 120B</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Nama Tim
            </label>
            <input
              type="text"
              placeholder="e.g. Sales Alpha"
              className="input w-full"
              value={filters.team}
              onChange={(e) => setFilters({ ...filters, team: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Judul Modul / Course
            </label>
            <input
              type="text"
              placeholder="e.g. Handling Objections"
              className="input w-full"
              value={filters.course}
              onChange={(e) => setFilters({ ...filters, course: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              className="input w-full"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              className="input w-full"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Min. Nilai Score
            </label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              className="input w-full"
              value={filters.minScore}
              onChange={(e) => setFilters({ ...filters, minScore: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)] block mb-1">
              Maks. Nilai Score
            </label>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="100"
              className="input w-full"
              value={filters.maxScore}
              onChange={(e) => setFilters({ ...filters, maxScore: e.target.value })}
            />
          </div>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Total Token Terpakai"
          value={totalTokens.toLocaleString()}
          icon={<Sparkles className="w-5 h-5 text-[var(--color-accent)]" />}
          footer={
            <p className="text-xs text-[var(--color-text-muted)]">
              Input: {totalPromptTokens.toLocaleString()} · Output: {totalCompletionTokens.toLocaleString()}
            </p>
          }
        />
        <StatCard
          label="Estimasi Pengeluaran (USD)"
          value={`$${estimatedCost.toFixed(4)}`}
          icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
          footer={
            <p className="text-xs text-[var(--color-text-muted)]">
              Berdasarkan tarif token resmi OpenAI & Cerebras
            </p>
          }
        />
        <StatCard
          label="Total Request AI API"
          value={totalRequests.toLocaleString()}
          icon={<Activity className="w-5 h-5 text-cyan-400" />}
          footer={
            <p className="text-xs text-[var(--color-text-muted)]">
              Rata-rata {totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0} token / request
            </p>
          }
        />
        <StatCard
          label={isSuperAdmin ? "Perusahaan Terdata" : "Perusahaan Anda"}
          value={isSuperAdmin ? companyStats.length.toString() : (currentUser?.companyName || "Aktif")}
          icon={<Building2 className="w-5 h-5 text-indigo-400" />}
          footer={
            <p className="text-xs text-[var(--color-text-muted)]">
              {isSuperAdmin ? "Perusahaan aktif bertransaksi token" : "Penyewa tenant aktif"}
            </p>
          }
        />
      </div>

      <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
        <h2 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
          Tren Penggunaan Token Harian
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usage?.byDay || []}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
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
              <Area
                type="monotone"
                dataKey="totalTokens"
                name="Total Token"
                stroke="var(--color-accent)"
                fillOpacity={1}
                fill="url(#colorTokens)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">Penggunaan Per Model</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={usage?.byModel || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" />
                <XAxis type="number" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis
                  dataKey="model"
                  type="category"
                  stroke="var(--color-text-muted)"
                  fontSize={12}
                  width={110}
                />
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
                      fill={isGPT(entry.model) ? "#10B981" : "#8B5CF6"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4 text-[var(--color-text)]">
            Rincian Biaya per Provider
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
                  <th className="pb-3 font-semibold">Model</th>
                  <th className="pb-3 font-semibold">Provider</th>
                  <th className="pb-3 font-semibold text-right">Prompt</th>
                  <th className="pb-3 font-semibold text-right">Completion</th>
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
                      <td className="py-3.5 text-right text-[var(--color-text-muted)]">
                        {item.promptTokens.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right text-[var(--color-text-muted)]">
                        {item.completionTokens.toLocaleString()}
                      </td>
                      <td className="py-3.5 text-right font-semibold text-[var(--color-text)]">
                        ${item.estimatedCostUSD.toFixed(5)}
                      </td>
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

      <section className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-lg font-semibold text-[var(--color-text)]">
              Rekapitulasi Penggunaan & Biaya per Perusahaan
            </h3>
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">
            Total {companyStats.length} Perusahaan Terdata
          </span>
        </div>

        {!companyStats.length ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">
            Belum ada data transaksi per perusahaan untuk filter yang dipilih.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Nama Perusahaan</th>
                  <th className="pb-3 font-semibold text-right">Requests</th>
                  <th className="pb-3 font-semibold text-right">Prompt Tokens</th>
                  <th className="pb-3 font-semibold text-right">Completion Tokens</th>
                  <th className="pb-3 font-semibold text-right">Total Tokens</th>
                  <th className="pb-3 font-semibold text-right">Est. Biaya (USD)</th>
                  {isSuperAdmin && <th className="pb-3 font-semibold text-center w-28">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)]">
                {companyStats.map((item) => (
                  <tr key={item.companyId} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 font-medium text-[var(--color-text)]">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[var(--color-text-muted)]" />
                        <span>{item.companyName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 text-right text-[var(--color-text-muted)]">
                      {item.requests.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right text-[var(--color-text-muted)]">
                      {item.promptTokens.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right text-[var(--color-text-muted)]">
                      {item.completionTokens.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right font-semibold text-[var(--color-text)]">
                      {item.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-3.5 text-right font-semibold text-emerald-400">
                      ${item.estimatedCostUSD.toFixed(5)}
                    </td>
                    {isSuperAdmin && (
                      <td className="py-3.5 text-center">
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs inline-flex items-center gap-1"
                          onClick={() => handleFilterByCompany(item.companyId)}
                          title={`Filter hanya untuk ${item.companyName}`}
                        >
                          <span>Pilih</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card overflow-hidden bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
        <div className="p-4 border-b border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--color-text)]">Token Request Details (Log)</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Rincian setiap interaksi percakapan simulasi AI dan penilaian performa
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Tampilkan per halaman:</span>
            <select
              className="input input-sm py-1 px-2 text-xs"
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              <option value="10">10 baris</option>
              <option value="25">25 baris</option>
              <option value="50">50 baris</option>
              <option value="100">100 baris</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider bg-white/5">
                <th className="p-3">Waktu</th>
                {isSuperAdmin && <th className="p-3">Perusahaan</th>}
                <th className="p-3">User & Tim</th>
                <th className="p-3">Course / Modul</th>
                <th className="p-3 text-center">Score</th>
                <th className="p-3">Layanan & Model</th>
                <th className="p-3 text-right">Tokens</th>
                <th className="p-3 text-right">Est. Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border-light)]">
              {usage?.logs.map((log) => {
                const scoreColor =
                  log.score !== null && log.score !== undefined
                    ? log.score >= 80
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : log.score >= 60
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "text-[var(--color-text-muted)]";

                return (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 whitespace-nowrap text-xs text-[var(--color-text-muted)]">
                      {new Date(log.createdAt).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </td>
                    {isSuperAdmin && (
                      <td className="p-3">
                        <span className="font-medium text-[var(--color-text)]">
                          {log.companyName || "-"}
                        </span>
                      </td>
                    )}
                    <td className="p-3">
                      <div className="font-medium text-[var(--color-text)]">{log.userName || "-"}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{log.teamName || "Tanpa Tim"}</div>
                    </td>
                    <td className="p-3 max-w-[200px] truncate" title={log.courseTitle || "-"}>
                      {log.courseTitle || "-"}
                    </td>
                    <td className="p-3 text-center">
                      {log.score !== null && log.score !== undefined ? (
                        <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${scoreColor}`}>
                          {log.score}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">-</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-[var(--color-text)]">{log.service}</div>
                      <div className="text-xs text-[var(--color-text-muted)]">{log.model}</div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="font-medium text-[var(--color-text)]">
                        {log.totalTokens.toLocaleString()}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {log.promptTokens?.toLocaleString() || 0} in / {log.completionTokens?.toLocaleString() || 0} out
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium text-emerald-400">
                      ${(log.estimatedCostUSD || 0).toFixed(5)}
                    </td>
                  </tr>
                );
              })}

              {!usage?.logs.length && (
                <tr>
                  <td
                    colSpan={isSuperAdmin ? 8 : 7}
                    className="p-8 text-center text-[var(--color-text-muted)]"
                  >
                    Tidak ada log request token yang cocok dengan filter yang ditentukan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-[var(--color-border)]">
          <span className="text-xs text-[var(--color-text-muted)]">
            Menampilkan <span className="font-medium text-[var(--color-text)]">{startRecord}</span> -{" "}
            <span className="font-medium text-[var(--color-text)]">{endRecord}</span> dari{" "}
            <span className="font-medium text-[var(--color-text)]">{usage?.meta?.total ?? 0}</span> log request ·
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-secondary btn-sm flex items-center gap-1"
              disabled={page <= 1 || loading}
              onClick={() => setPage((val) => Math.max(val - 1, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>
            <div className="flex items-center gap-1 px-1">
              <span className="text-xs px-2 py-1 rounded bg-white/10 font-medium">
                {page} / {totalPages}
              </span>
            </div>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-1"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((val) => Math.min(val + 1, totalPages))}
            >
              <span>Berikutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="card p-6 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-[var(--color-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            Pemakaian Token per Layanan Sistem
          </h3>
        </div>
        {!usage?.byService.length ? (
          <p className="text-sm text-[var(--color-text-muted)]">
            Belum ada log penggunaan pada periode ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-sm text-[var(--color-text-muted)]">
                  <th className="pb-3 font-semibold">Layanan</th>
                  <th className="pb-3 font-semibold text-right">Total Request</th>
                  <th className="pb-3 font-semibold text-right">Total Token Terpakai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-light)] text-sm">
                {usage.byService.map((item) => (
                  <tr key={item.service} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 font-medium text-[var(--color-text)]">{item.service}</td>
                    <td className="py-3 text-right text-[var(--color-text-muted)]">
                      {item.requests.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-semibold text-[var(--color-text)]">
                      {item.totalTokens.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
