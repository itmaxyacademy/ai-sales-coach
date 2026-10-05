"use client";
import { getErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { BookOpen, Plus, Pencil, Users, AlertCircle, TrendingUp, X, Eye, UserX } from "lucide-react";
import Link from "next/link";
import { SearchInput, PageHeader, EmptyState, AutoSkeleton } from "../../../components/ui";

interface Course {
  id: string; title: string; description: string; difficulty: string; category: string;
  isActive: boolean;
  _count?: { sessions: number; assignments: number };
}

interface UserItem {
  id: string; name: string;
}

const difficultyColor: Record<string, string> = {
  Beginner: "badge-green", Intermediate: "badge-yellow", Advanced: "badge-red"
};

export default function ManagerCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Assign Modal States
  const [showAssignModal, setShowAssignModal] = useState<Course | null>(null);
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<UserItem[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberPage, setMemberPage] = useState(1);
  const [memberTotalPages, setMemberTotalPages] = useState(1);
  const [memberLoading, setMemberLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!showAssignModal) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setMemberLoading(true);
      setTeamMembers([]);
      apiClient.get(`/manager/team?scope=team&page=${memberPage}&search=${encodeURIComponent(memberSearch)}`)
        .then(res => {
          if (cancelled) return;
          setTeamMembers(res?.data || []);
          setMemberTotalPages(res?.meta?.totalPages || 1);
        })
        .catch(err => { if (!cancelled) toast.error(getErrorMessage(err, "Gagal memuat anggota tim")); })
        .finally(() => { if (!cancelled) setMemberLoading(false); });
    }, memberSearch ? 200 : 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [showAssignModal?.id, memberSearch, memberPage]);

  const fetchExistingAssignments = (courseId: string) => {
    apiClient.get(`/assignments?courseId=${courseId}`)
      .then(res => {
        const list = res?.assignments || res?.data?.assignments || res?.data || [];
        if (Array.isArray(list)) setExistingAssignments(list);
      })
      .catch(() => setExistingAssignments([]));
  };

  const handleOpenAssignModal = (course: Course) => {
    setShowAssignModal(course);
    setSelectedUsers([]);
    setMemberSearch("");
    setMemberPage(1);
    setDueDate("");
    setNote("");
    fetchExistingAssignments(course.id);
  };

  const handleUnassign = async (assignmentId: string) => {
    setUnassigningId(assignmentId);
    try {
      await apiClient.delete(`/assignments/${assignmentId}`);
      toast.success("Assignment removed (unassigned) successfully!");
      if (showAssignModal) fetchExistingAssignments(showAssignModal.id);
      fetchCourses();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove assignment"));
    } finally {
      setUnassigningId(null);
    }
  };

  const fetchCourses = () => {
    setLoading(true);
    apiClient.get("/courses")
      .then(res => { 
        const coursesList = res?.courses || res?.data?.courses || [];
        if (Array.isArray(coursesList)) {
          setCourses(coursesList);
        } else {
          setError("Invalid course data format");
        }
      })
      .catch(err => setError(getErrorMessage(err, "Failed to load courses")))
      .finally(() => setLoading(false));
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAssignModal || selectedUsers.length === 0) return;
    setAssignLoading(true);
    try {
      await apiClient.post("/assignments/bulk", {
        courseId: showAssignModal.id,
        userIds: selectedUsers,
        dueAt: dueDate ? new Date(dueDate).toISOString() : null,
        note
      });
      toast.success("Modul berhasil ditugaskan ke karyawan!");
      setSelectedUsers([]);
      setDueDate("");
      setNote("");
      fetchExistingAssignments(showAssignModal.id);
      fetchCourses();
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal menugaskan modul"));
    } finally {
      setAssignLoading(false);
    }
  };

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Course Management"
        subtitle="Kelola skenario pelatihan dan tugaskan modul ke tim sales Anda."
        actions={
          <Link href="/manager/courses/create" className="btn btn-primary btn-sm flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create Course
          </Link>
        }
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Cari course..."
        className="max-w-xs"
      />

      <AutoSkeleton isLoading={loading} type="card">
      {error ? (
        <div className="card p-4 border-[var(--color-warning)] bg-[var(--color-warning-light)] text-[var(--color-warning)] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Gagal memuat course: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-[var(--color-text-muted)]">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Tidak ada course ditemukan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(course => (
            <div key={course.id} className={`card card-hover flex flex-col ${!course.isActive ? "opacity-60 grayscale" : ""}`}>
              <div className="p-5 flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`badge ${difficultyColor[course.difficulty] || "badge-gray"}`}>{course.difficulty}</span>
                  <span className="badge badge-gray">{course.category}</span>
                  {!course.isActive && <span className="badge badge-red ml-auto">Draft</span>}
                </div>
                <Link href={`/manager/courses/${course.id}`} className="hover:text-[var(--color-primary)] transition-colors block">
                  <h3 className="font-semibold text-[var(--color-text)] mb-1 leading-tight hover:text-[var(--color-primary)]">{course.title}</h3>
                </Link>
                <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{course.description}</p>
                
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {course._count?.sessions || 0} plays
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {course._count?.assignments || 0} assigned
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-4 border-t border-[var(--color-border)] divide-x divide-[var(--color-border)] bg-[var(--color-surface)] rounded-b-xl overflow-hidden text-center">
                <Link 
                  href={`/manager/courses/${course.id}`} 
                  className="py-2.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] flex items-center justify-center gap-1 transition-colors"
                  title="Lihat detail spesifikasi course & coba simulasi"
                >
                  <Eye className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> View
                </Link>
                <Link 
                  href={`/manager/courses/${course.id}/module`} 
                  className="py-2.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] flex items-center justify-center gap-1 transition-colors"
                  title="Review materi modul pembelajaran"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Modul
                </Link>
                <Link 
                  href={`/manager/courses/${course.id}/edit`} 
                  className="py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] flex items-center justify-center gap-1 transition-colors"
                  title="Edit konfigurasi course"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Link>
                <button
                  onClick={() => handleOpenAssignModal(course)}
                  className="py-2.5 text-xs font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-light)] flex items-center justify-center gap-1.5 transition-colors"
                  title="Tugaskan course ke tim sales"
                >
                  <Users className="w-3.5 h-3.5" /> Assign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      </AutoSkeleton>

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface)] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <div>
                <h2 className="font-bold text-lg">Penugasan Modul (Assign Course)</h2>
                <p className="text-xs text-[var(--color-text-muted)]">{showAssignModal.title}</p>
              </div>
              <button onClick={() => setShowAssignModal(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAssignSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2">Pilih Anggota Tim Sales</label>
                <SearchInput value={memberSearch} onChange={value => { setMemberSearch(value); setMemberPage(1); }} placeholder="Cari nama anggota..." className="mb-2" />
                <div className="border border-[var(--color-border)] rounded-lg p-2 max-h-56 overflow-y-auto bg-[var(--color-bg)] space-y-1.5">
                  {memberLoading ? (
                    <p className="text-xs text-center text-[var(--color-text-muted)] py-4">Memuat anggota...</p>
                  ) : teamMembers.length === 0 ? (
                    <p className="text-xs text-center text-[var(--color-text-muted)] py-4">Tidak ada anggota tim ditemukan.</p>
                  ) : teamMembers.map(m => {
                    const existingAss = existingAssignments.find((a: any) => 
                      a.userId === m.id || a.user?.id === m.id || a.assignedTo?.id === m.id
                    );
                    const isAlreadyAssigned = Boolean(existingAss);

                    return (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)]">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 pr-2">
                          <input 
                            type="checkbox" 
                            disabled={isAlreadyAssigned}
                            checked={isAlreadyAssigned || selectedUsers.includes(m.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedUsers([...selectedUsers, m.id]);
                              else setSelectedUsers(selectedUsers.filter(id => id !== m.id));
                            }}
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-[var(--color-text)] truncate">{m.name}</span>
                            {isAlreadyAssigned && (
                              <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                                ✓ Sudah Ditugaskan
                              </span>
                            )}
                          </div>
                        </label>

                        {isAlreadyAssigned && (
                          <button
                            type="button"
                            disabled={unassigningId === existingAss.id}
                            onClick={() => handleUnassign(existingAss.id)}
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/30 rounded-md font-semibold text-xs flex items-center gap-1 shrink-0 transition-colors disabled:opacity-50"
                          >
                            {unassigningId === existingAss.id ? (
                              <span className="animate-pulse">Menghapus...</span>
                            ) : (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Batalkan (Unassign)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-[var(--color-text-muted)]">
                  <span>Halaman {memberPage} dari {memberTotalPages}</span>
                  <div className="flex gap-2"><button type="button" className="btn btn-secondary btn-xs" disabled={memberPage <= 1 || memberLoading} onClick={() => setMemberPage(page => page - 1)}>Sebelumnya</button><button type="button" className="btn btn-secondary btn-xs" disabled={memberPage >= memberTotalPages || memberLoading} onClick={() => setMemberPage(page => page + 1)}>Berikutnya</button></div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Tenggat Waktu (Optional)</label>
                <input type="datetime-local" className="input" value={dueDate} onClick={e => { try { e.currentTarget.showPicker(); } catch {} }} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Catatan Manager (Optional)</label>
                <textarea rows={3} className="input resize-none" placeholder="Berikan arahan atau konteks penugasan ini..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
            </form>
            <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface)]">
              <button type="button" onClick={() => setShowAssignModal(null)} className="btn btn-secondary">Tutup</button>
              <button type="submit" disabled={assignLoading || selectedUsers.length === 0} onClick={handleAssignSubmit} className="btn btn-primary">
                {assignLoading ? "Tugaskan..." : `Tugaskan ke ${selectedUsers.length} sales`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
