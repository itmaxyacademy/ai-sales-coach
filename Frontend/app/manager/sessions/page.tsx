"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { PageHeader, EmptyState, PeriodSwitcher, SearchInput, AutoSkeleton } from "../../../components/ui";
import { History } from "lucide-react";
import Link from "next/link";

interface Session {
  id: string;
  course: { title: string };
  userName: string;
  totalScore: number;
  outcome: string;
  completedAt: string;
  turnCount: number;
}

const PERIOD_OPTIONS = [
  { key: "7days", label: "7 Days" },
  { key: "30days", label: "30 Days" },
  { key: "alltime", label: "All Time" },
];

export default function ManagerSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("30days");
  const [filters, setFilters] = useState({ search: "", outcome: "", minScore: "", maxScore: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSessions, setTotalSessions] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    // Fetch sessions
    const params = new URLSearchParams({ period, page: String(page) });
    Object.entries(appliedFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    apiClient.get(`/manager/sessions?${params}`)
      .then((res) => {
        if (res.sessions || res.data) {
          setSessions(res.sessions || res.data);
          setTotalPages(res.meta?.totalPages || 1);
          setTotalSessions(res.meta?.total || 0);
        }
      })
      .catch((err) => setError(getErrorMessage(err, "Gagal memuat sesi tim.")))
      .finally(() => setLoading(false));
  }, [period, appliedFilters, page]);

  const filteredSessions = sessions;

  const scoreColor = (s: number) =>
    s >= 80 ? "text-[var(--color-success)]" : s >= 60 ? "text-[var(--color-warning)]" : "text-[var(--color-danger)]";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Team Sessions"
        subtitle="Review roleplay sessions completed by your team."
        // icon={<History className="w-5 h-5" />}
        actions={
          <PeriodSwitcher options={PERIOD_OPTIONS} value={period} onChange={value => { setPeriod(value); setPage(1); }} />
        }
      />

      <form className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={event => { event.preventDefault(); setPage(1); setAppliedFilters(filters); }}>
        <label className="text-xs">Cari anggota atau course<SearchInput value={filters.search} onChange={value => setFilters(current => ({ ...current, search: value }))} placeholder="Nama atau judul course" className="mt-1" /></label>
        <label className="text-xs">Hasil sesi<select className="input mt-1 w-full" value={filters.outcome} onChange={event => setFilters(current => ({ ...current, outcome: event.target.value }))}><option value="">Semua hasil</option><option value="closed">Closed</option><option value="follow_up">Follow up</option><option value="rejected">Rejected</option></select></label>
        <label className="text-xs">Skor minimum<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.minScore} onChange={event => setFilters(current => ({ ...current, minScore: event.target.value }))} /></label>
        <label className="text-xs">Skor maksimum<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.maxScore} onChange={event => setFilters(current => ({ ...current, maxScore: event.target.value }))} /></label>
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3"><button type="submit" className="btn btn-primary btn-sm">Terapkan filter</button><button type="button" className="btn btn-secondary btn-sm" onClick={() => { const cleared = { search: "", outcome: "", minScore: "", maxScore: "" }; setFilters(cleared); setAppliedFilters(cleared); setPage(1); }}>Reset</button><span className="text-xs text-[var(--color-text-muted)]">Periode memakai pilihan di bagian atas.</span></div>
      </form>

      <div className="card p-4">

        <AutoSkeleton isLoading={loading} type="table">
          {error ? (
            <div role="alert" className="p-8 text-[var(--color-danger)] text-center">{error}</div>
          ) : filteredSessions.length === 0 ? (
            <EmptyState
              icon={<History className="w-8 h-8" />}
              title="No sessions found"
              description={Object.values(appliedFilters).some(Boolean) ? "Coba ubah filter pencarian." : "Tim belum menyelesaikan sesi pada periode ini."}
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Course</th>
                    <th>Score</th>
                    <th>Outcome</th>
                    <th>Turns</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium text-[var(--color-text)]">{s.userName}</td>
                      <td className="text-sm">{s.course?.title}</td>
                      <td>
                        <span className={`font-bold text-sm ${scoreColor(s.totalScore)}`}>
                          {s.totalScore ?? "-"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${
                          s.outcome === "closed" ? "badge-green" : s.outcome === "follow_up" ? "badge-yellow" : "badge-red"
                        } capitalize`}>
                          {s.outcome?.replace("_", " ")}
                        </span>
                      </td>
                      <td className="text-sm text-[var(--color-text-muted)]">{s.turnCount}</td>
                      <td className="text-sm text-[var(--color-text-muted)]">
                        {new Date(s.completedAt).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td>
                        <Link href={`/manager/sessions/${s.id}`} className="btn btn-secondary btn-xs">
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && <div className="flex items-center justify-between gap-3 pt-4"><span className="text-xs text-[var(--color-text-muted)]">{(page - 1) * 50 + 1}–{Math.min(page * 50, totalSessions)} dari {totalSessions} sesi</span><div className="flex items-center gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span className="text-xs text-[var(--color-text-muted)]">{page} / {totalPages}</span><button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>}
        </AutoSkeleton>
      </div>
    </div>
  );
}
