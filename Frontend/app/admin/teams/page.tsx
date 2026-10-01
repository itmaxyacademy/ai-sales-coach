"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Plus, Users, Trash2, Edit2, Shield, X, AlertCircle, Building2, Network, List } from "lucide-react";
import { PageHeader, SearchInput, EmptyState, AutoSkeleton } from "../../../components/ui";
import { DraggableOrgTree, OrgData } from "../../../components/ui/DraggableOrgTree";
import { useAuthStore } from "../../../store/authStore";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  teamId?: string | null;
  team?: { name: string } | null;
}

interface TeamLeader {
  userId: string;
  user: User;
}

interface Team {
  id: string;
  name: string;
  description: string;
  _count: { members: number };
  leaders: TeamLeader[];
  members: User[];
}

export default function AdminTeamsPage() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const [orgData, setOrgData] = useState<OrgData | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);
  
  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: "", name: "", description: "" });
  const [formLoading, setFormLoading] = useState(false);

  // Manage Leaders Modal
  const [showLeadersModal, setShowLeadersModal] = useState<string | null>(null);
  const [selectedLeaderId, setSelectedLeaderId] = useState("");

  // Manage Members Modal
  const [showMembersModal, setShowMembersModal] = useState<string | null>(null);
  const [membersList, setMembersList] = useState<User[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [pickerUsers, setPickerUsers] = useState<User[]>([]);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerMeta, setPickerMeta] = useState({ total: 0, totalPages: 1 });
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerRefresh, setPickerRefresh] = useState(0);

  const fetchTeams = () => {
    setLoading(true);
    apiClient.get("/company/teams")
      .then(res => {
        setTeams(res?.data || []);
      })
      .catch(err => toast.error(getErrorMessage(err, "Failed to load teams")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (currentUser?.role === "super_admin") {
      router.replace("/admin/dashboard");
      return;
    }
    fetchTeams();
  }, [currentUser, router]);

  useEffect(() => {
    const teamId = showLeadersModal || showMembersModal;
    const role = showLeadersModal ? "manager" : showMembersModal ? "karyawan" : null;
    if (!teamId || !role) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setPickerLoading(true);
      setPickerUsers([]);
      const requests = [apiClient.get(`/company/users?role=${role}&page=${pickerPage}&limit=20&search=${encodeURIComponent(pickerSearch)}`)];
      if (showMembersModal) requests.push(apiClient.get(`/company/teams/${showMembersModal}`));
      Promise.all(requests).then(([usersRes, teamRes]) => {
        if (cancelled) return;
        setPickerUsers(usersRes?.data || []);
        setPickerMeta({ total: usersRes?.meta?.total || 0, totalPages: usersRes?.meta?.totalPages || 1 });
        if (teamRes) setMembersList(teamRes.data?.members || []);
      }).catch(err => { if (!cancelled) toast.error(getErrorMessage(err, "Gagal memuat daftar akun")); })
        .finally(() => { if (!cancelled) setPickerLoading(false); });
    }, 200);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [showLeadersModal, showMembersModal, pickerSearch, pickerPage, pickerRefresh]);

  useEffect(() => {
    if (viewMode === "tree" && !orgData) {
      fetchOrgTree();
    }
  }, [viewMode]);

  const fetchOrgTree = () => {
    setOrgLoading(true);
    apiClient.get("/company/org-tree")
      .then(res => { if (res?.data) setOrgData(res.data); })
      .catch(() => toast.error("Gagal memuat struktur organisasi"))
      .finally(() => setOrgLoading(false));
  };

  const handleAssignUser = async (userId: string, teamId: string | null, newRole?: "manager" | "karyawan") => {
    try {
      await apiClient.patch("/company/org-tree/assign", { userId, teamId, role: newRole || "karyawan" });
      toast.success("Anggota berhasil dipindahkan");
      fetchOrgTree(); // Refresh tree
      fetchTeams(); // Refresh table stats
      setPickerRefresh(value => value + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal memindahkan anggota"));
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (formData.id) {
        await apiClient.patch(`/company/teams/${formData.id}`, {
          name: formData.name,
          description: formData.description
        });
        toast.success("Team updated successfully");
      } else {
        await apiClient.post("/company/teams", {
          name: formData.name,
          description: formData.description
        });
        toast.success("Team created successfully");
      }
      setShowModal(false);
      fetchTeams();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save team"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm("Are you sure you want to delete this team?")) return;
    try {
      await apiClient.delete(`/company/teams/${id}`);
      toast.success("Team deleted successfully");
      fetchTeams();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete team"));
    }
  };

  const handleAssignLeader = async (teamId: string) => {
    if (!selectedLeaderId) return toast.error("Select a manager first");
    try {
      await apiClient.post(`/company/teams/${teamId}/leaders`, { userId: selectedLeaderId });
      toast.success("Manager assigned to team");
      setSelectedLeaderId("");
      fetchTeams();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to assign manager"));
    }
  };

  const handleRemoveLeader = async (teamId: string, userId: string) => {
    try {
      await apiClient.delete(`/company/teams/${teamId}/leaders/${userId}`);
      toast.success("Manager removed from team");
      fetchTeams();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove manager"));
    }
  };

  const handleAssignMember = async (teamId: string) => {
    if (!selectedMemberId) return toast.error("Select an employee first");
    try {
      await apiClient.patch(`/company/users/${selectedMemberId}`, { teamId });
      toast.success("Employee assigned to team");
      setSelectedMemberId("");
      fetchTeams();
      setPickerRefresh(value => value + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to assign employee"));
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await apiClient.patch(`/company/users/${userId}`, { teamId: null });
      toast.success("Employee removed from team");
      fetchTeams();
      setPickerRefresh(value => value + 1);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove employee"));
    }
  };

  const filtered = teams.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCurrentMembers = membersList.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(pickerSearch.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Team Management"
        subtitle="Create teams and assign managers to oversee them."
        actions={
          <div className="flex items-center gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search teams..."
              className="w-64"
            />
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1 flex items-center">
              <button 
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "table" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode("tree")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "tree" ? "bg-[var(--color-bg)] text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"}`}
                title="Organization Tree View"
              >
                <Network className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => {
                setFormData({ id: "", name: "", description: "" });
                setShowModal(true);
              }}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" /> New Team
            </button>
          </div>
        }
      />

      <div className="card">
        <AutoSkeleton isLoading={loading} type="table">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10" />}
              title="No teams found"
              description="Create a new team to organize your employees."
            />
          ) : viewMode === "table" ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Description</th>
                    <th>Members</th>
                    <th>Assigned Managers</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(team => (
                    <tr key={team.id}>
                      <td className="font-semibold">{team.name}</td>
                      <td className="text-sm text-[var(--color-text-muted)] max-w-[200px] truncate">
                        {team.description || "No description"}
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {team._count.members} Members
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {team.leaders.length > 0 ? (
                            team.leaders.map(l => (
                              <span key={l.userId} className="text-xs flex items-center gap-1 bg-[var(--color-bg)] rounded px-2 py-1 w-max border border-[var(--color-border)]">
                                <Shield className="w-3 h-3 text-[var(--color-purple)]" />
                                {l.user.name}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--color-warning)] flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> No Manager
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-right space-x-2">
                        <button
                          onClick={() => { setPickerSearch(""); setPickerPage(1); setMembersList([]); setShowMembersModal(team.id); }}
                          className="btn btn-secondary btn-xs"
                          title="Manage Members"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setPickerSearch(""); setPickerPage(1); setShowLeadersModal(team.id); }}
                          className="btn btn-secondary btn-xs"
                          title="Manage Leaders"
                        >
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setFormData({ id: team.id, name: team.name, description: team.description || "" });
                            setShowModal(true);
                          }}
                          className="btn btn-secondary btn-xs"
                          title="Edit Team"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="btn btn-secondary btn-xs text-[var(--color-danger)] hover:bg-[var(--color-danger-light)] border-transparent"
                          title="Delete Team"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <AutoSkeleton isLoading={orgLoading} type="card">
              {orgData && (
                <DraggableOrgTree 
                  data={orgData} 
                  onAssignUserToTeam={handleAssignUser} 
                  canDrag={true} 
                />
              )}
            </AutoSkeleton>
          )}
        </AutoSkeleton>
      </div>

      {/* CREATE/EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-lg">{formData.id ? "Edit Team" : "Create New Team"}</h2>
              <button onClick={() => setShowModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveTeam} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Team Name</label>
                <input
                  required
                  type="text"
                  className="input"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Inbound Sales B2B"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Description (Optional)</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What is this team responsible for?"
                />
              </div>
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn btn-primary bg-[var(--color-danger)] hover:bg-red-700">
                  {formLoading ? "Saving..." : "Save Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE LEADERS MODAL */}
      {showLeadersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-lg">Manage Team Managers</h2>
              <button onClick={() => setShowLeadersModal(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium">Cari manager<input className="input mt-1 w-full" value={pickerSearch} onChange={event => { setPickerSearch(event.target.value); setPickerPage(1); }} placeholder="Nama atau email" /></label>
                <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={selectedLeaderId}
                  onChange={e => setSelectedLeaderId(e.target.value)}
                >
                  <option value="">Select a manager to assign...</option>
                  {pickerUsers.filter(u => !teams.find(team => team.id === showLeadersModal)?.leaders.some(leader => leader.userId === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssignLeader(showLeadersModal)}
                  className="btn btn-primary"
                  disabled={!selectedLeaderId}
                >
                  Assign
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>{pickerLoading ? "Memuat manager..." : `${pickerMeta.total ? (pickerPage - 1) * 20 + 1 : 0}–${Math.min(pickerPage * 20, pickerMeta.total)} dari ${pickerMeta.total}`}</span>
                <div className="flex gap-2"><button type="button" className="btn btn-secondary btn-xs" disabled={pickerPage <= 1 || pickerLoading} onClick={() => setPickerPage(value => value - 1)}>Sebelumnya</button><button type="button" className="btn btn-secondary btn-xs" disabled={pickerPage >= pickerMeta.totalPages || pickerLoading} onClick={() => setPickerPage(value => value + 1)}>Berikutnya</button></div>
              </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--color-bg)] p-2 text-xs font-bold border-b border-[var(--color-border)]">
                  Currently Assigned Managers
                </div>
                <div className="divide-y divide-[var(--color-border)] max-h-48 overflow-y-auto">
                  {teams.find(t => t.id === showLeadersModal)?.leaders.map(l => (
                    <div key={l.userId} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[var(--color-purple)]" />
                        <span className="font-medium">{l.user.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveLeader(showLeadersModal, l.userId)}
                        className="text-[var(--color-danger)] hover:underline text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {teams.find(t => t.id === showLeadersModal)?.leaders.length === 0 && (
                    <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                      No managers assigned to this team yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button type="button" onClick={() => setShowLeadersModal(null)} className="btn btn-secondary">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE MEMBERS MODAL */}
      {showMembersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-lg">Manage Team Members</h2>
              <button onClick={() => setShowMembersModal(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-medium">Cari karyawan<input className="input mt-1 w-full" value={pickerSearch} onChange={event => { setPickerSearch(event.target.value); setPickerPage(1); }} placeholder="Nama atau email" /></label>
                <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={selectedMemberId}
                  onChange={e => setSelectedMemberId(e.target.value)}
                >
                  <option value="">Select an employee to assign...</option>
                  {pickerUsers.filter(u => u.teamId !== showMembersModal).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.team?.name || "No Team"})</option>
                  ))}
                </select>
                <button
                  onClick={() => handleAssignMember(showMembersModal)}
                  className="btn btn-primary"
                  disabled={!selectedMemberId}
                >
                  Assign
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                <span>{pickerLoading ? "Memuat karyawan..." : `${pickerMeta.total ? (pickerPage - 1) * 20 + 1 : 0}–${Math.min(pickerPage * 20, pickerMeta.total)} dari ${pickerMeta.total}`}</span>
                <div className="flex gap-2"><button type="button" className="btn btn-secondary btn-xs" disabled={pickerPage <= 1 || pickerLoading} onClick={() => setPickerPage(value => value - 1)}>Sebelumnya</button><button type="button" className="btn btn-secondary btn-xs" disabled={pickerPage >= pickerMeta.totalPages || pickerLoading} onClick={() => setPickerPage(value => value + 1)}>Berikutnya</button></div>
              </div>
              </div>

              <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                <div className="bg-[var(--color-bg)] p-2 text-xs font-bold border-b border-[var(--color-border)]">
                  Current Team Members
                </div>
                <div className="divide-y divide-[var(--color-border)] max-h-48 overflow-y-auto">
                  {filteredCurrentMembers.map(u => (
                    <div key={u.id} className="flex items-center justify-between p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-[var(--color-blue)]" />
                        <span className="font-medium">{u.name}</span>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(u.id)}
                        className="text-[var(--color-danger)] hover:underline text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {filteredCurrentMembers.length === 0 && (
                    <div className="p-4 text-center text-xs text-[var(--color-text-muted)]">
                      {pickerSearch ? "Tidak ada anggota yang cocok dengan pencarian." : "Belum ada karyawan di tim ini."}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button type="button" onClick={() => setShowMembersModal(null)} className="btn btn-secondary">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}