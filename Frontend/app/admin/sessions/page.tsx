"use client";
import { getErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Activity, ShieldAlert } from "lucide-react";
import { PageHeader, EmptyState, AutoSkeleton, ConfirmModal } from "../../../components/ui";

interface AdminSession {
  id: string; status: string; totalScore: number | null;
  turnCount: number; startedAt: string; createdAt?: string;
  outcome?: string | null;
  course: { title: string };
  user: { name: string; email: string; team?: { name: string } | null };
}

type SessionFilters = { employee: string; team: string; course: string; from: string; to: string; status: string; minScore: string; maxScore: string };
const emptyFilters: SessionFilters = { employee: "", team: "", course: "", from: "", to: "", status: "all", minScore: "", maxScore: "" };
const queryFor = (filters: SessionFilters) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  return params.toString();
};
const sessionUrl = (filters: SessionFilters, page: number) => {
  const params = new URLSearchParams(queryFor(filters));
  params.set("page", String(page));
  return `/admin/sessions?${params}`;
};

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SessionFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<SessionFilters>(emptyFilters);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false });

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient.get(sessionUrl(appliedFilters, page))
      .then(res => { if (res?.data) setSessions(res.data); setTotalPages(res?.meta?.totalPages ?? 1); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [appliedFilters, refresh, page]);

  const handleClearStuck = async () => {
    try {
      const res = await apiClient.post("/admin/system/cleanup-sessions", {}).catch(() => apiClient.delete("/admin/system/cleanup-sessions"));
      toast.success(res?.message || "Stuck sessions cleared");
      setRefresh(value => value + 1);
    } catch (e) { toast.error(getErrorMessage(e, "Failed to clear sessions")); }
    finally { setConfirmModal({ isOpen: false }); }
  };

  const filtered = sessions;
  const exportCsv = async () => {
    try {
      const blob = await apiClient.get(`/admin/sessions/export?${queryFor(appliedFilters)}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sessions-export.csv";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { toast.error(getErrorMessage(err, "Gagal mengekspor laporan")); }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Session Activity"
        subtitle="Audit log of all roleplay sessions across the platform."
        // icon={<Activity className="w-4 h-4" />}
        actions={
          <div className="flex gap-2">
            <button onClick={exportCsv} className="btn btn-secondary btn-sm">Export CSV</button>
            <button onClick={() => setConfirmModal({ isOpen: true })} className="btn btn-secondary btn-sm flex items-center gap-1.5 hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]">
              <ShieldAlert className="w-3.5 h-3.5" /> Clear Stuck Sessions
            </button>
          </div>
        }
      />

      <form className="card p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" onSubmit={event => { event.preventDefault(); setPage(1); setAppliedFilters(filters); }}>
        <label className="text-xs">Employee<input className="input mt-1 w-full" value={filters.employee} onChange={event => setFilters({ ...filters, employee: event.target.value })} placeholder="Name or email" /></label>
        <label className="text-xs">Team<input className="input mt-1 w-full" value={filters.team} onChange={event => setFilters({ ...filters, team: event.target.value })} placeholder="Team name" /></label>
        <label className="text-xs">Course<input className="input mt-1 w-full" value={filters.course} onChange={event => setFilters({ ...filters, course: event.target.value })} placeholder="Course title" /></label>
        <label className="text-xs">Status<select className="input mt-1 w-full" value={filters.status} onChange={event => setFilters({ ...filters, status: event.target.value })}><option value="all">All</option><option value="completed">Completed</option><option value="active">Active</option><option value="abandoned">Abandoned</option></select></label>
        <label className="text-xs">From<input type="date" className="input mt-1 w-full" value={filters.from} onChange={event => setFilters({ ...filters, from: event.target.value })} /></label>
        <label className="text-xs">To<input type="date" className="input mt-1 w-full" value={filters.to} onChange={event => setFilters({ ...filters, to: event.target.value })} /></label>
        <label className="text-xs">Min score<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.minScore} onChange={event => setFilters({ ...filters, minScore: event.target.value })} /></label>
        <label className="text-xs">Max score<input type="number" min="0" max="100" className="input mt-1 w-full" value={filters.maxScore} onChange={event => setFilters({ ...filters, maxScore: event.target.value })} /></label>
        <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3"><button className="btn btn-primary btn-sm" type="submit">Apply filters</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => { setFilters(emptyFilters); setPage(1); setAppliedFilters(emptyFilters); }}>Reset</button><span className="text-xs text-[var(--color-text-muted)]">Date range applies to session start time.</span></div>
      </form>

      <div className="card">
        <AutoSkeleton isLoading={loading} type="table">
          {error ? (
            <div className="p-8 text-[var(--color-danger)] text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Activity className="w-9 h-9" />}
              title="No sessions found"
              description="No sessions match your search."
            />
          ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session ID</th>
                  <th>User</th>
                  <th>Course</th>
                  <th>Team</th>
                  <th>Status</th>
                  <th>Score / Turns</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="text-xs font-mono text-[var(--color-text-muted)]">{s.id.split("-")[0]}...</td>
                    <td>
                      <p className="font-medium text-[var(--color-text)]">{s.user.name}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{s.user.email}</p>
                    </td>
                    <td className="text-sm">{s.course.title}</td>
                    <td className="text-sm">{s.user.team?.name ?? "-"}</td>
                    <td>
                      {s.status === "completed" && s.turnCount > 0 ? (
                        <span className="badge badge-green">Completed</span>
                      ) : s.status === "abandoned" || (s.status === "completed" && s.turnCount === 0) ? (
                        <span className="badge badge-red">Abandoned</span>
                      ) : (
                        <span className="badge badge-yellow animate-pulse">Active</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {s.status === "completed" && s.turnCount > 0 ? (
                        <span className="font-bold">{s.totalScore ?? "-"} <span className="font-normal text-[var(--color-text-muted)] text-xs ml-1">({s.turnCount} turns)</span></span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">0 turns (No interaction)</span>
                      )}
                    </td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                       {s.startedAt
                         ? new Date(s.startedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
                         : "-"}
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && <div className="flex items-center justify-end gap-3 p-4 border-t border-[var(--color-border)]"><span className="text-xs text-[var(--color-text-muted)]">Page {page} of {totalPages}</span><button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>Next</button></div>}
        </AutoSkeleton>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Clear Stuck Sessions"
        message="Are you sure you want to clear all abandoned sessions? This cannot be undone."
        confirmText="Clear Sessions"
        onConfirm={handleClearStuck}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />
    </div>
  );
}
