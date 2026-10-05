"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { 
  ArrowLeft, 
  BookOpen, 
  Pencil, 
  Users, 
  PlayCircle, 
  Clock, 
  Star, 
  Target, 
  Brain, 
  ShieldAlert, 
  ShoppingBag, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Award, 
  FileText, 
  ChevronRight,
  X,
  Bot
} from "lucide-react";
import Link from "next/link";
import { AutoSkeleton } from "../../../../components/ui";
import { toast } from "sonner";

interface RubricCategory {
  name: string;
  weight: number;
  description?: string;
}

interface Course {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string;
  isActive: boolean;
  personaName: string;
  personaRole: string;
  personaBackground: string;
  personaPainPoints: string;
  personaObjections: string;
  personaBuyingSignals: string;
  personaPersonality: string;
  productName: string;
  productDescription: string;
  productStrengths: string;
  competitorNotes?: string;
  scenarioContext: string;
  idealOutcome: string;
  maxTurns: number;
  aiModelSize: string;
  aiTemperature: number;
  courseModule?: string;
  createdBy?: { name: string; email: string };
  rubric?: { passingScore: number; categories: RubricCategory[] };
  _count?: { sessions: number; assignments: number };
  documents?: { category: string; content: string }[];
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

function splitInsightItems(value?: string) {
  return (value ?? "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export default function ManagerCourseViewPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    // Fetch team members
    apiClient.get("/manager/team")
      .then(res => {
        if (res.team && res.team.members) setTeamMembers(res.team.members);
        else if (Array.isArray(res.members)) setTeamMembers(res.members);
      })
      .catch(() => {});
  }, [courseId]);

  const courseModule = useMemo(() => {
    return course?.courseModule || course?.documents?.find(d => d.category === "module")?.content || "";
  }, [course]);

  const moduleWordCount = useMemo(() => {
    if (!courseModule) return 0;
    return courseModule.trim().split(/\s+/).filter(Boolean).length;
  }, [courseModule]);

  const moduleReadingTime = useMemo(() => {
    return Math.max(1, Math.ceil(moduleWordCount / 200));
  }, [moduleWordCount]);

  const painPoints = useMemo(() => splitInsightItems(course?.personaPainPoints), [course?.personaPainPoints]);
  const objections = useMemo(() => splitInsightItems(course?.personaObjections), [course?.personaObjections]);
  const buyingSignals = useMemo(() => splitInsightItems(course?.personaBuyingSignals), [course?.personaBuyingSignals]);
  const productStrengths = useMemo(() => splitInsightItems(course?.productStrengths), [course?.productStrengths]);

