"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { PowerOff, BookOpen, UserCircle, Play } from "lucide-react";
import { SearchInput, PageHeader, EmptyState, AutoSkeleton, ConfirmModal } from "../../../components/ui";
import { toast } from "sonner";

interface AdminCourseItem {
  id: string; title: string; category: string; isActive: boolean;
  createdBy: { name: string };
}

export default function AdminCoursesPage() {
  const [courses, setCourses] = useState<AdminCourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    apiClient.get("/admin/courses")
      .then(res => { if (res?.data) setCourses(res.data); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: string) => {
    try {
      await apiClient.patch(`/admin/courses/${id}/force-deactivate`, {});
      setCourses(c => c.map(x => x.id === id ? { ...x, isActive: false } : x));
      toast.success("Course deactivated successfully");
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to deactivate course"));
    } finally {
      setConfirmModal({ isOpen: false, id: null });
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await apiClient.patch(`/admin/courses/${id}/reactivate`, {});
      setCourses(c => c.map(x => x.id === id ? { ...x, isActive: true } : x));
      toast.success("Course reactivated successfully");
    } catch (e) {
      toast.error(getErrorMessage(e, "Failed to reactivate course"));
    }
  };

  const filtered = courses.filter(c => c.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Course Audit"
        subtitle="System-level view of all training scenarios."
        // icon={<BookOpen className="w-4 h-4" />}
      />

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search course title..."
        className="max-w-xs"
      />

      <div className="card">
        <AutoSkeleton isLoading={loading} type="table">
          {error ? (
            <div className="p-8 text-[var(--color-danger)] text-center">{error}</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="w-9 h-9" />}
              title="No courses found"
              description="No courses match your search."
            />
          ) : (
            <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course Title</th>
                  <th>Category</th>
                  <th>Created By</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td className="font-medium text-[var(--color-text)]">{c.title}</td>
                    <td><span className="badge badge-gray">{c.category}</span></td>
                    <td className="text-sm flex items-center gap-1">
                      <UserCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" /> {c.createdBy.name}
                    </td>
                    <td>
                      {c.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-gray">Deactivated</span>}
                    </td>
                    <td>
                      {c.isActive ? (
                        <button
                          onClick={() => setConfirmModal({ isOpen: true, id: c.id })}
                          className="btn btn-xs flex items-center gap-1 btn-danger"
                          title="Force Deactivate"
                        >
                          <PowerOff className="w-3 h-3" /> Stop
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(c.id)}
                          className="btn btn-xs flex items-center gap-1 btn-success text-white"
                          title="Re-activate Course"
                        >
                          <Play className="w-3 h-3" /> Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </AutoSkeleton>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Force Deactivate Course"
        message="Are you sure you want to deactivate this course? This action cannot be easily undone."
        confirmText="Deactivate"
        onConfirm={() => confirmModal.id && handleToggle(confirmModal.id)}
        onCancel={() => setConfirmModal({ isOpen: false, id: null })}
      />
    </div>
  );
}
