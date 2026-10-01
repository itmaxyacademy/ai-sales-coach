"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Search, UserPlus, Pencil, Trash2, KeyRound, X, Shield, RefreshCw, Key, Eye, EyeOff } from "lucide-react";
import { useAuthStore } from "../../../store/authStore";
import { useRouter } from "next/navigation";
import { SearchInput, PageHeader, AutoSkeleton, ConfirmModal } from "../../../components/ui";
import { DraggableOrgTree, OrgData } from "../../../components/ui/DraggableOrgTree";
import { toast } from "sonner";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  teamId?: string | null;
  team?: { name: string } | null;
  ledTeams?: { team?: { name: string } }[] | null;
}

const roleColor: Record<string, string> = {
  karyawan: "badge-blue",
  manager: "badge-purple",
  company_admin: "badge-red",
  super_admin: "bg-red-900 text-white badge"
};

export default function AdminUsersPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [teams, setTeams] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState(""); // For debouncing or explicit search
  const [error, setError] = useState<string | null>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [orgData, setOrgData] = useState<OrgData | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Super Admin view mode and company selection
  const [viewMode, setViewMode] = useState<"table" | "tree">("table");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  // Modal states
  const [showEditModal, setShowEditModal] = useState<UserItem | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; user: UserItem | null }>({ isOpen: false, user: null });
  
  // Form states
  const [formData, setFormData] = useState({ name: "", email: "", role: "karyawan", password: "", isActive: true, teamId: "" });
  const [formLoading, setFormLoading] = useState(false);
  
  const [companyDomain, setCompanyDomain] = useState("company.com");
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      const queryParams = `?page=${currentPage}&limit=10${search ? `&search=${encodeURIComponent(search)}` : ""}`;
      
      if (currentUser?.role === "super_admin") {
        const [usersRes, treeRes] = await Promise.all([
           apiClient.get(`${endpointPrefix}/users${queryParams}`),
           apiClient.get("/admin/users/tree")
        ]);
        setUsers(usersRes?.data || []);
        setTotalPages(usersRes?.meta?.totalPages || 1);
        setTotalItems(usersRes?.meta?.total || 0);
        setTreeData(treeRes);
        if (treeRes?.companies?.length > 0 && !selectedCompanyId) {
           setSelectedCompanyId(treeRes.companies[0].companyId);
        }
      } else {
        const [usersRes, teamsRes, meRes] = await Promise.all([
          apiClient.get(`${endpointPrefix}/users${queryParams}`),
          apiClient.get("/company/teams"),
          apiClient.get("/company/me")
        ]);
        setUsers(usersRes?.data || []);
        setTotalPages(usersRes?.meta?.totalPages || 1);
        setTotalItems(usersRes?.meta?.total || 0);
        setTeams(teamsRes?.data || []);
        
        if (meRes?.data?.name) {
           setCompanyDomain(meRes.data.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com');
        } else {
           const derived = currentUser?.email?.split("@")[1];
           if (derived && !["gmail.com", "yahoo.com", "hotmail.com"].includes(derived.toLowerCase())) {
             setCompanyDomain(derived);
           }
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load data"));
    } finally {
      setLoading(false);
    }
  };

  // Trigger search on change with a simple delay or via Enter
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1); // Reset page on new search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    fetchData();
  }, [currentPage, search]);

  useEffect(() => {
    if (currentUser?.role === "super_admin" && viewMode === "tree" && selectedCompanyId) {
      apiClient.get(`/company/org-tree?companyId=${selectedCompanyId}`)
        .then(res => setOrgData(res.data))
        .catch(() => toast.error("Failed to load org tree"));
    }
  }, [viewMode, selectedCompanyId, currentUser]);

  const generatePassword = () => {
    const lowers = "abcdefghjkmnpqrstuvwxyz";
    const uppers = "ABCDEFGHJKMNPQRSTUVWXYZ";
    const numbers = "23456789";
    const symbols = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    const allChars = lowers + uppers + numbers + symbols;
    let pwd = lowers[Math.floor(Math.random() * lowers.length)] +
              uppers[Math.floor(Math.random() * uppers.length)] +
              numbers[Math.floor(Math.random() * numbers.length)] +
              symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 12; i++) pwd += allChars[Math.floor(Math.random() * allChars.length)];
    return pwd.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      if (!showEditModal) return;
      const payload: any = { name: formData.name, role: formData.role, isActive: formData.isActive };
      if (formData.role === "karyawan" && formData.teamId) payload.teamId = formData.teamId;
      else if (formData.role === "karyawan") payload.teamId = null;
      
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      await apiClient.patch(`${endpointPrefix}/users/${showEditModal.id}`, payload);
      setShowEditModal(null);
      fetchData();
      toast.success("User updated successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update user"));
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPassword = async (id: string) => {
    let newPassword = prompt("Masukkan password baru (min 6 karakter).\nAtau KOSONGKAN dan klik OK untuk generate password acak otomatis:");
    
    if (newPassword === null) return; // User clicked cancel
    
    if (newPassword === "") {
      newPassword = generatePassword();
    } else if (newPassword.length < 6) {
      toast.error("Password terlalu pendek. Minimal 6 karakter.");
      return;
    }

    try {
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      await apiClient.post(`${endpointPrefix}/users/${id}/reset-password`, { newPassword });
      
      // Update state to show the new password temporarily in the table so it can be copied
      setTempPasswords(prev => ({ ...prev, [id]: newPassword as string }));
      setVisiblePasswords(prev => ({ ...prev, [id]: true }));
      
      toast.success("Password berhasil direset! Silakan salin password baru di tabel.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to reset password"));
    }
  };

  const handleDelete = async () => {
    if (!confirmModal.user) return;
    try {
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      await apiClient.delete(`${endpointPrefix}/users/${confirmModal.user.id}`);
      setConfirmModal({ isOpen: false, user: null });
      fetchData();
      toast.success("User deleted successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete user"));
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      await apiClient.patch(`${endpointPrefix}/users/${user.id}`, { isActive: !user.isActive });
      fetchData();
      toast.success(`User ${user.isActive ? "deactivated" : "activated"} successfully`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to toggle status"));
    } finally {
      setConfirmModal({ isOpen: false, user: null });
    }
  };

  // We don't filter locally anymore because the backend handles pagination & search
  const filtered = users;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage platform users, roles, and access."
        actions={
          <button
            onClick={() => router.push("/admin/users/create")}
            className="btn btn-danger btn-sm flex items-center gap-2"
          >
            <UserPlus className="w-3.5 h-3.5" /> Add User
          </button>
        }
      />

      <SearchInput
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search by name or email..."
        className="max-w-xs"
      />

      <div className="card overflow-hidden">
        <AutoSkeleton isLoading={loading} type="table">
          {error ? (
          <div className="p-8 text-center text-[var(--color-danger)]">{error}</div>
        ) : (
          <>
            {currentUser?.role === "super_admin" && (
              <div className="flex justify-end p-4 border-b border-[var(--color-border)] gap-2 bg-[var(--color-bg)]">
                {viewMode === "tree" && treeData?.companies && (
                  <select 
                    className="input max-w-xs mr-auto"
                    value={selectedCompanyId}
                    onChange={e => setSelectedCompanyId(e.target.value)}
                  >
                    {treeData.companies.map((c: any) => (
                      <option key={c.companyId} value={c.companyId}>{c.companyName}</option>
                    ))}
                  </select>
                )}
                <div className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <button 
                    onClick={() => setViewMode("table")} 
                    className={`px-3 py-1.5 flex items-center gap-2 text-sm font-semibold transition-colors ${viewMode === "table" ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`}
                  >
                    <Search className="w-4 h-4" /> Table
                  </button>
                  <button 
                    onClick={() => setViewMode("tree")} 
                    className={`px-3 py-1.5 flex items-center gap-2 text-sm font-semibold transition-colors ${viewMode === "tree" ? "bg-[var(--color-primary)] text-white" : "hover:bg-[var(--color-bg)] text-[var(--color-text-muted)]"}`}
                  >
                    <Shield className="w-4 h-4" /> Tree
                  </button>
                </div>
              </div>
            )}

            {currentUser?.role === "super_admin" && viewMode === "tree" ? (
              <div className="p-4 bg-[#f8fafc] min-h-[600px]">
                {orgData ? (
                  <DraggableOrgTree key={selectedCompanyId} data={orgData} onAssignUserToTeam={() => {}} canDrag={false} />
                ) : (
                  <div className="text-center py-20 text-[var(--color-text-muted)]">Loading tree data...</div>
                )}
              </div>
            ) : (
              <>
              <div className="table-container">
              <table className="data-table">
                <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Team</th>
                  <th>Password</th>
                  <th>Reset Pwd</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(member => (
                  <tr key={member.id}>
                    <td>
                      <div className="flex flex-col items-center justify-center min-w-0 text-center">
                        <p className="font-medium text-[var(--color-text)] truncate">{member.name}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)] truncate">{member.email}</p>
                      </div>
                    </td>
                    <td><span className={`badge ${roleColor[member.role] || "badge-gray"} capitalize`}>{member.role.replace("_", " ")}</span></td>
                    <td>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {member.team?.name ||
                          member.ledTeams?.map(lt => lt.team?.name).filter(Boolean).join(", ") ||
                          "-"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-center">
                        <code className="px-1.5 py-0.5 bg-[var(--color-bg)] rounded text-[10px] font-mono tracking-wider min-w-[65px] text-center">
                          {tempPasswords[member.id] && visiblePasswords[member.id] ? tempPasswords[member.id] : "••••••••"}
                        </code>
                        <button 
                          onClick={() => {
                            if (!tempPasswords[member.id]) {
                              toast.info("Password lama terenkripsi secara aman. Silakan klik 'Reset' untuk membuat password baru yang bisa dilihat.");
                              return;
                            }
                            setVisiblePasswords(prev => ({ ...prev, [member.id]: !prev[member.id] }));
                          }}
                          className={`p-1 rounded-md transition-colors ${tempPasswords[member.id] ? "text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface)]" : "text-[var(--color-text-muted)]/50 cursor-not-allowed"}`}
                          title="Show/Hide password"
                        >
                          {tempPasswords[member.id] && visiblePasswords[member.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button 
                          onClick={() => {
                            if (!tempPasswords[member.id]) {
                              toast.info("Tidak dapat menyalin password lama yang terenkripsi. Silakan Reset terlebih dahulu.");
                              return;
                            }
                            navigator.clipboard.writeText(tempPasswords[member.id]);
                            toast.success("Password disalin!");
                          }}
                          className={`btn btn-xs px-2 py-1 flex items-center gap-1 ${tempPasswords[member.id] ? "btn-secondary border-[var(--color-success)] text-[var(--color-success)] hover:bg-[var(--color-success)] hover:text-white" : "bg-[var(--color-bg)] text-[var(--color-text-muted)]/50 border border-[var(--color-border)] cursor-not-allowed"}`}
                          title="Copy password"
                        >
                          <Key className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td>
                      <button 
                        onClick={async () => {
                          if (!confirm("Reset password untuk user ini?")) return;
                          try {
                            const newPwd = generatePassword();
                            const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
                            await apiClient.post(`${endpointPrefix}/users/${member.id}/reset-password`, { newPassword: newPwd });
                            setTempPasswords(prev => ({ ...prev, [member.id]: newPwd }));
                            toast.success("Password berhasil direset. Silakan salin password baru di kolom sebelahnya.");
                          } catch (err) {
                            toast.error(getErrorMessage(err, "Gagal reset password"));
                          }
                        }} 
                        className="btn btn-secondary text-[10px] px-2 py-1 flex items-center gap-1"
                        title="Generate new password"
                      >
                        <RefreshCw className="w-3 h-3" /> Reset
                      </button>
                    </td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${member.isActive ? "bg-[var(--color-success)] text-white" : "bg-[var(--color-danger)] text-white"}`}>
                        {member.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1.5">
                        <button 
                          onClick={() => { setFormData({ name: member.name, email: member.email, role: member.role, password: "", isActive: member.isActive, teamId: member.teamId || "" }); setShowEditModal(member); }}
                          className="btn btn-secondary btn-xs btn-icon" title="Edit Profile"
                        >
                          <Pencil className="w-3 h-3 text-[var(--color-text-muted)]" />
                        </button>
                        {member.id !== currentUser?.id && (
                          <button 
                            onClick={() => handleToggleActive(member)}
                            className="btn btn-secondary btn-xs btn-icon" title={member.isActive ? "Deactivate" : "Activate"}
                          >
                            <Trash2 className={`w-3 h-3 ${member.isActive ? "text-[var(--color-danger)]" : "text-[var(--color-success)]"}`} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          <div className="p-4 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between text-sm text-[var(--color-text-muted)] bg-[var(--color-bg)] gap-4">
              <div>
                Showing {totalItems === 0 ? 0 : ((currentPage - 1) * 10) + 1} to {Math.min(currentPage * 10, totalItems)} of {totalItems} users
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary btn-sm px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <div className="flex items-center px-3 font-medium text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md py-1">
                  Page {currentPage} of {totalPages}
                </div>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="btn btn-secondary btn-sm px-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
        </>
      )}
      </AutoSkeleton>
      </div>



      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="font-bold text-lg">Edit User</h2>
              <button onClick={() => setShowEditModal(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Full Name</label>
                <input required type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input disabled type="email" className="input bg-[var(--color-bg)]" value={formData.email} />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Email cannot be changed.</p>
              </div>
              {showEditModal?.id !== currentUser?.id && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Role</label>
                  <select className="input" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="karyawan">Karyawan (Sales Rep)</option>
                    <option value="manager">Team Leader (Manager)</option>
                    <option value="company_admin">Company Admin (HR)</option>
                    {(currentUser?.role === "super_admin" || formData.role === "super_admin") && (
                      <option value="super_admin">Super Admin</option>
                    )}
                  </select>
                </div>
              )}
              {formData.role === "karyawan" && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Assign Team</label>
                  <select className="input" value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})}>
                    <option value="">No Team Assigned</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}
              {showEditModal?.id !== currentUser?.id && (
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                  <span className="text-sm font-medium">Account is Active</span>
                </label>
              )}
              <div className="pt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowEditModal(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" disabled={formLoading} className="btn btn-primary bg-[var(--color-danger)] hover:bg-red-700">
                  {formLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