  // Handle Starting a Test Simulation
  const handleStartSimulation = async () => {
    if (!course) return;
    setStarting(true);
    try {
      const res = await apiClient.post("/sessions/start", {
        courseId: course.id,
      });
      if (res?.session?.id) {
        toast.success("Memulai sesi uji coba simulasi roleplay...");
        router.push(`/karyawan/session/${res.session.id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal memulai sesi simulasi."));
    } finally {
      setStarting(false);
    }
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
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Link href="/manager/dashboard" className="hover:text-[var(--color-primary)] transition-colors">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/manager/courses" className="hover:text-[var(--color-primary)] transition-colors">Courses</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[var(--color-text)] font-medium truncate max-w-xs">{course?.title}</span>
        </div>

        {/* Top Header Card */}
        <div className="card p-6 border-l-4 border-l-[var(--color-primary)]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${difficultyBadge[course?.difficulty || ""] || "badge-gray"}`}>
                  {course?.difficulty}
                </span>
                <span className="badge badge-gray">{course?.category}</span>
                {course?.isActive ? (
                  <span className="badge badge-green">Aktif</span>
                ) : (
                  <span className="badge badge-red">Draft</span>
                )}
                {course?.createdBy?.name && (
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">
                    Dibuat oleh: <span className="font-medium text-[var(--color-text)]">{course.createdBy.name}</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl font-bold text-[var(--color-text)] leading-tight">
                {course?.title}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)] max-w-3xl leading-relaxed">
                {course?.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
              <Link 
                href={`/manager/courses/${courseId}/module`}
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
                title="Review modul materi Markdown"
              >
                <BookOpen className="w-4 h-4 text-[var(--color-primary)]" /> Review Modul
              </Link>

              <Link 
                href={`/manager/courses/${courseId}/edit`}
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
                title="Edit spesifikasi course"
              >
                <Pencil className="w-4 h-4" /> Edit Course
              </Link>

              <button 
                onClick={() => setShowAssignModal(true)}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 border-[var(--color-accent)]/30 text-[var(--color-accent)]"
                title="Tugaskan ke sales"
              >
                <Users className="w-4 h-4" /> Tugaskan Tim
              </button>

              <button 
                onClick={handleStartSimulation}
                disabled={starting}
                className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
                title="Coba simulasi roleplay langsung sebagai tester"
              >
                {starting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <PlayCircle className="w-4 h-4" />
                )}
                {starting ? "Memulai..." : "Coba Simulasi"}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stat Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Batas Percakapan</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{course?.maxTurns} turns</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Passing Score</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{rubric?.passingScore ?? 70}%</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Sesi Selesai</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{course?._count?.sessions ?? 0} sesi</p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)]">Ditugaskan ke Tim</p>
              <p className="text-sm font-bold text-[var(--color-text)]">{course?._count?.assignments ?? 0} sales</p>
            </div>
          </div>
        </div>

        {/* Training Goals Banner */}
        <div className="card p-5 border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Brain className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm text-[var(--color-text)]">Tujuan & Target Pelatihan (Training Focus)</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                AI Coach menjaga alur simulasi roleplay agar sales mencapai target kompetensi berikut:
              </p>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)] block mb-0.5">1. Bangun Rapport</span>
                  Menjalin kedekatan dengan {course?.personaName}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)] block mb-0.5">2. Atasi Keberatan</span>
                  Menangani {objections[0] || "objection pelanggan"}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)] block mb-0.5">3. Value Pitch</span>
                  Presentasikan keunggulan {course?.productName}
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5 text-xs text-[var(--color-text-secondary)]">
                  <span className="font-semibold text-[var(--color-text)] block mb-0.5">4. Target Closing</span>
                  {course?.idealOutcome}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column Grid: Customer Persona & Product Knowledge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Customer Persona Card */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--color-text)]">Customer Persona</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Karakter pelanggan simulasi AI</p>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Profil Pelanggan</span>
                <p className="font-bold text-[var(--color-text)]">{course?.personaName} · <span className="font-normal text-[var(--color-text-secondary)]">{course?.personaRole}</span></p>
              </div>

              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Latar Belakang</span>
                <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{course?.personaBackground}</p>
              </div>

              <div>
                <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Karakter & Gaya Bicara</span>
                <p className="text-xs text-[var(--color-text-secondary)]">{course?.personaPersonality}</p>
              </div>

              {/* Pain Points */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Pain Points (Masalah Utama)
                </div>
                <div className="space-y-1">
                  {painPoints.map((p, idx) => (
                    <p key={idx} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{p}</span>
                    </p>
                  ))}
                </div>
              </div>

              {/* Objections */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Keberatan yang Sering Diajukan (Objections)
                </div>
                <div className="space-y-1">
                  {objections.map((o, idx) => (
                    <p key={idx} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{o}</span>
                    </p>
                  ))}
                </div>
              </div>

              {/* Buying Signals */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sinyal Ketertarikan (Buying Signals)
                </div>
                <div className="space-y-1">
                  {buyingSignals.map((b, idx) => (
                    <p key={idx} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{b}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Product & Scenario Column */}
          <div className="space-y-5">
            {/* Product Knowledge */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-text)]">Product Knowledge</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">Produk / solusi yang ditawarkan</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Nama Produk</span>
                  <p className="font-bold text-[var(--color-text)]">{course?.productName}</p>
                </div>

                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Deskripsi Produk</span>
                  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{course?.productDescription}</p>
                </div>

                {/* Product Strengths */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <span className="text-xs font-semibold text-[var(--color-primary)] uppercase tracking-wider block mb-2">Keunggulan Utama (USP)</span>
                  <div className="space-y-1">
                    {productStrengths.map((s, idx) => (
                      <p key={idx} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5">
                        <span className="text-[var(--color-primary)] font-bold">✓</span>
                        <span>{s}</span>
                      </p>
                    ))}
                  </div>
                </div>

                {course?.competitorNotes && (
                  <div>
                    <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Catatan Kompetitor</span>
                    <p className="text-xs text-[var(--color-text-secondary)]">{course.competitorNotes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scenario & Ideal Outcome */}
            <div className="card p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--color-border)]">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-text)]">Skenario Simulasi & Target Closing</h3>
                  <p className="text-xs text-[var(--color-text-muted)]">Konteks percakapan dan hasil yang diharapkan</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider block mb-0.5">Konteks Percakapan</span>
                  <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">{course?.scenarioContext}</p>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">Target Hasil Ideal</span>
                  <p className="text-xs font-medium text-[var(--color-text)] leading-relaxed">{course?.idealOutcome}</p>
                </div>

                <div className="flex items-center gap-3 pt-2 text-xs text-[var(--color-text-muted)]">
                  <span className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Model: {course?.aiModelSize || "7b"}
                  </span>
                  <span>•</span>
                  <span>Temperature: {course?.aiTemperature ?? 0.3}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Course Module Quick Card */}
        <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--color-surface)] border border-[var(--color-border)]">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[var(--color-text)]">Materi Modul Pembelajaran</h3>
                {courseModule ? (
                  <span className="badge badge-green text-2xs">Tersedia</span>
                ) : (
                  <span className="badge badge-gray text-2xs">Belum Diisi</span>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                {courseModule 
                  ? `Materi modul Markdown sepanjang ${moduleWordCount.toLocaleString()} kata (~${moduleReadingTime} menit baca) disiapkan untuk dipelajari tim sales.`
                  : "Materi bacaan modul belum ditambahkan untuk course ini."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {courseModule ? (
              <Link 
                href={`/manager/courses/${courseId}/module`}
                className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-sm"
              >
                <BookOpen className="w-3.5 h-3.5" /> Buka Review Modul
              </Link>
            ) : (
              <Link 
                href={`/manager/courses/${courseId}/edit`}
                className="btn btn-secondary btn-sm flex items-center gap-1.5"
              >
                <Pencil className="w-3.5 h-3.5" /> Tulis Modul di Edit
              </Link>
            )}
          </div>
        </div>

        {/* AI Scoring Rubric Breakdown */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--color-text)]">Rubrik Penilaian AI ({categories.length} Kategori)</h3>
                <p className="text-xs text-[var(--color-text-muted)]">Kriteria evaluasi otomatis sesi roleplay</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--color-text-muted)]">Standar Lulus</span>
              <span className="font-bold text-base text-[var(--color-primary)] ml-2">{rubric?.passingScore ?? 70}%</span>
            </div>
          </div>

          {categories.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">Belum ada rubrik terkonfigurasi.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {categories.map((c, idx) => (
                <div key={idx} className="border border-[var(--color-border)] rounded-xl p-3.5 bg-[var(--color-bg)]">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-[var(--color-text)]">{c.name}</span>
                    <span className="badge badge-primary font-mono text-2xs">{c.weight}%</span>
                  </div>
                  <p className="text-2xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
                    {c.description || "Kriteria standar AI Coach."}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

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
                    onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                    onChange={e => setDueDate(e.target.value)} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Catatan Manager (Opsional)</label>
                  <textarea 
                    rows={3} 
                    className="input resize-none" 
                    placeholder="Contoh: Tolong pelajari materi modul dan latih simulasi hingga skor di atas 75..." 
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