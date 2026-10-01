"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { BookOpen, Clock, AlertCircle, CheckCircle2, PlayCircle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AutoSkeleton } from "../../../components/ui";

interface Assignment {
  id: string;
  course: { id: string; title: string; category: string; difficulty: string; };
  status: string;
  dueAt: string | null;
  completedAt: string | null;
  note: string | null;
  assignedBy: { name: string; };
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Pending", className: "badge-yellow", icon: Clock },
  in_progress: { label: "In Progress", className: "badge-blue", icon: PlayCircle },
  completed: { label: "Completed", className: "badge-green", icon: CheckCircle2 },
};

const difficultyColor: Record<string, string> = {
  Beginner: "badge-green", Intermediate: "badge-yellow", Advanced: "badge-red"
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  useEffect(() => {
    apiClient.get("/assignments")
      .then(res => { if (res?.assignments) setAssignments(res.assignments); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, []);

  const filtered = assignments.filter(a => {
    if (filter === "pending") return a.status !== "completed";
    if (filter === "completed") return a.status === "completed";
    return true;
  });

  const pendingCount = assignments.filter(a => a.status !== "completed").length;
  const completedCount = assignments.filter(a => a.status === "completed").length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Assignments</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-0.5">Roleplay scenarios assigned to you by your manager.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <div className="stat-value">{assignments.length}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <div className="stat-value text-[var(--color-warning)]">{pendingCount}</div>
        </div>
        <div className="stat-card">
          <span className="stat-label">Completed</span>
          <div className="stat-value text-[var(--color-success)]">{completedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(["all", "pending", "completed"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`btn btn-sm capitalize ${filter === f ? "btn-primary" : "btn-secondary"}`}
          >
            {f}
          </button>
        ))}
      </div>

      <AutoSkeleton isLoading={loading} type="list-card">
        <div className="space-y-3">
          {error ? (
            <div className="card p-8 text-center text-[var(--color-danger)]">
              <p>Failed to load: {error}</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <BookOpen className="w-10 h-10 text-[var(--color-border)] mx-auto mb-3" />
              <p className="font-medium text-[var(--color-text-muted)]">No assignments found</p>
            </div>
          ) : (
            filtered.map((a) => {
              const cfg = statusConfig[a.status] || statusConfig.pending;
              const StatusIcon = cfg.icon;
              const isOverdue = a.dueAt && new Date(a.dueAt) < new Date() && a.status !== "completed";
              return (
                <div key={a.id} className="card card-hover p-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      a.status === "completed" ? "bg-[var(--color-success-light)]" : "bg-[var(--color-accent-light)]"
                    }`}>
                      <StatusIcon className={`w-5 h-5 ${a.status === "completed" ? "text-[var(--color-success)]" : "text-[var(--color-accent)]"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm">{a.course.title}</p>
                        <span className={`badge ${difficultyColor[a.course.difficulty] || "badge-gray"}`}>{a.course.difficulty}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                        <span>{a.course.category}</span>
                        <span>·</span>
                        <span>By {a.assignedBy?.name || "Manager"}</span>
                        {a.dueAt && (
                          <>
                            <span>·</span>
                            <span className={isOverdue ? "text-[var(--color-danger)] font-medium" : ""}>
                              {isOverdue ? "⚠ Overdue · " : "Due: "}
                              {new Date(a.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                            </span>
                          </>
                        )}
                      </div>
                      {a.note && <p className="text-xs text-[var(--color-text-muted)] mt-1">"{a.note}"</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`badge ${cfg.className}`}>{cfg.label}</span>
                      {a.status !== "completed" && (
                        <Link
                          href={`/karyawan/courses/${a.course.id}?assignment=${a.id}`}
                          className="btn btn-primary btn-sm flex items-center gap-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Start
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </AutoSkeleton>
    </div>
  );
}