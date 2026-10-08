"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { AlertCircle, Brain, CheckCircle2, ChevronRight, Clock, ClipboardCheck, LockKeyhole, PlayCircle, ShieldAlert, ShoppingBag, Star, Target, Users, BookOpen } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AutoSkeleton } from "../../../../components/ui";

interface RubricCriterion {
  label: string;
  score: number;
}

interface RubricCategory {
  name: string;
  weight: number;
  criteria?: RubricCriterion[];
}

interface Course {
  id: string; title: string; description: string; difficulty: string; category: string; courseModule?: string | null;
  personaName: string; personaRole: string; personaBackground: string; personaPainPoints: string;
  personaObjections: string; personaBuyingSignals: string; personaPersonality: string;
  productName: string; productDescription: string; productStrengths: string; competitorNotes?: string;
  scenarioContext: string; idealOutcome: string; maxTurns: number; aiModelSize: string;
  createdBy: { name: string; email: string };
  rubric?: { passingScore: number; categories: RubricCategory[] };
  _count?: { sessions: number; assignments: number };
  documents?: { category: string; content: string }[];
}

const difficultyColor: Record<string, string> = {
  Beginner: "badge-green", Intermediate: "badge-yellow", Advanced: "badge-red"
};

function splitInsightItems(value?: string) {
  return (value ?? "")
    .split(/\n|;|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function getLearningTargets(course: Course) {
  const targets = [
    `Build rapport with ${course.personaName}`,
    `Handle ${course.category.toLowerCase()} objections`,
    `Position ${course.productName} with clear value`,
    `Reach outcome: ${course.idealOutcome}`
  ];

  return targets.filter((item) => item.trim().length > 0).slice(0, 4);
}

export default function CourseDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = params?.id as string;
  const assignmentId = searchParams?.get("assignment") || undefined;

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const learningTargets = course ? getLearningTargets(course) : [];
  const painPoints = course ? splitInsightItems(course.personaPainPoints) : [];
  const objections = course ? splitInsightItems(course.personaObjections) : [];
  const buyingSignals = course ? splitInsightItems(course.personaBuyingSignals) : [];
  const productStrengths = course ? splitInsightItems(course.productStrengths) : [];
  const courseModule = course?.courseModule || course?.documents?.find(d => d.category === 'module')?.content;

  useEffect(() => {
    if (!courseId || courseId === "undefined") {
      setError("Invalid course ID. Please go back to dashboard.");
      setLoading(false);
      return;
    }
    apiClient.get(`/courses/${courseId}`)
      .then(res => { if (res?.course) setCourse(res.course); })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [courseId]);

  const handleStart = async () => {
    if (!course || starting) return;
    setStarting(true);
    try {
      const res = await apiClient.post("/sessions/start", {
        courseId: course.id,
        ...(assignmentId ? { assignmentId } : {}),
      });
      if (res?.session?.id) {
        router.push(`/karyawan/session/${res.session.id}`);
      }
    } catch (err) {
      setError(getErrorMessage(err, "Terjadi kesalahan."));
    } finally {
      setStarting(false);
    }
  };

  if (error || (!loading && !course)) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-[var(--color-danger)] mx-auto mb-3" />
        <p className="font-semibold text-[var(--color-danger)]">{error || "Course not found"}</p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm mt-4">Go Back</button>
      </div>
    </div>
  );

  return (
    <AutoSkeleton isLoading={loading} type="course-detail">
      {course && (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-2">
          <Link href="/karyawan/dashboard" className="hover:text-[var(--color-accent)] transition-colors">Dashboard</Link>
          <ChevronRight className="w-3 h-3" />
          <Link href="/karyawan/courses" className="hover:text-[var(--color-accent)] transition-colors">Courses</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-[var(--color-text)]">{course.title}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${difficultyColor[course.difficulty] || "badge-gray"}`}>{course.difficulty}</span>
              <span className="badge badge-gray">{course.category}</span>
              {assignmentId && <span className="badge badge-blue">📋 Assigned</span>}
            </div>
            <h1 className="text-2xl font-bold">{course.title}</h1>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">{course.description}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            {courseModule && (
              <Link
                href={`/karyawan/courses/${courseId}/module`}
                className="btn btn-secondary btn-lg flex items-center justify-center gap-2 flex-shrink-0 border-[var(--color-primary)]/30 text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/20"
              >
                <BookOpen className="w-5 h-5" />
                Study Module
              </Link>
            )}
            <button
              onClick={handleStart}
              disabled={starting}
              className="btn btn-primary btn-lg flex items-center justify-center gap-2 flex-shrink-0"
            >
              {starting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <PlayCircle className="w-5 h-5" />
              )}
              {starting ? "Starting..." : "Start Roleplay"}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="stat-card flex items-center gap-3">
          <Clock className="w-5 h-5 text-[var(--color-text-muted)]" />
          <div>
            <div className="font-semibold">{course.maxTurns} turns</div>
            <div className="text-[var(--color-text-muted)] text-xs">Max conversation</div>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Star className="w-5 h-5 text-[var(--color-warning)]" />
          <div>
            <div className="font-semibold">{course.rubric?.passingScore ?? 70}+</div>
            <div className="text-[var(--color-text-muted)] text-xs">Passing score</div>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Target className="w-5 h-5 text-[var(--color-accent)]" />
          <div>
            <div className="font-semibold">{course._count?.sessions ?? 0} sessions</div>
            <div className="text-[var(--color-text-muted)] text-xs">Completed total</div>
          </div>
        </div>
      </div>

      <div className="card p-5 border-l-4 border-[var(--color-accent)]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[var(--color-accent-light)] flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold">Training goals</h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Focus area yang akan dipakai AI untuk menjaga roleplay tetap sesuai topik.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {learningTargets.map((target) => (
                <div
                  key={target}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-text-secondary)]"
                >
                  {target}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Persona */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-purple-light)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[var(--color-purple)]" />
            </div>
            <div>
              <h2 className="font-semibold">Customer Persona</h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                Role yang akan dimainkan AI selama sesi.
              </p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Name & Role</p>
              <p className="font-medium">{course.personaName} · {course.personaRole}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Background</p>
              <p className="text-[var(--color-text-secondary)]">{course.personaBackground}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Personality</p>
              <p className="text-[var(--color-text-secondary)]">{course.personaPersonality}</p>
            </div>
            <div className="grid gap-3 pt-2">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-danger)]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Pain points
                </div>
                <div className="mt-2 space-y-1.5">
                  {(painPoints.length ? painPoints : [course.personaPainPoints]).map((item) => (
                    <p key={item} className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                      {item}
                    </p>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-warning)]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Objections to expect
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(objections.length ? objections : [course.personaObjections]).map((item) => (
                    <span key={item} className="rounded-full bg-[var(--color-warning-light)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-warning)]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {buyingSignals.length > 0 && (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-success)]">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Buying signals
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {buyingSignals.map((item) => (
                      <p key={item} className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Product & Scenario */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div>
                <h2 className="font-semibold">Product Value</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Bahan value proposition saat roleplay.
                </p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">{course.productName}</p>
              <p className="text-[var(--color-text-secondary)]">{course.productDescription}</p>
              <div>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Strengths</p>
                <div className="flex flex-wrap gap-2">
                  {(productStrengths.length ? productStrengths : [course.productStrengths]).map((item) => (
                    <span key={item} className="rounded-full bg-[var(--color-accent-light)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-accent)]">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              {course.competitorNotes && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">vs. Competitors</p>
                  <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-[var(--color-text-secondary)]">
                    {course.competitorNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-5 border-t-4 border-[var(--color-success)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-success-light)] flex items-center justify-center">
                <ClipboardCheck className="w-4 h-4 text-[var(--color-success)]" />
              </div>
              <div>
                <h2 className="font-semibold">Roleplay Mission</h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Situation boundaries the AI must adhere to.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-1">Scenario</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{course.scenarioContext}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-light)]/30 p-3">
                <p className="text-xs font-semibold text-[var(--color-success)] mb-1">Win condition</p>
                <p className="text-sm font-medium text-[var(--color-text)]">{course.idealOutcome}</p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
                <LockKeyhole className="w-4 h-4 text-[var(--color-text-muted)] mt-0.5" />
                <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                  AI must only respond within the context of the persona, product value, objections, and mission target.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Rubric */}
      {course.rubric?.categories && course.rubric.categories.length > 0 && (
        <div className="card p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-4">
            <div>
              <h2 className="font-semibold">Evaluation Rubric</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-1">
                Skor akhir dihitung dari perilaku sales yang muncul selama sesi.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-right">
              <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">Pass target</p>
              <p className="text-lg font-black text-[var(--color-success)]">{course.rubric.passingScore ?? 70}+</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {course.rubric.categories.map((cat, idx) => {
              const positiveCriteria = (cat.criteria ?? []).filter((item) => item.score > 0);
              const penaltyCriteria = (cat.criteria ?? []).filter((item) => item.score <= 0);

              return (
                <div key={`${cat.name}-${idx}`} className="p-4 bg-[var(--color-bg)] rounded-xl border border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-sm">{cat.name}</p>
                    <span className="badge badge-blue">{cat.weight}% weight</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-success)]">
                        Naik skor jika
                      </p>
                      <div className="space-y-1">
                        {(positiveCriteria.length ? positiveCriteria : [{ label: "Tunjukkan perilaku sales yang relevan", score: 0 }]).map((criterion) => (
                          <div key={`${cat.name}-${criterion.label}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs">
                            <span className="text-[var(--color-text-secondary)]">{criterion.label}</span>
                            <span className="font-semibold text-[var(--color-success)]">
                              {criterion.score > 0 ? "+" : ""}{criterion.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {penaltyCriteria.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-danger)]">
                          Turun skor jika
                        </p>
                        <div className="space-y-1">
                          {penaltyCriteria.map((criterion) => (
                            <div key={`${cat.name}-${criterion.label}`} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--color-surface)] px-3 py-2 text-xs">
                              <span className="text-[var(--color-text-secondary)]">{criterion.label}</span>
                              <span className="font-semibold text-[var(--color-danger)]">{criterion.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </div>
      )}
    </AutoSkeleton>
  );
}