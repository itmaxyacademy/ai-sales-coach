"use client";
import { getErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../../lib/api/client";
import { 
  ArrowLeft, Save, Sparkles, ChevronRight, ChevronLeft, Check, AlertCircle, 
  Wand2, X, Loader2, FileText, UploadCloud, Building2, Package, UserCheck, 
  Shield, HelpCircle, CheckCircle2, Cpu, ArrowRight, Layers, FileCheck2, 
  Edit3, Eye, RefreshCw, BookOpen
} from "lucide-react";
import { AvatarSelector } from "../../../../components/AvatarSelector";

// ── Multi-Step Interactive Ask-Back AI Generate Modal ──────────────────────
type ClarificationItem = {
  id: string;
  category: "competitor" | "pricing" | "objection" | "negotiation" | "technical";
  question: string;
  whyItMatters: string;
  placeholder: string;
  suggestedAnswer: string;
  answer?: string;
};

function AIGenerateModal({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (data: any) => void;
}) {
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // Step 1 State
  const [industry, setIndustry] = useState("B2B Sales");
  const [productName, setProductName] = useState("");
  const [targetPersona, setTargetPersona] = useState("");
  const [brief, setBrief] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [examples, setExamples] = useState<string[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(true);

  // Step 2 State (Clarifications)
  const [briefSummary, setBriefSummary] = useState("");
  const [extractedDocSummary, setExtractedDocSummary] = useState<string | null>(null);
  const [extractedDocText, setExtractedDocText] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarificationItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Step 3 State (Generated Course Preview & Customization)
  const [generatedCourse, setGeneratedCourse] = useState<any>(null);
  const [previewTab, setPreviewTab] = useState<"persona" | "battlecard" | "module">("persona");
  const [moduleEditMode, setModuleEditMode] = useState(false);

  useEffect(() => {
    apiClient.get('/ai/quick-examples')
      .then((res: any) => {
        if (res.examples && Array.isArray(res.examples)) {
          setExamples(res.examples);
        }
      })
      .catch(() => {
        setExamples([
          "Negosiasi waktu inden Excavator dengan Manajer Pengadaan Konstruksi",
          "Jual software CRM ke Direktur Operasional yang skeptis migrasi",
          "Tawarkan paket FMCG ke grosir besar dengan keberatan perputaran lambat",
          "Closing solusi keamanan cloud ke CISO dengan budget terbatas",
        ]);
      })
      .finally(() => {
        setLoadingExamples(false);
      });
  }, []);

  // Step 1 -> Step 2: Request Clarification Questions from AI
  const handleProceedToClarification = async () => {
    if (!brief.trim() || brief.trim().length < 5) {
      toast.error("Deskripsikan skenario minimal 5 karakter.");
      return;
    }

    setLoading(true);
    try {
      let res: any;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("brief", brief.trim());
        if (industry) formData.append("industry", industry);
        if (productName) formData.append("productName", productName);
        if (targetPersona) formData.append("targetPersona", targetPersona);
        formData.append("file", uploadedFile);

        res = await apiClient.post("/ai/course-clarification", formData);
      } else {
        res = await apiClient.post("/ai/course-clarification", {
          brief: brief.trim(),
          industry,
          productName,
          targetPersona,
        });
      }

      setBriefSummary(res.briefSummary || "Analisis brief skenario sales");
      setExtractedDocSummary(res.extractedDocSummary || null);
      setExtractedDocText(res.documentText || null);

      if (res.questions && Array.isArray(res.questions)) {
        setQuestions(res.questions);
        // Pre-fill answers map
        const initialAnswers: Record<string, string> = {};
        res.questions.forEach((q: ClarificationItem) => {
          initialAnswers[q.id] = "";
        });
        setAnswers(initialAnswers);
      }

      setWizardStep(2);
      toast.success("AI telah menelaah brief dan menyiapkan 3-4 pertanyaan klarifikasi.");
    } catch (err) {
      toast.error("Gagal menganalisis brief: " + (getErrorMessage(err, "Terjadi kesalahan")));
    } finally {
      setLoading(false);
    }
  };

  // 1-Click suggested answer filler
  const handleApplySuggestedAnswer = (questionId: string, suggestion: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: suggestion,
    }));
  };

  // Step 2 -> Step 3: Confirm clarifications and generate full course
  const handleConfirmAndGenerate = async () => {
    setLoading(true);
    try {
      const clarificationsPayload = questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: answers[q.id] || q.suggestedAnswer || "",
      }));

      const res = await apiClient.post("/ai/generate-course-confirmed", {
        brief: brief.trim(),
        industry,
        productName,
        targetPersona,
        clarifications: clarificationsPayload,
        documentText: extractedDocText,
      });

      setGeneratedCourse(res.course);
      setWizardStep(3);
      toast.success("Modul training course berhasil di-generate secara personal!");
    } catch (err) {
      toast.error("Gagal generate course: " + (getErrorMessage(err, "Terjadi kesalahan")));
    } finally {
      setLoading(false);
    }
  };

  // Section-by-Section Regenerator
  const handleRegenerateSection = async (sectionKey: string, customInstruction?: string) => {
    if (!generatedCourse) return;
    setRegeneratingSection(sectionKey);
    try {
      const res = await apiClient.post("/ai/regenerate-course-section", {
        sectionKey,
        currentCourse: generatedCourse,
        instruction: customInstruction,
      });

      setGeneratedCourse((prev: any) => ({
        ...prev,
        [sectionKey]: res.regeneratedContent,
      }));
      toast.success(`Bagian ${sectionKey} berhasil di-regenerate.`);
    } catch (err) {
      toast.error("Gagal regenerasi seksi: " + getErrorMessage(err, "Terjadi kesalahan."));
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Final Step 3: Apply to Course Form
  const handleApplyFinal = () => {
    if (!generatedCourse) return;
    onApply({
      ...generatedCourse,
      brochureText: extractedDocText || undefined,
    });
    toast.success("Course & Knowledge Base RAG berhasil diterapkan ke form 5 langkah!");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div className="card w-full max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl border border-[var(--color-border)] animate-fade-in bg-[var(--color-surface)]">
        
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 font-bold shadow-xs">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-[var(--color-text)]">
                  Interactive AI Course Architect
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                  Ask-Back Flow v2.4
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Rancang kurikulum & skenario roleplay presisi berbasis dialog konsultatif dan dokumen produk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-secondary btn-sm p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected Stepper Progress Bar (NO DUPLICATE NUMBERS) */}
        <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-hover)]/40">
          <div className="flex items-center justify-between max-w-xl mx-auto">
            {/* Step 1 Indicator */}
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all shadow-xs ${
                wizardStep > 1 
                  ? "bg-emerald-600 text-white shadow-emerald-500/20" 
                  : wizardStep === 1 
                  ? "bg-indigo-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-500/25" 
                  : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}>
                {wizardStep > 1 ? <Check className="w-4 h-4" /> : "1"}
              </span>
              <div className="text-left">
                <span className={`text-xs font-bold block ${wizardStep === 1 ? "text-indigo-600" : wizardStep > 1 ? "text-emerald-600" : "text-[var(--color-text-muted)]"}`}>
                  Brief & Konteks
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Input & Dokumen</span>
              </div>
            </div>

            {/* Connecting Track 1-2 */}
            <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${wizardStep > 1 ? "bg-emerald-500" : "bg-[var(--color-border)]"}`} />

            {/* Step 2 Indicator */}
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all shadow-xs ${
                wizardStep > 2 
                  ? "bg-emerald-600 text-white shadow-emerald-500/20" 
                  : wizardStep === 2 
                  ? "bg-indigo-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-500/25" 
                  : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}>
                {wizardStep > 2 ? <Check className="w-4 h-4" /> : "2"}
              </span>
              <div className="text-left">
                <span className={`text-xs font-bold block ${wizardStep === 2 ? "text-indigo-600" : wizardStep > 2 ? "text-emerald-600" : "text-[var(--color-text-muted)]"}`}>
                  AI Ask-Back
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Klarifikasi Kritis</span>
              </div>
            </div>

            {/* Connecting Track 2-3 */}
            <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${wizardStep > 2 ? "bg-emerald-500" : "bg-[var(--color-border)]"}`} />

            {/* Step 3 Indicator */}
            <div className="flex items-center gap-2.5">
              <span className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-bold transition-all shadow-xs ${
                wizardStep === 3 
                  ? "bg-indigo-600 text-white shadow-indigo-500/30 ring-2 ring-indigo-500/25" 
                  : "bg-[var(--color-border)] text-[var(--color-text-muted)]"
              }`}>
                3
              </span>
              <div className="text-left">
                <span className={`text-xs font-bold block ${wizardStep === 3 ? "text-indigo-600" : "text-[var(--color-text-muted)]"}`}>
                  Review & Modul
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)] hidden sm:block">Pratinjau & Terapkan</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: BRIEF & PDF BROCHURE UPLOAD
          ════════════════════════════════════════════════════════════════════ */}
          {wizardStep === 1 && (
            <div className="space-y-5 animate-fade-in">
              {/* Structured Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    Kategori Industri
                  </label>
                  <input
                    type="text"
                    className="input text-xs w-full rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. B2B SaaS, Alat Berat"
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    Nama Produk / Solusi
                  </label>
                  <input
                    type="text"
                    className="input text-xs w-full rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. Excavator XT-900"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Target Persona / Jabatan
                  </label>
                  <input
                    type="text"
                    className="input text-xs w-full rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="e.g. Manajer Pengadaan"
                    value={targetPersona}
                    onChange={e => setTargetPersona(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Skenario Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--color-text)]">
                    Deskripsi Skenario & Target Penjualan
                  </label>
                  <span className="text-[10px] text-[var(--color-text-muted)] font-mono">
                    {brief.length}/2000 karakter
                  </span>
                </div>
                <textarea
                  rows={3}
                  className="input resize-none w-full text-xs leading-relaxed rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Contoh: Negosiasi waktu inden produk dengan Manajer Pengadaan Konstruksi, tekankan keandalan dan ketersediaan suku cadang purna jual..."
                  value={brief}
                  maxLength={2000}
                  onChange={e => setBrief(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* Document Extraction & RAG Grounding Hub */}
              <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5 space-y-2 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/15 text-indigo-600 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-[var(--color-text)]">
                          Lampirkan Brosur / Knowledge Base Produk
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/25 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          RAG Grounding Ready
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                        Dokumen (PDF/DOCX/TXT) diekstrak otomatis sebagai <strong className="text-indigo-600 font-semibold">Knowledge Base RAG</strong>. Spesifikasi teknis, garansi, USP, & batasan diskon dijadikan acuan akurat bagi avatar 3D prospek dan materi modul.
                      </p>
                    </div>
                  </div>

                  <div>
                    {uploadedFile ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1.5 shadow-xs">
                          <FileText className="w-3.5 h-3.5" />
                          <span>{uploadedFile.name.length > 18 ? uploadedFile.name.slice(0, 15) + "..." : uploadedFile.name}</span>
                          <span className="text-[10px] opacity-75">({(uploadedFile.size / 1024).toFixed(0)} KB)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setUploadedFile(null)}
                          className="btn btn-secondary btn-sm p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
                          title="Hapus file"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="btn btn-primary btn-sm cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 shadow-xs bg-indigo-600 hover:bg-indigo-700 border-indigo-600 text-white font-medium shrink-0 rounded-lg">
                        <UploadCloud className="w-3.5 h-3.5" />
                        <span>Pilih Brosur / PDF</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.txt"
                          className="hidden"
                          onChange={e => {
                            if (e.target.files && e.target.files[0]) {
                              setUploadedFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {uploadedFile && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>Dokumen terhubung: Ekstraksi teks otomatis akan memandu AI Ask-Back dan diindeks ke pgvector RAG kursus ini.</span>
                  </div>
                )}
              </div>

              {/* Quick Suggestions Chips */}
              {!loadingExamples && examples.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                    IDE SKENARIO CEPAT LAINNYA:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {examples.map((ex, i) => (
                      <button
                        key={i}
                        type="button"
                        disabled={loading}
                        onClick={() => setBrief(ex)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--color-border)] text-left leading-tight text-[var(--color-text-muted)] hover:border-indigo-500/50 hover:text-indigo-300 hover:bg-indigo-500/5 transition-colors"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: AI ASK-BACK CLARIFICATION QUESTIONS
          ════════════════════════════════════════════════════════════════════ */}
          {wizardStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              {/* AI Understanding Context Banner */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] space-y-1.5 shadow-xs">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-[var(--color-text)]">
                      {briefSummary}
                    </p>
                    {extractedDocSummary && (
                      <p className="text-[11px] text-emerald-700 mt-0.5 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3 h-3 inline" /> {extractedDocSummary}
                      </p>
                    )}
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                      AI mendeteksi 3–4 celah konteks penting. Konfirmasi atau gunakan rekomendasi AI agar kurikulum dan simulasi prospek 3D tidak halusinasi.
                    </p>
                  </div>
                </div>
              </div>

              {/* Dynamic Clarification Question Cards */}
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2.5 hover:border-indigo-400 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border border-indigo-500/20">
                          Q{idx + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-[var(--color-text)] leading-snug">
                            {q.question}
                          </p>
                          <div className="mt-1 p-2 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-start gap-1.5">
                            <HelpCircle className="w-3 h-3 text-indigo-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-[var(--color-text-muted)] italic leading-relaxed">
                              {q.whyItMatters}
                            </p>
                          </div>
                        </div>
                      </div>

                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] shrink-0 border border-[var(--color-border)] uppercase tracking-wider">
                        {q.category}
                      </span>
                    </div>

                    {/* Answer Textarea */}
                    <div>
                      <textarea
                        rows={2}
                        className="input resize-none w-full text-xs rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 leading-relaxed"
                        placeholder={q.placeholder || "Ketik jawaban spesifik Anda..."}
                        value={answers[q.id] || ""}
                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                        disabled={loading}
                      />
                    </div>

                    {/* 1-Click Suggestion Pill with Preview */}
                    {q.suggestedAnswer && (
                      <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)] border border-[var(--color-border)]">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)] truncate">
                          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="font-semibold text-[var(--color-text)] shrink-0">Saran AI:</span>
                          <span className="truncate italic text-[var(--color-text-muted)]">"{q.suggestedAnswer}"</span>
                        </div>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleApplySuggestedAnswer(q.id, q.suggestedAnswer)}
                          className="text-[11px] px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all font-semibold flex items-center gap-1.5 shrink-0"
                        >
                          <span>Gunakan Saran Ini</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 3: INTERACTIVE PREVIEW & SECTION-BY-SECTION REGENERATOR
          ════════════════════════════════════════════════════════════════════ */}
          {wizardStep === 3 && generatedCourse && (
            <div className="space-y-4 animate-fade-in">
              {/* Course Top Highlights Card */}
              <div className="p-3.5 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] flex items-start justify-between shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 uppercase">
                      {generatedCourse.category || industry}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20">
                      {generatedCourse.difficulty || "Intermediate"}
                    </span>
                    {extractedDocText && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        RAG Grounded Document
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[var(--color-text)] mt-1.5">
                    {generatedCourse.title}
                  </h3>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2 leading-relaxed">
                    {generatedCourse.description}
                  </p>
                </div>
              </div>

              {/* Segmented Pill Tabs Navigation */}
              <div className="flex p-1 rounded-xl bg-[var(--color-surface-hover)] border border-[var(--color-border)] gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPreviewTab("persona")}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    previewTab === "persona" ? "bg-indigo-600 text-white shadow-xs" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Buyer Persona & Objections</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("battlecard")}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    previewTab === "battlecard" ? "bg-indigo-600 text-white shadow-xs" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Product & Battlecard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab("module")}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
                    previewTab === "module" ? "bg-indigo-600 text-white shadow-xs" : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Panduan Modul (Markdown)</span>
                </button>
              </div>

              {/* Tab 1: Buyer Persona & Objections Preview */}
              {previewTab === "persona" && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                        Profil Buyer Persona
                      </span>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{generatedCourse.personaGender === "F" ? "Wanita" : "Pria"}</span>
                    </div>
                    <p className="text-sm font-bold text-[var(--color-text)]">{generatedCourse.personaName} ({generatedCourse.personaRole})</p>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{generatedCourse.personaBackground}</p>
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--color-surface-hover)] text-[var(--color-text)] border border-[var(--color-border)]">
                        Sifat: {generatedCourse.personaPersonality}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/5 space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700">Keberatan Utama Prospek (Objections)</span>
                      <button
                        type="button"
                        disabled={Boolean(regeneratingSection)}
                        onClick={() => handleRegenerateSection("personaObjections")}
                        className="text-[10px] px-2.5 py-1 rounded-md bg-[var(--color-surface)] hover:bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 transition-all shadow-xs"
                      >
                        {regeneratingSection === "personaObjections" ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-rose-600" />
                        )}
                        <span>Regenerate Objections</span>
                      </button>
                    </div>
                    <p className="text-xs text-[var(--color-text)] whitespace-pre-line leading-relaxed">{generatedCourse.personaObjections}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-[var(--color-text)]">Pain Points Kritis Prospek</span>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{generatedCourse.personaPainPoints}</p>
                  </div>
                </div>
              )}

              {/* Tab 2: Product & Battlecard Preview */}
              {previewTab === "battlecard" && (
                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-[var(--color-text)]">Value Proposition & Deskripsi Produk</span>
                    <p className="text-[var(--color-text-muted)] leading-relaxed">{generatedCourse.productDescription}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-2 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--color-text)]">Keunggulan Produk (Strengths)</span>
                      <button
                        type="button"
                        disabled={Boolean(regeneratingSection)}
                        onClick={() => handleRegenerateSection("productStrengths")}
                        className="text-[10px] px-2.5 py-1 rounded-md bg-[var(--color-surface)] hover:bg-indigo-50 text-indigo-700 border border-[var(--color-border)] flex items-center gap-1 transition-all shadow-xs"
                      >
                        {regeneratingSection === "productStrengths" ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-indigo-600" />
                        )}
                        <span>Regenerate Strengths</span>
                      </button>
                    </div>
                    <p className="text-[var(--color-text-muted)] whitespace-pre-line leading-relaxed">{generatedCourse.productStrengths}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] space-y-1.5 shadow-xs">
                    <span className="text-xs font-bold text-[var(--color-text)]">Catatan Kompetitor & Posisi Pasar</span>
                    <p className="text-[var(--color-text-muted)] leading-relaxed">{generatedCourse.competitorNotes || "-"}</p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 space-y-1 shadow-xs">
                    <span className="text-xs font-bold text-emerald-700">Definisi Sukses Closing (Ideal Outcome)</span>
                    <p className="text-[var(--color-text)] leading-relaxed">{generatedCourse.idealOutcome}</p>
                  </div>
                </div>
              )}

              {/* Tab 3: Course Module Markdown Viewer & Editor */}
              {previewTab === "module" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--color-text)] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                      Materi Pembelajaran Sales Rep (Markdown Guide)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModuleEditMode(!moduleEditMode)}
                        className="text-[11px] px-2.5 py-1 rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] transition-all flex items-center gap-1.5"
                      >
                        {moduleEditMode ? <Eye className="w-3 h-3" /> : <Edit3 className="w-3 h-3" />}
                        <span>{moduleEditMode ? "Tutup Editor" : "Edit Teks"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(regeneratingSection)}
                        onClick={() => handleRegenerateSection("courseModule", "Kembangkan panduan modul agar lebih mendalam dan taktis")}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 hover:bg-indigo-500/20 border border-indigo-500/20 flex items-center gap-1.5 transition-all"
                      >
                        {regeneratingSection === "courseModule" ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        <span>Regenerate Modul</span>
                      </button>
                    </div>
                  </div>

                  {moduleEditMode ? (
                    <textarea
                      rows={12}
                      className="input w-full text-xs font-mono resize-none leading-relaxed rounded-xl border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]"
                      value={generatedCourse.courseModule || ""}
                      onChange={e => setGeneratedCourse({ ...generatedCourse, courseModule: e.target.value })}
                    />
                  ) : (
                    <div className="p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] max-h-72 overflow-y-auto text-xs text-[var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed">
                      {generatedCourse.courseModule || "Tidak ada modul markdown terlampir."}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-surface-hover)]/30 flex items-center justify-between gap-3">
          {wizardStep === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="btn btn-secondary text-xs px-4"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedToClarification}
                disabled={loading || brief.trim().length < 5}
                className="btn btn-primary text-xs px-5 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menganalisis Celah Konteks...</span>
                  </>
                ) : (
                  <>
                    <span>Lanjut ke Klarifikasi AI</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {wizardStep === 2 && (
            <>
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                disabled={loading}
                className="btn btn-secondary text-xs px-4 flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Ubah Brief Awal</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmAndGenerate}
                disabled={loading}
                className="btn btn-primary text-xs px-5 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghasilkan Course Terpersonalisasi...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Generate Modul Lengkap</span>
                  </>
                )}
              </button>
            </>
          )}

          {wizardStep === 3 && (
            <>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="btn btn-secondary text-xs px-4 flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Ubah Klarifikasi</span>
              </button>
              <button
                type="button"
                onClick={handleApplyFinal}
                className="btn btn-primary text-xs px-6 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-600/20"
              >
                <Check className="w-4 h-4" />
                <span>Terapkan ke Form Utama (5 Langkah)</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
// ── End Multi-Step Modal ───────────────────────────────────────────────────

export default function CreateCoursePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showAIModal, setShowAIModal] = useState(false);
  const [submitReady, setSubmitReady] = useState(false);
  const totalSteps = 5;

  useEffect(() => {
    if (currentStep === totalSteps) {
      const timer = setTimeout(() => setSubmitReady(true), 500);
      return () => clearTimeout(timer);
    } else {
      setSubmitReady(false);
    }
  }, [currentStep, totalSteps]);

  const [formData, setFormData] = useState({
    title: "", description: "", difficulty: "Intermediate", category: "B2B Sales",
    personaName: "", personaRole: "", personaGender: "M",
    personaBackground: "", personaPainPoints: "", personaObjections: "",
    personaBuyingSignals: "", personaPersonality: "",
    productName: "", productDescription: "", productStrengths: "", competitorNotes: "",
    scenarioContext: "", idealOutcome: "", courseModule: "",
    brochureText: "",
    aiModelSize: "7b", aiTemperature: 0.3, maxTurns: 20
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Apply hasil AI ke form
  const handleAIApply = (data: any) => {
    setFormData(prev => ({ ...prev, ...data }));
    setCurrentStep(1); // reset ke step 1 supaya user review dari awal
    setValidationErrors([]);
  };

  const validateStep = (step: number): boolean => {
    const errors: string[] = [];
    if (step === 1) {
      if (!formData.title.trim()) errors.push("Course Title is required");
      if (!formData.description.trim()) errors.push("Description is required");
      if (!formData.category.trim()) errors.push("Category is required");
      if (!formData.scenarioContext.trim()) errors.push("Scenario Context is required");
      if (!formData.idealOutcome.trim()) errors.push("Ideal Outcome is required");
    } else if (step === 2) {
      if (!formData.personaName.trim()) errors.push("Persona Name is required");
      if (!formData.personaRole.trim()) errors.push("Persona Role is required");
      if (!formData.personaBackground.trim()) errors.push("Background Context is required");
      if (!formData.personaPainPoints.trim()) errors.push("Pain Points is required");
      if (!formData.personaObjections.trim()) errors.push("Objections & Excuses is required");
      if (!formData.personaPersonality.trim()) errors.push("Personality Description is required");
    } else if (step === 3) {
      if (!formData.productName.trim()) errors.push("Product Name is required");
      if (!formData.productDescription.trim()) errors.push("Product Description is required");
      if (!formData.productStrengths.trim()) errors.push("Key Strengths is required");
    } else if (step === 4) {
      if (!formData.courseModule.trim()) errors.push("Course Module is required");
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setValidationErrors([]);
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const prevStep = () => {
    setValidationErrors([]);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      toast.error("Please fix all form validation errors first.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...formData,
        rubric: {
          passingScore: 70,
          categories: [
            { name: "Objection Handling", weight: 40, criteria: [
              { label: "Excellent handling with value prop", score: 100 },
              { label: "Average handling", score: 70 },
              { label: "Poor handling", score: 40 }
            ]},
            { name: "Value Proposition", weight: 30, criteria: [
              { label: "Clear explanation", score: 100 },
              { label: "Unclear or generic explanation", score: 50 }
            ]},
            { name: "Closing Ability", weight: 30, criteria: [
              { label: "Successful closing trial", score: 100 },
              { label: "Missed closing signal", score: 50 }
            ]}
          ]
        }
      };
      await apiClient.post("/courses", payload);
      toast.success("Course created successfully!");
      router.push("/manager/courses");
    } catch (err) {
      toast.error("Failed to create course: " + getErrorMessage(err, "Terjadi kesalahan."));
    } finally {
      setLoading(false);
    }
  };

  const stepsInfo = [
    { title: "Course Details", desc: "General setup & scenario context" },
    { title: "Customer Persona", desc: "Customer profile & objections" },
    { title: "Product Knowledge", desc: "Product details & competitor notes" },
    { title: "Course Module", desc: "Course module & references" },
    { title: "Model Configuration", desc: "AI engine rules & review" }
  ];

  const voiceLabel = formData.personaGender === "F" ? "Female voice (F1–F3)" : "Male voice (M1–M5)";

  return (
    <>
      {/* AI Generate Modal */}
      {showAIModal && (
        <AIGenerateModal
          onClose={() => setShowAIModal(false)}
          onApply={handleAIApply}
        />
      )}

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-1.5">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl font-bold">Create New Training Course</h1>
              <p className="text-[var(--color-text-muted)] text-sm">Define customer persona, product details, and training rules.</p>
            </div>
          </div>
          {/* Tombol AI Generate */}
          <button
            type="button"
            onClick={() => setShowAIModal(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Generate with AI
          </button>
        </div>

        {/* Stepper */}
        <div className="card p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] flex items-center justify-center text-xs font-bold">
                {currentStep}
              </span>
              <div>
                <p className="text-xs font-bold text-[var(--color-text)]">Step {currentStep} of {totalSteps}</p>
                <p className="text-[10px] text-[var(--color-text-muted)]">{stepsInfo[currentStep - 1].title}: {stepsInfo[currentStep - 1].desc}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((stepNum) => (
                <div key={stepNum} className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === stepNum ? "w-10 bg-[var(--color-accent)]" :
                  currentStep > stepNum ? "w-4 bg-[var(--color-success)]" : "w-4 bg-slate-700"
                }`} />
              ))}
            </div>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationErrors.length > 0 && (
          <div className="p-3 bg-[var(--color-danger-light)]/20 border border-[var(--color-danger)]/30 rounded-xl text-xs text-[var(--color-danger)] flex flex-col gap-1">
            <span className="font-bold flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Please resolve the following before proceeding:</span>
            <ul className="list-disc pl-4 space-y-0.5">
              {validationErrors.map((err, idx) => <li key={idx}>{err}</li>)}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* STEP 1 */}
          {currentStep === 1 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              <h2 className="font-bold text-sm text-[var(--color-accent)]">1. General Information & Scenario Context</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Course Title</label>
                  <input required type="text" className="input" placeholder="e.g. Closing Deal with Skeptical Buyer" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Description</label>
                  <textarea required rows={2} className="input resize-none" placeholder="Explain what the sales rep will learn..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Difficulty</label>
                  <select className="input" value={formData.difficulty} onChange={e => setFormData({...formData, difficulty: e.target.value})}>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Category</label>
                  <input required type="text" className="input" placeholder="e.g. B2B Sales, Property" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Scenario Context (Setting)</label>
                  <textarea required rows={2} className="input resize-none" placeholder="Where is this happening? e.g. Phone call intro, offline meeting..." value={formData.scenarioContext} onChange={e => setFormData({...formData, scenarioContext: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Ideal Outcome</label>
                  <input required type="text" className="input" placeholder="What constitutes a successful closing?" value={formData.idealOutcome} onChange={e => setFormData({...formData, idealOutcome: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {currentStep === 2 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              <h2 className="font-bold text-sm text-[var(--color-accent)]">2. Customer Persona (AI Simulator)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Persona Name</label>
                  <input required type="text" className="input" placeholder="e.g. Pak Budi / Bu Rina" value={formData.personaName} onChange={e => setFormData({...formData, personaName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Persona Role</label>
                  <input required type="text" className="input" placeholder="e.g. Chief Marketing Officer" value={formData.personaRole} onChange={e => setFormData({...formData, personaRole: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <AvatarSelector
                    value={formData.personaGender}
                    onChange={(gender) => setFormData({ ...formData, personaGender: gender })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Personality Description</label>
                  <input required type="text" className="input" placeholder="e.g. Skeptical, analytical, direct" value={formData.personaPersonality} onChange={e => setFormData({...formData, personaPersonality: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Background Context</label>
                  <textarea required rows={2} className="input resize-none" placeholder="e.g. Strict manager who hates wasting time..." value={formData.personaBackground} onChange={e => setFormData({...formData, personaBackground: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Pain Points</label>
                  <textarea required rows={2} className="input resize-none" placeholder="What are they struggling with?" value={formData.personaPainPoints} onChange={e => setFormData({...formData, personaPainPoints: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Objections & Excuses</label>
                  <textarea required rows={2} className="input resize-none" placeholder="What doubts or objections will they raise?" value={formData.personaObjections} onChange={e => setFormData({...formData, personaObjections: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Buying Signals</label>
                  <input type="text" className="input" placeholder="What questions indicate they are interested?" value={formData.personaBuyingSignals} onChange={e => setFormData({...formData, personaBuyingSignals: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {currentStep === 3 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              <h2 className="font-bold text-sm text-[var(--color-accent)]">3. Product Knowledge (AI Knowledge Base)</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Product Name</label>
                  <input required type="text" className="input" placeholder="e.g. SalesCRM Pro" value={formData.productName} onChange={e => setFormData({...formData, productName: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Key Strengths</label>
                  <input required type="text" className="input" placeholder="What makes it better than competitors?" value={formData.productStrengths} onChange={e => setFormData({...formData, productStrengths: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Product Description</label>
                  <textarea required rows={2} className="input resize-none" placeholder="General description of what you are selling..." value={formData.productDescription} onChange={e => setFormData({...formData, productDescription: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1">Competitor Notes (Optional)</label>
                  <input type="text" className="input" placeholder="e.g. HubSpot has a longer setup time..." value={formData.competitorNotes} onChange={e => setFormData({...formData, competitorNotes: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {currentStep === 4 && (
            <div className="card p-5 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-[var(--color-accent)]">4. Course Module & Knowledge Base</h2>
                {formData.brochureText && (
                  <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3" /> Dokumen Brosur RAG Terhubung ({Math.round(formData.brochureText.length / 1024 * 10) / 10} KB)
                  </span>
                )}
              </div>
              {formData.brochureText && (
                <div className="p-3 bg-emerald-500/5 border border-emerald-500/15 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Terindeks Otomatis ke Supabase Vector Knowledge Base (pgvector)</span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Konten dokumen brosur ini telah diekstrak dan disiapkan untuk indexing RAG. Avatar 3D prospek dan mesin evaluasi akan menggunakan referensi ini secara real-time.
                  </p>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1 flex items-center justify-between">
                    Preparation Material
                    <span className="font-normal text-[var(--color-text-muted)] text-[10px]">Supports Markdown formatting (*bold*, lists, etc.)</span>
                  </label>
                  <textarea required rows={12} className="input resize-y text-sm font-mono" placeholder="Write down the material the sales rep needs to study before the roleplay begins..." value={formData.courseModule} onChange={e => setFormData({...formData, courseModule: e.target.value})} />
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-fade-in">
              <div className="card p-5 space-y-4">
                <h2 className="font-bold text-sm text-[var(--color-accent)]">5. AI Model Settings</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Max Turns</label>
                    <input required type="number" className="input" min="5" max="50" value={formData.maxTurns} onChange={e => setFormData({...formData, maxTurns: parseInt(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="card p-5 space-y-4">
                <h2 className="font-bold text-sm text-[var(--color-success)] flex items-center gap-1.5"><Check className="w-4 h-4" /> Ready for Review</h2>
                <div className="divide-y divide-[var(--color-border)] text-xs">
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Course Title:</span><span className="font-bold">{formData.title || "-"}</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Customer Persona:</span><span className="font-bold">{formData.personaName} ({formData.personaRole})</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Persona Gender:</span><span className="font-bold">{formData.personaGender === "F" ? "👩 Female" : "👨 Male"} ({voiceLabel})</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Product Target:</span><span className="font-bold">{formData.productName}</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Target Difficulty:</span><span className="font-bold">{formData.difficulty}</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Course Module:</span><span className="font-bold">{formData.courseModule.length > 50 ? formData.courseModule.substring(0, 50) + "..." : formData.courseModule || "-"}</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">RAG Vector Grounding:</span><span className={`font-bold ${formData.brochureText ? "text-emerald-400" : "text-[var(--color-text-muted)]"}`}>{formData.brochureText ? `✅ Brosur Terindeks (${formData.brochureText.length} karakter)` : "Modul Teks Standar"}</span></div>
                  <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Max Turn Limit:</span><span className="font-bold">{formData.maxTurns} turns</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between items-center pt-2">
            {currentStep > 1 ? (
              <button type="button" onClick={prevStep} className="btn btn-secondary px-5 flex items-center gap-1">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button type="button" onClick={() => router.back()} className="btn btn-secondary px-5">Cancel</button>
            )}
            {currentStep < totalSteps ? (
              <button type="button" onClick={nextStep} className="btn btn-primary px-6 flex items-center gap-1">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="submit" disabled={loading || !submitReady} className="btn btn-primary px-8 flex items-center gap-2">
                {loading ? "Creating..." : <><Save className="w-4 h-4" /> Create Course</>}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}