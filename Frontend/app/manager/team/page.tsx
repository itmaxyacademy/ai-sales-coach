"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Users, ChevronRight, BarChart3, ClipboardList } from "lucide-react";
import Link from "next/link";
import { SearchInput, PageHeader, EmptyState, AutoSkeleton } from "../../../components/ui";
import { DraggableOrgTree, OrgData } from "../../../components/ui/DraggableOrgTree";
import { toast } from "sonner";
import { Network, List, Info } from "lucide-react";

interface TeamMember {
  id: string; name: string; teamName: string; sawScore: number; sawRank: number | null;
  avgScore: number; completionRate: number; pendingAssignments: number; lastActive: string | null;
}

interface TeamAssignment {
  id: string; userId: string; userName: string; teamName: string; courseTitle: string;
  status: "pending" | "in_progress"; dueAt: string | null; createdAt: string;
}

const scoreColor = (score: number) => {
  if (score >= 80) return "text-[var(--color-success)]";
  if (score >= 60) return "text-[var(--color-warning)]";
  return "text-[var(--color-danger)]";
};

const rankBadge = (rank: number | null) => {
  if (!rank) return <span className="text-[var(--color-text-subtle)]">-</span>;
  if (rank === 1) return <span>🥇 #1</span>;
  if (rank === 2) return <span>🥈 #2</span>;
  if (rank === 3) return <span>🥉 #3</span>;
  return <span className="text-[var(--color-text-muted)]">#{rank}</span>;
};

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMembers, setTotalMembers] = useState(0);
  const [activeTab, setActiveTab] = useState<"table" | "tree" | "assignments">("table");
  const [scope, setScope] = useState<"all" | "team">("team");
  const [assignments, setAssignments] = useState<TeamAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentTotal, setAssignmentTotal] = useState(0);
  const [assignmentTotalPages, setAssignmentTotalPages] = useState(1);
  const [assignmentStatus, setAssignmentStatus] = useState("open");
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setAppliedSearch(search.trim()); setPage(1); setAssignmentPage(1); }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    apiClient.get(`/manager/team?scope=${scope}&page=${page}&search=${encodeURIComponent(appliedSearch)}`)
      .then(res => { setTeam(res?.data || []); setTotalPages(res?.meta?.totalPages || 1); setTotalMembers(res?.meta?.total || 0); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [scope, page, appliedSearch]);

  useEffect(() => {
    if (activeTab !== "assignments") return;
    setAssignmentsLoading(true);
    apiClient.get(`/manager/assignments?page=${assignmentPage}&status=${assignmentStatus}&search=${encodeURIComponent(appliedSearch)}`)
      .then(res => { setAssignments(res?.data || []); setAssignmentTotal(res?.meta?.total || 0); setAssignmentTotalPages(res?.meta?.totalPages || 1); })
      .catch(err => toast.error(getErrorMessage(err, "Gagal memuat assignment terbuka")))
      .finally(() => setAssignmentsLoading(false));
  }, [activeTab, assignmentPage, assignmentStatus, appliedSearch]);

  useEffect(() => {
    if (activeTab === "tree") {
      fetchOrgTree();
    }
  }, [activeTab, scope]);

  const fetchOrgTree = () => {
    setOrgLoading(true);
    apiClient.get(`/company/org-tree?scope=${scope}`)
      .then(res => { if (res?.data) setOrgData(res.data); })
      .catch(() => toast.error("Gagal memuat struktur organisasi"))
      .finally(() => setOrgLoading(false));
  };

  const handleAssignUser = async (userId: string, teamId: string | null, newRole?: "manager" | "karyawan") => {
    try {
      await apiClient.patch("/company/org-tree/assign", { userId, teamId, role: newRole || "karyawan" });
      toast.success("Anggota berhasil dipindahkan");
      fetchOrgTree(); // Refresh
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal memindahkan anggota"));
    }
  };

  const filtered = team;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="My Team"
        subtitle="SAW-ranked sales rep performance overview."
        // icon={<Users className="w-4 h-4" />}
        actions={
          <div className="flex items-center gap-4">
            {activeTab !== "tree" && <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={activeTab === "assignments" ? "Cari anggota, tim, atau course..." : "Search member..."}
              className="w-52"
            />}
            {activeTab === "assignments" && <select className="input w-40" value={assignmentStatus} onChange={event => { setAssignmentPage(1); setAssignmentStatus(event.target.value); }} aria-label="Status assignment">
              <option value="open">Semua yang terbuka</option><option value="pending">Pending</option><option value="in_progress">In progress</option>
            </select>}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Scope:</span>
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 flex items-center">
                <button 
                  onClick={() => { setPage(1); setAssignmentPage(1); setScope("all"); }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${scope === "all" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                >
                  All Karyawan
                </button>
                <button 
                  onClick={() => { setPage(1); setAssignmentPage(1); setScope("team"); }}
                  className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${scope === "team" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                >
                  My Team Only
                </button>
              </div>
            </div>
          </div>
        }
      />

      <div className="flex border-b border-[var(--color-border)] gap-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab("table")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "table" 
              ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-bg)]" 
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          }`}
        >
          <List className="w-4 h-4" /> Performance Table
        </button>
        <button
          onClick={() => setActiveTab("tree")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "tree" 
              ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-bg)]" 
              : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
          }`}
        >
          <Network className="w-4 h-4" /> Organization Tree
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === "assignments" ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-bg)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"}`}
        >
          <ClipboardList className="w-4 h-4" /> Open Assignments
        </button>
      </div>

      {activeTab === "table" && (
        <div className="card">
          <AutoSkeleton isLoading={loading} type="table">
          {error ? (
            <div className="p-8 text-center text-[var(--color-danger)]">{error}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="w-9 h-9" />}
              title="No members found"
              description="Try a different search."
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Team</th>
                    <th>
                    <div className="flex items-center gap-1" title="Simple Additive Weighting (Performance Score)">
                      SAW Score <Info className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </div>
                  </th>
                  <th>
                    <div className="flex items-center gap-1" title="Rata-rata skor evaluasi simulasi AI">
                      Avg Score <Info className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </div>
                  </th>
                  <th>
                    <div className="flex items-center gap-1" title="Persentase course / assignment yang diselesaikan">
                      Completion <Info className="w-3 h-3 text-[var(--color-text-muted)]" />
                    </div>
                  </th>
                  <th>Open assignments</th>
                  <th>Last Active</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => (
                  <tr key={member.id}>
                    <td className="font-semibold">{rankBadge(member.sawRank)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-xs font-bold text-[var(--color-accent)]">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--color-text)]">{member.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface)] px-2 py-1 rounded-md border border-[var(--color-border)]">
                        {member.teamName}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 progress-bar">
                          <div className="progress-fill" style={{ width: `${member.sawScore * 100}%` }} />
                        </div>
                        <span className="text-xs font-medium">{(member.sawScore * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`font-bold ${scoreColor(member.avgScore)}`}>{member.avgScore}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 progress-bar">
                          <div
                            className={`progress-fill ${member.completionRate >= 80 ? "progress-fill-green" : member.completionRate >= 50 ? "" : "progress-fill-red"}`}
                            style={{ width: `${member.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs">{member.completionRate}%</span>
                      </div>
                    </td>
                    <td className={member.pendingAssignments > 0 ? "font-semibold text-[var(--color-warning)]" : "text-[var(--color-text-muted)]"}>
                      {member.pendingAssignments}
                    </td>
                    <td className="text-xs text-[var(--color-text-muted)]">
                      {member.lastActive ? new Date(member.lastActive).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "Never"}
                    </td>
                    <td>
                      <Link href={`/manager/team/${member.id}`} className="flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline">
                        Details <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </AutoSkeleton>
        {totalPages > 1 && <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--color-border)]"><span className="text-xs text-[var(--color-text-muted)]">{(page - 1) * 50 + 1}–{Math.min(page * 50, totalMembers)} dari {totalMembers} anggota</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span className="self-center text-xs text-[var(--color-text-muted)]">{page} / {totalPages}</span><button className="btn btn-secondary btn-sm" disabled={page >= totalPages || loading} onClick={() => setPage(value => value + 1)}>Berikutnya</button></div></div>}
      </div>
      )}

      {activeTab === "assignments" && (
        <div className="card">
          <AutoSkeleton isLoading={assignmentsLoading} type="table">
            {assignments.length === 0 ? <EmptyState icon={<ClipboardList className="w-9 h-9" />} title="No open assignments" description="Try another search or status." /> : (
              <div className="table-container"><table className="data-table"><thead><tr><th>Member</th><th>Team</th><th>Course</th><th>Status</th><th>Due</th><th></th></tr></thead><tbody>
                {assignments.map(item => <tr key={item.id}>
                  <td className="font-medium">{item.userName}</td><td>{item.teamName}</td><td>{item.courseTitle}</td>
                  <td><span className={`badge ${item.status === "pending" ? "badge-yellow" : "badge-blue"}`}>{item.status.replace("_", " ")}</span></td>
                  <td className={item.dueAt && new Date(item.dueAt) < new Date() ? "text-[var(--color-danger)]" : ""}>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "-"}</td>
                  <td><Link href={`/manager/team/${item.userId}`} className="text-xs text-[var(--color-accent)] hover:underline">Member details</Link></td>
                </tr>)}
              </tbody></table></div>
            )}
          </AutoSkeleton>
          {assignmentTotalPages > 1 && <div className="flex items-center justify-between gap-3 p-4 border-t border-[var(--color-border)]"><span className="text-xs text-[var(--color-text-muted)]">{assignmentTotal} open assignments · Page {assignmentPage} of {assignmentTotalPages}</span><div className="flex gap-2"><button className="btn btn-secondary btn-sm" disabled={assignmentPage <= 1 || assignmentsLoading} onClick={() => setAssignmentPage(value => value - 1)}>Previous</button><button className="btn btn-secondary btn-sm" disabled={assignmentPage >= assignmentTotalPages || assignmentsLoading} onClick={() => setAssignmentPage(value => value + 1)}>Next</button></div></div>}
        </div>
      )}

      {activeTab === "tree" && (
        <div className="card p-6">
          <AutoSkeleton isLoading={orgLoading} type="card">
            {orgData && (
              <div className="mt-2 min-h-[500px]">
                <DraggableOrgTree 
                  data={orgData} 
                  onAssignUserToTeam={handleAssignUser} 
                  canDrag={true} 
                />
              </div>
            )}
          </AutoSkeleton>
        </div>
      )}
    </div>
  );
}
