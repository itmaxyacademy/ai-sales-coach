"use client";

import { useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "../../../lib/api/client";
import { PageHeader } from "../../../components/ui";
import { Clock3, LogIn, LogOut, AlertCircle } from "lucide-react";

type Attendance = { checkInAt: string; checkOutAt: string | null };
const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "—";

export default function AttendancePage() {
  const [date, setDate] = useState("");
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => apiClient.get("/attendance/today").then(res => {
    setDate(res.data.date);
    setAttendance(res.data.attendance);
  }).catch(err => setError(getErrorMessage(err, "Gagal memuat absensi."))).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const submit = async (action: "check-in" | "check-out") => {
    setSaving(true); setError("");
    try { await apiClient.post(`/attendance/${action}`, {}); await load(); }
    catch (err) { setError(getErrorMessage(err, "Absensi gagal disimpan.")); }
    finally { setSaving(false); }
  };

  return <div className="p-4 max-w-3xl mx-auto space-y-4">
    <PageHeader title="Absensi" subtitle="Catat waktu mulai dan selesai kerja hari ini." />
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]"><Clock3 className="w-4 h-4" />{date ? new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full" }) : "Memuat tanggal…"} (WIB)</div>
      {error && <p role="alert" className="text-sm text-[var(--color-danger)] flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-[var(--color-bg)] p-4"><p className="text-xs text-[var(--color-text-muted)]">Check-in</p><p className="text-xl font-semibold mt-1">{loading ? "…" : time(attendance?.checkInAt)}</p></div>
        <div className="rounded-lg bg-[var(--color-bg)] p-4"><p className="text-xs text-[var(--color-text-muted)]">Check-out</p><p className="text-xl font-semibold mt-1">{loading ? "…" : time(attendance?.checkOutAt)}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary flex items-center gap-2" disabled={loading || saving || Boolean(attendance)} onClick={() => void submit("check-in")}><LogIn className="w-4 h-4" />Check-in</button>
        <button className="btn btn-secondary flex items-center gap-2" disabled={loading || saving || !attendance || Boolean(attendance.checkOutAt)} onClick={() => void submit("check-out")}><LogOut className="w-4 h-4" />Check-out</button>
      </div>
    </div>
  </div>;
}
