"use client";

import { useEffect, useState } from "react";
import { apiClient, getErrorMessage } from "../../../lib/api/client";
import { PageHeader } from "../../../components/ui";
import { AlertCircle, CheckCircle2, Clock3 } from "lucide-react";

type Member = { id: string; name: string; team: { name: string } | null; attendance: { checkInAt: string; checkOutAt: string | null } | null };
const jakartaToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const time = (value?: string | null) => value ? new Date(value).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }) : "—";

export default function TeamAttendancePage() {
  const [date, setDate] = useState(jakartaToday);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    apiClient.get(`/manager/attendance?date=${date}`)
      .then(res => setMembers(res.data || []))
      .catch(err => setError(getErrorMessage(err, "Gagal memuat rekap absensi.")))
      .finally(() => setLoading(false));
  }, [date]);

  const present = members.filter(member => member.attendance).length;
  return <div className="p-4 max-w-6xl mx-auto space-y-4">
    <PageHeader title="Absensi Tim" subtitle="Pantau check-in dan check-out anggota tim." />
    <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
      <label className="flex items-center gap-2 text-sm font-medium"><Clock3 className="w-4 h-4 text-[var(--color-accent)]" />Tanggal <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} /></label>
      <p className="text-sm text-[var(--color-text-muted)]"><CheckCircle2 className="w-4 h-4 inline mr-1 text-[var(--color-success)]" />Hadir {present} dari {members.length} karyawan</p>
    </div>
    {error && <div role="alert" className="card p-3 text-sm text-[var(--color-danger)] flex gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-muted)]"><th className="p-3">Nama</th><th className="p-3">Tim</th><th className="p-3">Check-in</th><th className="p-3">Check-out</th><th className="p-3">Status</th></tr></thead>
        <tbody>
          {loading ? <tr><td className="p-5 text-center text-[var(--color-text-muted)]" colSpan={5}>Memuat absensi…</td></tr> : members.length === 0 ? <tr><td className="p-5 text-center text-[var(--color-text-muted)]" colSpan={5}>Belum ada karyawan aktif dalam cakupan Anda.</td></tr> : members.map(member => <tr key={member.id} className="border-b border-[var(--color-border)] last:border-0"><td className="p-3 font-medium">{member.name}</td><td className="p-3 text-[var(--color-text-muted)]">{member.team?.name || "—"}</td><td className="p-3">{time(member.attendance?.checkInAt)}</td><td className="p-3">{time(member.attendance?.checkOutAt)}</td><td className="p-3"><span className={`badge ${member.attendance ? "badge-green" : "badge-gray"}`}>{member.attendance ? "Hadir" : "Belum hadir"}</span></td></tr>)}
        </tbody>
      </table>
    </div>
  </div>;
}
