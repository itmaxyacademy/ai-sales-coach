"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../../lib/api/client";
import { useAuthStore } from "../../../../store/authStore";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X, ArrowLeft } from "lucide-react";
import { PageHeader } from "../../../../components/ui";

export default function CreateUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Form states
  const [formData, setFormData] = useState({ name: "", email: "", role: "karyawan", password: "", isActive: true, teamId: "", companyId: "" });
  const [formLoading, setFormLoading] = useState(false);
  
  // Manager wizard states
  const [managerAction, setManagerAction] = useState<"none" | "assign" | "create">("none");
  const [managerTeamId, setManagerTeamId] = useState("");
  const [managerNewTeamName, setManagerNewTeamName] = useState("");
  const [managerSelectedMembers, setManagerSelectedMembers] = useState<string[]>([]);
  const [managerNewSalesReps, setManagerNewSalesReps] = useState([{ name: "", email: "", password: "" }]);
  const [addStep, setAddStep] = useState(1);
  const [companyDomain, setCompanyDomain] = useState("company.com");

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

  useEffect(() => {
    setFormData(prev => ({ ...prev, password: generatePassword() }));
    
    const fetchData = async () => {
      try {
        const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
        const [usersRes, teamsRes, meRes, companiesRes] = await Promise.all([
          apiClient.get(`${endpointPrefix}/users`),
          currentUser?.role === "super_admin" ? Promise.resolve({ data: [] }) : apiClient.get("/company/teams"),
          currentUser?.role === "super_admin" ? Promise.resolve(null) : apiClient.get("/company/me"),
          currentUser?.role === "super_admin" ? apiClient.get("/admin/companies") : Promise.resolve({ data: [] })
        ]);
        setUsers(usersRes?.data || []);
        setTeams(teamsRes?.data || []);
        setCompanies(companiesRes?.data || []);
        
        if (meRes?.data?.name) {
           setCompanyDomain(meRes.data.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com');
        } else {
           const derived = currentUser?.email?.split("@")[1];
           if (derived && !["gmail.com", "yahoo.com", "hotmail.com"].includes(derived.toLowerCase())) {
             setCompanyDomain(derived);
           }
        }
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to load data"));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const email = name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + formData.role + '@' + companyDomain;
    setFormData(prev => ({ ...prev, name, email }));
  };

  const handleCompanyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    const selectedCompany = companies.find(c => c.id === cid);
    let newDomain = "company.com";
    
    if (selectedCompany?.domain) {
      newDomain = selectedCompany.domain;
    } else if (selectedCompany?.name) {
      newDomain = selectedCompany.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
    }
    
    setCompanyDomain(newDomain);
    
    const email = formData.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + formData.role + '@' + newDomain;
    setFormData(prev => ({ ...prev, companyId: cid, email, teamId: "" }));
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Intercept early submissions (e.g., pressing Enter) on Step 1 for Managers
    if (formData.role === "manager" && addStep === 1) {
      setAddStep(2);
      return;
    }

    setFormLoading(true);
    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role };
      if (formData.password) payload.password = formData.password;
      if (formData.role === "karyawan" && formData.teamId) payload.teamId = formData.teamId;
      if (formData.companyId) payload.companyId = formData.companyId;
      
      const endpointPrefix = currentUser?.role === "super_admin" ? "/admin" : "/company";
      const userRes = await apiClient.post(`${endpointPrefix}/users`, payload);
      const generatedPassword = userRes.generatedPassword || formData.password;
      const newUserId = userRes.data?.id;

      if (formData.role === "manager" && newUserId && managerAction !== "none") {
        if (managerAction === "assign" && managerTeamId) {
          await apiClient.post(`/company/teams/${managerTeamId}/leaders`, { userId: newUserId });
        } else if (managerAction === "create" && managerNewTeamName) {
          const teamRes = await apiClient.post("/company/teams", { name: managerNewTeamName, description: "Auto-created during manager setup" });
          const newTeamId = teamRes.data?.id || teamRes.data?.data?.id;
          if (newTeamId) {
            await apiClient.post(`/company/teams/${newTeamId}/leaders`, { userId: newUserId });
            for (const memberId of managerSelectedMembers) {
              await apiClient.patch("/company/org-tree/assign", { userId: memberId, teamId: newTeamId, role: "karyawan" });
            }
            const validReps = managerNewSalesReps.filter(r => r.name.trim() !== "" && r.email.trim() !== "");
            if (validReps.length > 0) {
               const usersPayload = validReps.map(r => r.password ? { name: r.name, email: r.email, password: r.password } : { name: r.name, email: r.email });
               await apiClient.post("/company/users/bulk", { teamId: newTeamId, users: usersPayload });
            }
          }
        }
      }

      toast.success(generatedPassword ? `User created! Password: ${generatedPassword}` : "User added successfully!", { duration: 15000 });
      router.push("/admin/users");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add user"));
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--color-text-muted)] text-sm">Loading setup configuration...</div>;

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin/users")} className="btn btn-secondary btn-icon">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <PageHeader title="Create User" subtitle="Add a new member to your organization" />
      </div>

      <div className="bg-[var(--color-surface)] p-5 rounded-xl border border-[var(--color-border)] shadow-sm max-w-5xl">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          {addStep === 1 ? (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input required type="text" className="input py-2" value={formData.name} onChange={handleNameChange} placeholder="e.g. John Doe" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email <span className="text-[10px] text-[var(--color-text-muted)] font-normal ml-1">(Auto-generated)</span></label>
                  <input required type="email" className="input py-2" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              
              {currentUser?.role === "super_admin" && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Select Company</label>
                  <select required className="input py-2" value={formData.companyId} onChange={handleCompanyChange}>
                    <option value="" disabled>Select a company</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { value: "karyawan", label: "Sales Rep", desc: "Basic access" },
                    { value: "manager", label: "Manager", desc: "Team Leader" },
                    ...(currentUser?.role === "super_admin" ? [{ value: "company_admin", label: "Admin", desc: "Company Admin" }] : [])
                  ].map(roleOption => (
                    <div 
                      key={roleOption.value} 
                      onClick={() => setFormData({...formData, role: roleOption.value})}
                      className={`cursor-pointer p-3 border rounded-lg transition-all ${formData.role === roleOption.value ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]" : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"}`}
                    >
                      <p className="font-bold text-sm text-[var(--color-text)] mb-0.5">{roleOption.label}</p>
                      <p className="text-[10px] text-[var(--color-text-muted)]">{roleOption.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {formData.role === "karyawan" && (
                <div>
                  <label className="block text-xs font-semibold mb-1">Assign Team (Optional)</label>
                  <select className="input py-2" value={formData.teamId} onChange={e => setFormData({...formData, teamId: e.target.value})}>
                    <option value="">No Team Assigned</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold mb-1">Password</label>
                <div className="flex gap-2">
                  <input type="text" minLength={6} className="input py-2 flex-1 font-mono text-sm" placeholder="Auto-generated if blank" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                  <button type="button" onClick={() => { navigator.clipboard.writeText(formData.password); toast.success("Password copied!"); }} className="btn btn-secondary px-3 py-2 font-medium">Copy</button>
                </div>
              </div>
              
              <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex justify-end gap-2">
                <button type="button" onClick={() => router.push("/admin/users")} className="btn btn-secondary px-4 py-2 text-sm">Cancel</button>
                {formData.role === "manager" ? (
                  <button key="btn-next" type="button" onClick={(e) => { 
                    e.preventDefault(); 
                    if (!formData.name || !formData.email) {
                      toast.error("Mohon isi Nama dan Email terlebih dahulu!");
                      return;
                    }
                    setAddStep(2); 
                  }} className="btn btn-primary px-4 py-2 text-sm">Next: Team Setup</button>
                ) : (
                  <button key="btn-submit-user" type="submit" disabled={formLoading} className="btn btn-primary px-4 py-2 text-sm">
                    {formLoading ? "Saving..." : "Create User"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base font-bold">Team Assignment Setup</h3>
                <button type="button" onClick={() => setAddStep(1)} className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">← Back to Profile</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {[
                    { value: "none", label: "No Team" },
                    { value: "assign", label: "Assign to Existing Team" },
                    { value: "create", label: "Create New Team" }
                  ].map(action => (
                    <div 
                      key={action.value} 
                      onClick={() => setManagerAction(action.value as any)}
                      className={`cursor-pointer p-2 text-center border rounded-md transition-all text-xs font-semibold ${managerAction === action.value ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] hover:border-[var(--color-primary)]/50"}`}
                    >
                      {action.label}
                    </div>
                  ))}
              </div>

              {managerAction === "assign" && (
                <div className="mt-4 p-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <label className="block text-xs font-semibold mb-1">Select Existing Team</label>
                  <select required className="input py-2 text-sm" value={managerTeamId} onChange={e => setManagerTeamId(e.target.value)}>
                    <option value="">Select a team...</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              {managerAction === "create" && (
                <div className="mt-4 space-y-4 p-4 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                  <div>
                    <label className="block text-xs font-semibold mb-1">New Team Name</label>
                    <input required type="text" className="input py-2 text-sm" placeholder="e.g. Sales Team B" value={managerNewTeamName} onChange={e => setManagerNewTeamName(e.target.value)} />
                  </div>
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="md:w-1/3">
                      <label className="block text-xs font-semibold mb-1">Add Existing Sales Reps</label>
                      <div className="input h-full min-h-[120px] max-h-[250px] overflow-y-auto p-1.5 space-y-1">
                        {users.filter(u => u.role === "karyawan").map(u => (
                          <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-[var(--color-surface)] rounded cursor-pointer border-b border-[var(--color-border)]/50 last:border-0">
                            <input 
                              type="checkbox" 
                              checked={managerSelectedMembers.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setManagerSelectedMembers([...managerSelectedMembers, u.id]);
                                } else {
                                  setManagerSelectedMembers(managerSelectedMembers.filter(id => id !== u.id));
                                }
                              }}
                              className="w-3.5 h-3.5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                            />
                            <span className="text-sm">{u.name} {u.team?.name ? <span className="text-[10px] text-[var(--color-text-muted)]">({u.team.name})</span> : <span className="text-[10px] text-[var(--color-text-muted)]">(Unassigned)</span>}</span>
                          </label>
                        ))}
                        {users.filter(u => u.role === "karyawan").length === 0 && (
                          <div className="text-center text-[var(--color-text-muted)] text-xs py-4">No available sales reps.</div>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Centang anggota untuk menambahkannya ke tim</p>
                    </div>
                    <div className="md:w-2/3">
                      <label className="block text-xs font-semibold mb-1">Create New Sales Reps</label>
                      <div className="space-y-2">
                        {managerNewSalesReps.map((rep, idx) => (
                          <div key={idx} className="flex gap-2 items-center bg-[var(--color-surface)] p-2 rounded-md border border-[var(--color-border)] shadow-sm transition-all hover:border-[var(--color-primary)]/30">
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <input type="text" className="input py-1.5 text-xs" placeholder="Full Name" value={rep.name} onChange={e => {
                                const newReps = [...managerNewSalesReps];
                                newReps[idx].name = e.target.value;
                                const baseName = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                                if (baseName) newReps[idx].email = `${baseName}_karyawan@${companyDomain}`;
                                setManagerNewSalesReps(newReps);
                              }} />
                              <input type="email" className="input py-1.5 text-xs text-[var(--color-text-muted)]" placeholder="Email" value={rep.email} onChange={e => {
                                const newReps = [...managerNewSalesReps];
                                newReps[idx].email = e.target.value;
                                setManagerNewSalesReps(newReps);
                              }} />
                              <div className="flex gap-1">
                                <input type="text" className="input py-1.5 text-xs font-mono flex-1 min-w-0" placeholder="Auto Pwd" value={rep.password} onChange={e => {
                                  const newReps = [...managerNewSalesReps];
                                  newReps[idx].password = e.target.value;
                                  setManagerNewSalesReps(newReps);
                                }} />
                                <button type="button" onClick={() => {
                                  const newReps = [...managerNewSalesReps];
                                  newReps[idx].password = generatePassword();
                                  setManagerNewSalesReps(newReps);
                                  navigator.clipboard.writeText(newReps[idx].password);
                                  toast.success("Copied!");
                                }} className="btn btn-secondary px-2 py-1.5 text-xs" title="Generate & Copy">🔑</button>
                              </div>
                            </div>
                            <button type="button" onClick={() => {
                              const newReps = [...managerNewSalesReps];
                              newReps.splice(idx, 1);
                              setManagerNewSalesReps(newReps);
                            }} className="text-[var(--color-danger)] p-1.5 hover:bg-red-50 rounded-md transition-colors"><X className="w-4 h-4"/></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => setManagerNewSalesReps([...managerNewSalesReps, {name: "", email: "", password: ""}])} className="w-full btn border border-dashed border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 font-semibold py-2 text-xs">+ Add Another Sales Rep</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="pt-4 mt-4 border-t border-[var(--color-border)] flex justify-end gap-2">
                <button type="button" onClick={() => router.push("/admin/users")} className="btn btn-secondary px-4 py-2 text-sm">Cancel</button>
                <button key="btn-submit-team" type="submit" disabled={formLoading} className="btn btn-primary px-4 py-2 text-sm">
                  {formLoading ? "Saving..." : "Create Manager & Team"}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}