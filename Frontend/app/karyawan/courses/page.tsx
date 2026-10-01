"use client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { BookOpen, PlayCircle, ListFilter } from "lucide-react";
import Link from "next/link";
import { SearchInput, PageHeader, EmptyState, AutoSkeleton } from "../../../components/ui";

interface Course {
  id: string; title: string; description: string;
  difficulty: string; category: string;
  personaName: string; productName: string;
  rubric?: { passingScore: number };
  _count?: { sessions: number };
}

const difficultyColor: Record<string, string> = {
  Beginner: "badge-green", Intermediate: "badge-yellow", Advanced: "badge-red"
};

export default function KaryawanCoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [diffFilter, setDiffFilter] = useState("all");

  useEffect(() => {
    apiClient.get("/courses")
      .then(res => { if (res?.courses) setCourses(res.courses); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter(c => {
    const matchSearch = c.title.toLowerCase().includes(search.toLowerCase()) || c.category.toLowerCase().includes(search.toLowerCase());
    const matchDiff = diffFilter === "all" || c.difficulty === diffFilter;
    return matchSearch && matchDiff;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Training Courses"
        subtitle="Browse and start roleplay scenarios to sharpen your sales skills."
        // icon={<BookOpen className="w-4 h-4" />}
      />

      <div className="flex gap-3 flex-wrap items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search course or category..."
          className="flex-1 min-w-48 max-w-xs"
        />
        <div className="flex items-center gap-1.5">
          <ListFilter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          {["all", "Beginner", "Intermediate", "Advanced"].map((d) => (
            <button
              key={d}
              onClick={() => setDiffFilter(d)}
              className={`btn btn-xs capitalize ${diffFilter === d ? "btn-primary" : "btn-secondary"}`}
            >
              {d === "all" ? "All" : d}
            </button>
          ))}
        </div>
      </div>

      <AutoSkeleton isLoading={loading} type="card">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-10 h-10" />}
            title="No courses found"
            description="Try a different search term or filter."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(course => (
              <div key={course.id} className="card card-hover flex flex-col">
                <div className="p-5 flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${difficultyColor[course.difficulty] || "badge-gray"}`}>{course.difficulty}</span>
                    <span className="badge badge-gray">{course.category}</span>
                  </div>
                  <h3 className="font-bold text-[var(--color-text)] leading-tight">{course.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">{course.description}</p>
                  <div className="text-xs text-[var(--color-text-muted)] pt-2 border-t border-[var(--color-border)] flex justify-between">
                    <span>Persona: <span className="font-medium text-[var(--color-text)]">{course.personaName}</span></span>
                    <span>{course._count?.sessions ?? 0} plays</span>
                  </div>
                </div>
                <div className="px-5 pb-4 flex gap-2">
                  <Link
                    href={`/karyawan/courses/${course.id}/module`}
                    className="btn bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] w-full flex items-center gap-2 justify-center"
                  >
                    <BookOpen className="w-4 h-4" /> Module
                  </Link>
                  <Link
                    href={`/karyawan/courses/${course.id}`}
                    className="btn btn-primary w-full flex items-center gap-2 justify-center"
                  >
                    <PlayCircle className="w-4 h-4" /> Start
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </AutoSkeleton>
    </div>
  );
}

