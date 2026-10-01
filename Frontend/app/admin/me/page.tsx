"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore } from "../../../store/authStore";
import { Save, CheckCircle2, Lock, User, ArrowLeft } from "lucide-react";

export default function AdminMePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [name, setName] = useState(user?.name || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type:"success"|"error", text:string}|null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      await apiClient.patch("/me", { name });
      setMsg({ type: "success", text: "Profile updated." });
    } catch (err) {
      setMsg({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") });
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMsg({ type: "error", text: "Password min 6 chars." }); return; }
    setLoading(true); setMsg(null);
    try {
      await apiClient.patch("/me/password", { oldPassword, newPassword });
      setMsg({ type: "success", text: "Password changed." });
      setOldPassword(""); setNewPassword("");
    } catch (err) {
      setMsg({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] pb-4">
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-1.5"><ArrowLeft className="w-4 h-4" /></button>
        <div>
          <h1 className="text-xl font-bold">My Profile</h1>
          <p className="text-[var(--color-text-muted)] text-sm">Manage your account settings.</p>
        </div>
      </div>

      {msg && (
        <div className={`p-3 rounded-lg text-sm ${msg.type === "success" ? "bg-[var(--color-success-light)] text-[var(--color-success)]" : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"}`}>
          {msg.text}
        </div>
      )}

      <div className="card p-5 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[var(--color-danger)] flex items-center justify-center text-white text-xl font-bold">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-lg">{user?.name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
          <span className="badge badge-red capitalize mt-1">{user?.role}</span>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4"><User className="w-4 h-4 text-[var(--color-accent)]" /> Edit Profile</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Full Name</label>
            <input type="text" required className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Email</label>
            <input type="email" disabled className="input bg-[var(--color-bg)] cursor-not-allowed opacity-60" value={user?.email} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-[var(--color-warning)]" /> Change Password</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Current Password</label>
            <input type="password" required className="input" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">New Password</label>
            <input type="password" required minLength={6} className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn btn-secondary flex items-center gap-2">
              <Lock className="w-4 h-4" /> {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}