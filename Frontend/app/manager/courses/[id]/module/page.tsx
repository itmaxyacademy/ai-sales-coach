"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../../lib/api/client";
import { 
  ArrowLeft, 
  BookOpen, 
  Pencil, 
  Users, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  Clock, 
  Target, 
  ShieldAlert, 
  Layers, 
  Award,
  AlertCircle,
  X,
  Code2,
  Eye,
  CheckCircle2,
  Briefcase
} from "lucide-react";
import { AutoSkeleton } from "../../../../../components/ui";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

interface RubricCategory {
  name: string;
  weight: number;
  description?: string;
}

interface TeamMember {
  id: string;
  name: string;
}

const difficultyBadge: Record<string, string> = {
  Beginner: "badge-green",
  Intermediate: "badge-yellow",
  Advanced: "badge-red",
};

export default function ManagerCourseModulePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Views
  const [activeTab, setActiveTab] = useState<"module" | "context" | "rubric">("module");
  const [viewMode, setViewMode] = useState<"rendered" | "raw">("rendered");
  const [copied, setCopied] = useState(false);

  // Assign Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    apiClient.get(`/courses/${courseId}`)
      .then(res => setCourse(res.course))
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));

    // Fetch team members for assignment modal
    apiClient.get("/manager/team")
      .then(res => {
        if (res.team && res.team.members) setTeamMembers(res.team.members);
        else if (Array.isArray(res.members)) setTeamMembers(res.members);
      })
      .catch(() => {});
  }, [courseId]);

  const courseModule: string = useMemo(() => {
    return course?.courseModule || course?.documents?.find((d: any) => d.category === "module")?.content || "";
  }, [course]);

  const wordCount = useMemo(() => {
    if (!courseModule) return 0;
    return courseModule.trim().split(/\s+/).filter(Boolean).length;
  }, [courseModule]);

  const readingTime = useMemo(() => {
    return Math.max(1, Math.ceil(wordCount / 200));
  }, [wordCount]);

  const handleCopyMarkdown = () => {
    if (!courseModule) return;
    navigator.clipboard.writeText(courseModule);
    setCopied(true);
    toast.success("Materi modul berhasil disalin ke clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      toast.error("Pilih minimal satu anggota tim.");
      return;
    }

    setAssignLoading(true);
    try {
      await apiClient.post("/assignments", {
        courseId,
        userIds: selectedUsers,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        managerNotes: note || undefined,
      });

      toast.success(`Berhasil menugaskan ke ${selectedUsers.length} anggota tim!`);
      setShowAssignModal(false);
      setSelectedUsers([]);
      setDueDate("");
      setNote("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal menugaskan course."));
    } finally {
      setAssignLoading(false);
    }
  };

  if (error || (!loading && !course)) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="card p-8 text-center">
          <AlertCircle className="w-10 h-10 text-[var(--color-danger)] mx-auto mb-3" />
          <p className="font-semibold text-[var(--color-danger)]">{error || "Course tidak ditemukan."}</p>
          <button onClick={() => router.push("/manager/courses")} className="btn btn-secondary btn-sm mt-4">
            Kembali ke Daftar Course
          </button>
        </div>
      </div>
    );
  }

  const rubric = course?.rubric;
  const categories: RubricCategory[] = (rubric?.categories as any) || [];

  return (
    <AutoSkeleton isLoading={loading} type="card">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-border)] pb-5">
          <div className="flex items-start gap-3">
            <button 
              onClick={() => router.push("/manager/courses")} 
              className="btn btn-secondary btn-sm p-2 flex-shrink-0 mt-1"
              title="Kembali ke Daftar Course"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`badge ${difficultyBadge[course?.difficulty] || "badge-gray"}`}>
                  {course?.difficulty || "Intermediate"}
                </span>
                <span className="badge badge-gray">{course?.category || "Sales"}</span>
                {course?.isActive ? (
                  <span className="badge badge-green">Aktif</span>
                ) : (
                  <span className="badge badge-red">Draft</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-[var(--color-text)] flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-[var(--color-primary)] flex-shrink-0" />
                {course?.title}
              </h1>
              <p className="text-[var(--color-text-muted)] text-sm mt-1">
                Review bahan ajar modul pelatihan dan spesifikasi skenario simulasi roleplay AI.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link 
              href={`/manager/courses/${courseId}/edit`}
              className="btn btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Pencil className="w-4 h-4" /> Edit Course & Modul
            </Link>
            <button 
              onClick={() => setShowAssignModal(true)}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
            >
              <Users className="w-4 h-4" /> Tugaskan ke Tim
            </button>
          </div>
        </div>

        {/* Quick Stat Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">Panjang Materi</p>
              <p className="text-sm font-bold text-[var(--color-text)] truncate">{wordCount.toLocaleString()} kata</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">Estimasi Baca</p>
              <p className="text-sm font-bold text-[var(--color-text)] truncate">~{readingTime} menit</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">Target Customer</p>
              <p className="text-sm font-bold text-[var(--color-text)] truncate">{course?.personaName || "Persona"}</p>
            </div>
          </div>

          <div className="card p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-muted)]">Passing Grade</p>
              <p className="text-sm font-bold text-[var(--color-text)] truncate">{rubric?.passingScore ?? 70}%</p>
            </div>
          </div>
        </div>

        {/* Tab Header Navigation */}
        <div className="flex border-b border-[var(--color-border)] gap-2">
          <button
            onClick={() => setActiveTab("module")}
            className={`pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === "module" 
                ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" 
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Materi Modul Pembelajaran
            {courseModule && (
              <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("context")}
            className={`pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === "context" 
                ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" 
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Konteks Persona & Produk
          </button>
          <button
            onClick={() => setActiveTab("rubric")}
            className={`pb-3 px-4 text-sm font-semibold transition-colors relative flex items-center gap-2 ${
              activeTab === "rubric" 
                ? "text-[var(--color-primary)] border-b-2 border-[var(--color-primary)]" 
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            <Award className="w-4 h-4" />
            Rubrik Penilaian ({categories.length})
          </button>
        </div>

        {/* Tab 1: Module Content Viewer */}
        {activeTab === "module" && (
          <div className="card overflow-hidden shadow-sm">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                <span>Format: Markdown Dokumen Pelatihan</span>
              </div>

              {courseModule && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[var(--color-bg)] rounded-lg p-0.5 border border-[var(--color-border)]">
                    <button
                      onClick={() => setViewMode("rendered")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        viewMode === "rendered"
                          ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" /> Render
                    </button>
                    <button
                      onClick={() => setViewMode("raw")}
                      className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        viewMode === "raw"
                          ? "bg-[var(--color-surface)] text-[var(--color-primary)] shadow-xs"
                          : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      <Code2 className="w-3.5 h-3.5" /> Raw
                    </button>
                  </div>

                  <button
                    onClick={handleCopyMarkdown}
                    className="btn btn-secondary btn-xs flex items-center gap-1.5"
                    title="Salin konten markdown"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Tersalin!" : "Salin Teks"}
                  </button>
                </div>
              )}
            </div>

            {/* Content Body */}
            <div className="p-6 md:p-8 min-h-[480px]">
              {!courseModule ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                    <BookOpen className="w-8 h-8 opacity-60" />
                  </div>
                  <div className="max-w-md">
                    <h3 className="text-base font-bold text-[var(--color-text)]">Belum Ada Materi Modul</h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1">
                      Course ini belum memiliki materi bacaan modul Markdown. Anda dapat menambahkan modul teori, strategi closing, atau panduan objection handling melalui halaman edit.
                    </p>
                  </div>
                  <Link
                    href={`/manager/courses/${courseId}/edit`}
                    className="btn btn-primary btn-sm flex items-center gap-2 mt-2"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Tambahkan Modul Sekarang
                  </Link>
                </div>
              ) : viewMode === "raw" ? (
                <pre className="p-5 bg-[var(--color-bg)] text-[var(--color-text)] font-mono text-sm rounded-xl border border-[var(--color-border)] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {courseModule}
                </pre>
              ) : (
                <div className="w-full">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-4 pb-2 border-b border-[var(--color-border)]" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold text-[var(--color-text)] mt-8 mb-3" {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-semibold text-[var(--color-text)] mt-6 mb-2" {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p className="text-sm md:text-base text-[var(--color-text-secondary)] leading-relaxed mb-4" {...props} />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-5 mb-4 space-y-1 text-sm md:text-base text-[var(--color-text-secondary)]" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm md:text-base text-[var(--color-text-secondary)]" {...props} />
                      ),
                      li: ({ node, ...props }) => <li className="pl-1" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-bold text-[var(--color-text)]" {...props} />,
                      blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-4 py-2.5 my-4 italic text-[var(--color-text-secondary)] rounded-r-lg" {...props} />
                      ),
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-6 border border-[var(--color-border)] rounded-lg">
                          <table className="min-w-full divide-y divide-[var(--color-border)] text-sm" {...props} />
                        </div>
                      ),
                      th: ({ node, ...props }) => (
                        <th className="px-4 py-2.5 bg-[var(--color-surface)] text-left font-semibold text-[var(--color-text)] border-b border-[var(--color-border)]" {...props} />
                      ),
                      td: ({ node, ...props }) => (
                        <td className="px-4 py-2.5 text-[var(--color-text-secondary)] border-b border-[var(--color-border)]" {...props} />
                      ),
                      a: ({ node, ...props }) => (
                        <a className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                      ),
                      code: ({ node, inline, className, ...props }: any) =>
                        inline ? (
                          <code className="bg-[var(--color-surface)] text-[var(--color-accent)] px-1.5 py-0.5 rounded text-xs font-mono border border-[var(--color-border)]" {...props} />
                        ) : (
                          <pre className="bg-[#1e1e1e] text-slate-100 p-4 rounded-xl overflow-x-auto text-xs md:text-sm my-4 font-mono leading-relaxed"><code {...props} /></pre>
                        ),
                    }}
                  >
                    {courseModule}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {/* Bottom Footer Callout */}
            <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Karyawan sales akan mempelajari materi ini sebelum memasuki ruang roleplay AI.</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <Link
                  href={`/manager/courses/${courseId}/edit`}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit Materi
                </Link>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" /> Tugaskan Modul
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Persona & Product Context */}
        {activeTab === "context" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Persona Card */}
            <div className="card p-6 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[var(--color-text)]">Customer Persona</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">Karakter lawan bicara dalam simulasi AI</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Nama & Jabatan</span>
                  <p className="font-bold text-[var(--color-text)]">{course?.personaName} ({course?.personaRole})</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Latar Belakang</span>
                  <p className="text-[var(--color-text-secondary)]">{course?.personaBackground}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Pain Points</span>
                  <p className="text-[var(--color-text-secondary)]">{course?.personaPainPoints}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Keberatan (Objections)</span>
                  <p className="text-rose-600 dark:text-rose-400 font-medium">{course?.personaObjections}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Buying Signals</span>
                  <p className="text-emerald-600 dark:text-emerald-400 font-medium">{course?.personaBuyingSignals}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Gaya Komunikasi & Karakter</span>
                  <p className="text-[var(--color-text-secondary)]">{course?.personaPersonality}</p>
                </div>
              </div>
            </div>

            {/* Product & Scenario Card */}
            <div className="space-y-5">
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[var(--color-text)]">Product Knowledge</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Produk/solusi yang ditawarkan sales</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Nama Produk</span>
                    <p className="font-bold text-[var(--color-text)]">{course?.productName}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Deskripsi Produk</span>
                    <p className="text-[var(--color-text-secondary)]">{course?.productDescription}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Keunggulan Kompetitif (USP)</span>
                    <p className="text-[var(--color-text-secondary)]">{course?.productStrengths}</p>
                  </div>
                  {course?.competitorNotes && (
                    <div>
                      <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Catatan Kompetitor</span>
                      <p className="text-[var(--color-text-secondary)]">{course?.competitorNotes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Scenario & Ideal Outcome */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-[var(--color-text)]">Skenario & Target Outcome</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">Sasaran percakapan roleplay</p>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Konteks Percakapan</span>
                    <p className="text-[var(--color-text-secondary)]">{course?.scenarioContext}</p>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Hasil Ideal (Target Closing)</span>
                    <p className="text-emerald-600 dark:text-emerald-400 font-semibold">{course?.idealOutcome}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Evaluation Rubric */}
        {activeTab === "rubric" && (
          <div className="card p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
              <div>
                <h3 className="font-bold text-lg text-[var(--color-text)]">Rubrik Evaluasi AI</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Kriteria penilaian otomatis yang digunakan AI Coach setelah sesi roleplay selesai.</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-[var(--color-text-muted)] block">Standar Kelulusan</span>
                <span className="text-xl font-extrabold text-[var(--color-primary)]">{rubric?.passingScore ?? 70}%</span>
              </div>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">Belum ada rubrik terkonfigurasi untuk course ini.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map((cat, idx) => (
                  <div key={idx} className="border border-[var(--color-border)] rounded-xl p-4 bg-[var(--color-bg)] flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-sm text-[var(--color-text)]">{cat.name}</span>
                        <span className="badge badge-primary font-mono text-xs">{cat.weight}%</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{cat.description || "Tidak ada rincian deskripsi."}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--color-surface)] rounded-xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <div>
                  <h2 className="font-bold text-lg">Tugaskan Course ke Tim</h2>
                  <p className="text-xs text-[var(--color-text-muted)]">{course?.title}</p>
                </div>
                <button onClick={() => setShowAssignModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-2">Pilih Anggota Tim</label>
                  <div className="border border-[var(--color-border)] rounded-lg p-2 max-h-48 overflow-y-auto bg-[var(--color-bg)] space-y-1">
                    {teamMembers.length === 0 ? (
                      <p className="text-xs text-center text-[var(--color-text-muted)] py-4">Belum ada anggota tim ditemukan.</p>
                    ) : teamMembers.map(m => (
                      <label key={m.id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--color-surface)] cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={selectedUsers.includes(m.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedUsers([...selectedUsers, m.id]);
                            else setSelectedUsers(selectedUsers.filter(id => id !== m.id));
                          }}
                        />
                        <span className="text-sm text-[var(--color-text)]">{m.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Tenggat Waktu / Due Date (Opsional)</label>
                  <input 
                    type="datetime-local" 
                    className="input" 
                    value={dueDate} 
                    onChange={e => setDueDate(e.target.value)} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Catatan Manager (Opsional)</label>
                  <textarea 
                    rows={3} 
                    className="input resize-none" 
                    placeholder="Contoh: Tolong pelajari materi modul bagian objection handling sebelum latihan..." 
                    value={note} 
                    onChange={e => setNote(e.target.value)} 
                  />
                </div>
              </form>

              <div className="p-4 border-t border-[var(--color-border)] flex justify-end gap-2 bg-[var(--color-surface)]">
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn btn-secondary">
                  Batal
                </button>
                <button 
                  type="submit" 
                  disabled={assignLoading || selectedUsers.length === 0} 
                  onClick={handleAssignSubmit} 
                  className="btn btn-primary"
                >
                  {assignLoading ? "Menugaskan..." : `Tugaskan ke ${selectedUsers.length} sales`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AutoSkeleton>
  );
}