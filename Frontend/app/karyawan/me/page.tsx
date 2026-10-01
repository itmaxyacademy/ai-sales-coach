"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState, useEffect } from "react";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore } from "../../../store/authStore";
import { User, Save, Lock, CheckCircle2, AlertCircle } from "lucide-react";

export default function KaryawanMePage() {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.name || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{type: "success"|"error", text: string} | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      await apiClient.patch("/me", { name });
      setMsg({ type: "success", text: "Profile updated successfully." });
    } catch (err) {
      setMsg({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") });
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { setMsg({ type: "error", text: "New password must be at least 6 characters." }); return; }
    setLoading(true); setMsg(null);
    try {
      await apiClient.patch("/me/password", { oldPassword, newPassword });
      setMsg({ type: "success", text: "Password changed successfully." });
      setOldPassword(""); setNewPassword("");
    } catch (err) {
      setMsg({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") });
    } finally { setLoading(false); }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-0.5">Manage your account information.</p>
      </div>

      {msg && (
        <div className={`p-4 rounded-lg text-sm flex items-center gap-2 ${
          msg.type === "success" ? "bg-[var(--color-success-light)] text-[var(--color-success)]" : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
        }`}>
          {msg.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {msg.text}
        </div>
      )}

      {/* Avatar / Info */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white text-2xl font-bold">
          {user?.name?.charAt(0)?.toUpperCase()}
        </div>
        <div>
          <p className="font-bold text-lg">{user?.name}</p>
          <p className="text-sm text-[var(--color-text-muted)]">{user?.email}</p>
          <span className="badge badge-blue capitalize mt-1">{user?.role}</span>
        </div>
      </div>

      {/* Edit Profile */}
      <div className="card p-5">
        <h2 className="font-semibold flex items-center gap-2 mb-4"><User className="w-4 h-4 text-[var(--color-accent)]" /> Edit Profile</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Full Name</label>
            <input type="text" required className="input" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Email</label>
            <input type="email" disabled className="input bg-[var(--color-bg)] cursor-not-allowed" value={user?.email} />
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1">Email cannot be changed.</p>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn btn-primary flex items-center gap-2">
              <Save className="w-4 h-4" /> {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>

      {/* Change Password */}
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