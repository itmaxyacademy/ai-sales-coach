"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiClient } from "../../../lib/api/client";
import { useAuthStore, getDashboardPath } from "../../../store/authStore";
import { toast } from "sonner";
import { 
  Building2, 
  Target, 
  Bot, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  Sparkles,
  Globe,
  Briefcase
} from "lucide-react";
import Image from "next/image";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiUrl, setAiUrl] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiTab, setAiTab] = useState<'url' | 'file' | 'brief'>('url');
  const [aiFile, setAiFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    industry: "Technology",
    website: "",
    description: "",
    coreProducts: "",
    targetAudience: "",
    usp: "",
    commonObjections: "",
    brandTone: ""
  });

  // Jika bukan admin/super admin, tendang ke dashboard (tidak berhak setup ini)
  useEffect(() => {
    if (user && user.role !== "company_admin" && user.role !== "super_admin") {
      router.push("/");
    }
  }, [user, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () => setStep(s => Math.min(3, s + 1));
  const handlePrev = () => setStep(s => Math.max(1, s - 1));

  const handleSkip = () => {
    toast.success("Welcome aboard! You can setup AI Context later in Settings.");
    router.push(user ? getDashboardPath(user.role) : "/admin/dashboard");
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await apiClient.patch('/company/ai-context', formData);
      toast.success("Company Context saved!");
      router.push(user ? getDashboardPath(user.role) : "/admin/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save context"));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateContext = async () => {
    setIsGenerating(true);
    try {
      let cleanUrl = aiUrl;
      if (aiTab === 'url' && aiUrl) {
        try {
          const urlObj = new URL(aiUrl);
          cleanUrl = `${urlObj.origin}${urlObj.pathname}`;
        } catch {
          // ignore invalid url format for now
        }
      }
      
      if (aiTab === 'file') {
        if (!aiFile) {
          throw new Error('Pilih file dokumen terlebih dahulu.');
        }
        const uploadData = new FormData();
        uploadData.append('file', aiFile);
        if (aiBrief.trim()) uploadData.append('brief', aiBrief.trim());

        const res = await apiClient.upload('/ai/generate-company-context', uploadData);
        const ctx = res.context || {};

        setFormData(prev => ({
          ...prev,
          website: ctx.website ?? prev.website ?? "",
          industry: ctx.industry ?? prev.industry ?? "",
          description: ctx.description ?? prev.description ?? "",
          coreProducts: ctx.coreProducts ?? prev.coreProducts ?? "",
          targetAudience: ctx.targetAudience ?? prev.targetAudience ?? "",
          usp: ctx.usp ?? prev.usp ?? "",
          commonObjections: ctx.commonObjections ?? prev.commonObjections ?? "",
          brandTone: ctx.brandTone ?? prev.brandTone ?? "",
        }));

        toast.success('✨ AI berhasil melengkapi profil perusahaan!');
        setShowAiModal(false);
        return;
      }

      const payload = aiTab === 'url' ? { url: cleanUrl } : { brief: aiBrief };
      const res = await apiClient.post("/ai/generate-company-context", payload);
      const ctx = res.context || {};
      
      setFormData(prev => ({
        ...prev,
        website: aiTab === 'url' ? cleanUrl : (ctx.website ?? prev.website ?? ""),
        industry: ctx.industry ?? prev.industry ?? "",
        description: ctx.description ?? prev.description ?? "",
        coreProducts: ctx.coreProducts ?? prev.coreProducts ?? "",
        targetAudience: ctx.targetAudience ?? prev.targetAudience ?? "",
        usp: ctx.usp ?? prev.usp ?? "",
        commonObjections: ctx.commonObjections ?? prev.commonObjections ?? "",
        brandTone: ctx.brandTone ?? prev.brandTone ?? "",
      }));
      
      toast.success("✨ AI berhasil melengkapi profil perusahaan!");
      setShowAiModal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Gagal meng-generate context"));
    } finally {
      setIsGenerating(false);
    }
  };

  const steps = [
    { title: "Company Profile", icon: Building2 },
    { title: "Sales Strategy", icon: Target },
    { title: "AI Tuning", icon: Bot }
  ];

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--color-surface)] p-4 sm:p-6">
      {/* Backgrounds */}
      <div aria-hidden="true" className="absolute inset-0 bg-[url('/login-ai-hub-hd.webp')] bg-cover bg-center" />
      <div className="absolute inset-0 bg-black/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(74,156,247,0.24),transparent_34%),linear-gradient(120deg,rgba(8,12,18,0.72),rgba(8,12,18,0.28)_52%,rgba(8,12,18,0.68))]" />

      <div className="relative z-10 w-full max-w-[680px] bg-[var(--color-bg)]/62 backdrop-blur-2xl rounded-[2rem] shadow-2xl flex flex-col border border-white/15 max-h-[90vh]">
        
        {/* Header Section */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/m-logo.png"
              alt="MAXY Academy"
              width={48}
              height={48}
              className="h-10 w-10 overflow-hidden rounded-xl object-contain shadow-sm"
              priority
            />
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Train Your AI Coach</h1>
              <p className="text-xs text-white/60 mt-0.5">Setup context for hyper-relevant roleplays.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAiModal(true)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40 transition-all shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.1)]"
            >
              <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Auto-Fill with AI
            </button>
            <button onClick={handleSkip} className="text-xs font-medium text-white/40 hover:text-white transition-colors">
              Skip for now
            </button>
          </div>
        </div>

        {/* Stepper Progress */}
        <div className="px-6 py-4 bg-white/[0.02] flex items-center justify-between border-b border-white/5">
          {steps.map((s, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isPast = step > stepNum;
            const Icon = s.icon;
            
            return (
              <div key={s.title} className="flex flex-col items-center gap-1.5 w-1/3 relative">
                {idx !== 0 && (
                  <div className={`absolute left-[-50%] top-3 w-full h-[2px] ${isPast ? "bg-blue-500" : "bg-white/10"}`} />
                )}
                <div 
                  className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-500
                    ${isActive ? "bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.4)]" 
                    : isPast ? "bg-blue-500 border-blue-500 text-white" 
                    : "bg-black/50 border-white/10 text-white/30"}`}
                >
                  {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3 h-3" />}
                </div>
                <span className={`text-xs font-medium transition-colors ${isActive ? "text-blue-400" : isPast ? "text-white/80" : "text-white/30"}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Form Container */}
        <div className="px-6 py-5 flex flex-col flex-1 overflow-y-auto custom-scrollbar">
          
          <div className="flex-1">
            {step === 1 && (
              <div className="animate-fade-in space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/60 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Industry</label>
                    <input
                      name="industry"
                      value={formData.industry || ""}
                      onChange={handleChange}
                      placeholder="e.g., Technology, Real Estate, dll"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-white/60 flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Website / Dokumen URL <span className="text-white/30 font-normal">(Optional)</span></label>
                    <input
                      name="website"
                      type="url"
                      value={formData.website || ""}
                      onChange={handleChange}
                      placeholder="https://yourdomain.com"
                      className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Company Description</label>
                  <textarea
                    name="description"
                    value={formData.description || ""}
                    onChange={handleChange}
                    placeholder="Briefly describe your company's mission and what you do..."
                    className="w-full min-h-[60px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Core Products or Services</label>
                  <textarea
                    name="coreProducts"
                    value={formData.coreProducts || ""}
                    onChange={handleChange}
                    placeholder="List the main products or services your sales team sells..."
                    className="w-full min-h-[60px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Target Audience (ICP)</label>
                  <textarea
                    name="targetAudience"
                    value={formData.targetAudience || ""}
                    onChange={handleChange}
                    placeholder="Who are you selling to? e.g. IT Directors, Hospital Administrators..."
                    className="w-full min-h-[80px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Unique Selling Proposition (USP)</label>
                  <textarea
                    name="usp"
                    value={formData.usp || ""}
                    onChange={handleChange}
                    placeholder="What makes your product better? e.g. 24/7 support, highest security compliance..."
                    className="w-full min-h-[80px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                  <p className="text-[10px] text-blue-300/70">The AI uses this to coach reps when they get stuck selling your product.</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Common Objections</label>
                  <textarea
                    name="commonObjections"
                    value={formData.commonObjections || ""}
                    onChange={handleChange}
                    placeholder="e.g. The price is too high, we already have a vendor..."
                    className="w-full min-h-[80px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                  <p className="text-[10px] text-orange-300/70">The AI Buyer Persona will actively use these to challenge your reps.</p>
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/60">Brand Tone & Style</label>
                  <textarea
                    name="brandTone"
                    value={formData.brandTone || ""}
                    onChange={handleChange}
                    placeholder="e.g. Professional, data-driven, empathetic..."
                    className="w-full min-h-[60px] px-3 py-2 bg-black/40 border border-white/10 rounded-lg focus:ring-1 focus:ring-blue-500/50 text-xs text-white placeholder-white/20 outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="pt-6 mt-4 border-t border-white/5 flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={step === 1}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                step === 1 ? "opacity-0 pointer-events-none" : "bg-white/5 hover:bg-white/10 text-white"
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-accent)] hover:brightness-110 text-white shadow-sm transition-all"
              >
                Continue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold bg-[var(--color-accent)] hover:brightness-110 text-white shadow-sm transition-all"
              >
                {loading ? "Saving..." : "Complete Setup"} <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </div>

      {/* AI Generate Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h2 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" /> Auto-Generate Company Context
              </h2>
              <button onClick={() => setShowAiModal(false)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]">&times;</button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex bg-[var(--color-bg)] rounded-lg p-1 border border-[var(--color-border)]">
                <button
                  onClick={() => setAiTab('url')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${aiTab === 'url' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  🌐 Paste Website URL
                </button>
                <button
                  onClick={() => setAiTab('file')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${aiTab === 'file' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  📄 Upload Dokumen
                </button>
                <button
                  onClick={() => setAiTab('brief')}
                  className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${aiTab === 'brief' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  💬 Describe Business
                </button>
              </div>

              {aiTab === 'url' ? (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs text-[var(--color-text-muted)]">Website / URL Dokumen (AI akan scrape atau ekstrak otomatis)</label>
                  <input
                    type="url"
                    value={aiUrl || ""}
                    onChange={(e) => setAiUrl(e.target.value)}
                    placeholder="https://yourcompany.com atau https://.../file.pdf"
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] outline-none focus:border-blue-500/50"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)]">Bisa pakai URL website atau dokumen seperti PDF, DOCX, TXT, HTML, CSV.</p>
                </div>
              ) : aiTab === 'file' ? (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs text-[var(--color-text-muted)]">Upload file dokumen</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.html,.htm,.csv,.tsv,.rtf,.pptx,.ppt,.xlsx,.xls,.odt,.epub"
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] outline-none"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)]">File langsung diekstrak tanpa perlu URL dokumen.</p>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs text-[var(--color-text-muted)]">Deskripsi Singkat (1-2 kalimat tentang bisnis Anda)</label>
                  <textarea
                    value={aiBrief || ""}
                    onChange={(e) => setAiBrief(e.target.value)}
                    placeholder="Contoh: Kami adalah agensi properti yang fokus menjual rumah subsidi ke milenial..."
                    className="w-full min-h-[80px] px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-xs text-[var(--color-text)] outline-none resize-none focus:border-blue-500/50"
                  />
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg)] flex justify-end gap-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerateContext}
                disabled={isGenerating || (aiTab === 'url' ? !aiUrl : aiTab === 'file' ? !aiFile : !aiBrief)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--color-accent)] hover:brightness-110 text-white flex items-center gap-2 transition-all disabled:opacity-50"
              >
                {isGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isGenerating ? "Generating..." : "Generate Magic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}