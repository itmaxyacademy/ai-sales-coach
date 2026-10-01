"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Bell, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "../../../components/ui";

export default function AdminNotificationsPage() {
  const [targetRole, setTargetRole] = useState<"all" | "karyawan" | "manager">("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      const payload = {
        title,
        message,
        ...(targetRole !== "all" ? { targetRole } : {})
      };
      const res = await apiClient.post("/admin/notifications/broadcast", payload);
      setSuccess(true);
      setTitle("");
      setMessage("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to broadcast notification."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Broadcast Notifications"
        subtitle="Send system-wide alerts and announcements to specific roles."
        // icon={<Bell className="w-5 h-5 text-[var(--color-danger)]" />}
      />

      <div className="card p-5 space-y-4">
        {success && (
          <div className="p-3 rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)] flex items-center gap-2 text-[var(--color-success)] text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Broadcast notification dispatched successfully!
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-[var(--color-danger-light)] border border-[var(--color-danger)] text-[var(--color-danger)] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Target Audience</label>
              <select 
                className="input select-input text-xs" 
                value={targetRole} 
                onChange={e => setTargetRole(e.target.value as any)}
              >
                <option value="all">All Active Users (Karyawan & Team Leader)</option>
                <option value="karyawan">Karyawan (Sales Reps only)</option>
                <option value="manager">Team Leader (Sales Managers only)</option>
              </select>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                {targetRole === "all" && "Broadcast will be received by all registered personnel."}
                {targetRole === "karyawan" && "Only employee-level accounts will receive this notification."}
                {targetRole === "manager" && "Only team leader accounts will receive this notification."}
              </p>
            </div>
            
            <div>
              <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Alert Title</label>
              <input
                type="text"
                required
                className="input text-xs"
                placeholder="e.g. Scheduled System Upgrades"
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--color-text)] mb-1">Notification Body</label>
            <textarea
              required
              rows={5}
              className="input resize-none text-xs p-3"
              placeholder="Type the message details here (minimum 10 characters)..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <div className="pt-3 border-t border-[var(--color-border)] flex justify-end">
            <button 
              type="submit" 
              disabled={loading || title.length < 3 || message.length < 10} 
              className="btn btn-primary px-6 bg-[var(--color-danger)] hover:bg-red-700 flex items-center gap-1.5 cursor-pointer text-xs"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Dispatch Broadcast
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}