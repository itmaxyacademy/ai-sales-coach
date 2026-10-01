"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { toast } from "sonner";
import { PageHeader, AutoSkeleton } from "../../../components/ui";
import { Bot, Save, Building2, Sparkles, Globe, FileText, X, CheckCircle2 } from "lucide-react";

export default function AIContextPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    industry: "",
    website: "",
    description: "",
    coreProducts: "",
    targetAudience: "",
    usp: "",
    commonObjections: "",
    brandTone: ""
  });

  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTab, setAiTab] = useState<'url' | 'file' | 'text'>('url');
  const [aiUrl, setAiUrl] = useState("");
  const [aiDesc, setAiDesc] = useState("");
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/company/profile");
      if (res?.data) {
        setFormData({
          industry: res.data.industry ?? "",
          website: res.data.website ?? "",
          description: res.data.description ?? "",
          coreProducts: res.data.coreProducts ?? "",
          targetAudience: res.data.targetAudience ?? "",
          usp: res.data.usp ?? "",
          commonObjections: res.data.commonObjections ?? "",
          brandTone: res.data.brandTone ?? ""
        });
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load company profile"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch("/company/ai-context", formData);
      toast.success("AI Knowledge Base updated successfully!");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update context"));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
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
        if (aiDesc.trim()) uploadData.append('brief', aiDesc.trim());

        const res = await apiClient.upload('/ai/generate-company-context', uploadData);
        const ctx = res.context || {};

        setFormData(prev => ({
          ...prev,
          // ✅ Tambahkan ctx.website di sini agar AI bisa mengisi otomatis dari dokumen
          website: ctx.website ?? prev.website ?? "",
          industry: ctx.industry ?? prev.industry ?? "",
          description: ctx.description ?? prev.description ?? "",
          coreProducts: ctx.coreProducts ?? prev.coreProducts ?? "",
          targetAudience: ctx.targetAudience ?? prev.targetAudience ?? "",
          usp: ctx.usp ?? prev.usp ?? "",
          commonObjections: ctx.commonObjections ?? prev.commonObjections ?? "",
          brandTone: ctx.brandTone ?? prev.brandTone ?? "",
        }));

        toast.success('AI generated context successfully!');
        setShowAiModal(false);
        return;
      }

      const payload = aiTab === 'url' ? { url: cleanUrl } : { brief: aiDesc };
      const res = await apiClient.post("/ai/generate-company-context", payload);
      const ctx = res.context || {};
      
      setFormData(prev => ({
        ...prev,
        // ✅ Ubah logika website: Jika tab URL pakai cleanUrl, selain itu (Text) ambil dari ctx.website
        website: aiTab === 'url' ? cleanUrl : (ctx.website ?? prev.website ?? ""),
        industry: ctx.industry ?? prev.industry ?? "",
        description: ctx.description ?? prev.description ?? "",
        coreProducts: ctx.coreProducts ?? prev.coreProducts ?? "",
        targetAudience: ctx.targetAudience ?? prev.targetAudience ?? "",
        usp: ctx.usp ?? prev.usp ?? "",
        commonObjections: ctx.commonObjections ?? prev.commonObjections ?? "",
        brandTone: ctx.brandTone ?? prev.brandTone ?? "",
      }));

      toast.success("AI generated context successfully!");
      setShowAiModal(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate context from AI"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="AI Knowledge Base"
        subtitle="Manage your company metadata. This data is injected directly into the AI's prompt to ensure hyper-relevant, non-generic roleplays and evaluations."
      />

      <AutoSkeleton isLoading={loading} type="card">
        <form onSubmit={handleSubmit} className="card p-6 md:p-8 space-y-6 bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm">
          
          <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)] mb-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[var(--color-text-muted)]" />
              <h2 className="text-lg font-semibold">Company Context Settings</h2>
            </div>
            <button 
              type="button"
              onClick={() => setShowAiModal(true)}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20 hover:bg-[var(--color-accent)]/20 hover:border-[var(--color-accent)]/40 transition-all shadow-[0_0_15px_rgba(var(--color-accent-rgb),0.1)]"
            >
              <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" /> Auto-Fill with AI
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Industry</label>
                <input
                  name="industry"
                  value={formData.industry || ""}
                  onChange={handleChange}
                  placeholder="e.g., Technology, Retail & Sports Apparel..."
                  className="w-full p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Website / Dokumen URL</label>
                <input
                  type="url"
                  name="website"
                  value={formData.website || ""}
                  onChange={handleChange}
                  placeholder="https://yourdomain.com"
                  className="w-full p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Company Description</label>
              <textarea
                name="description"
                value={formData.description || ""}
                onChange={handleChange}
                placeholder="e.g., Kami adalah distributor SaaS untuk rumah sakit..."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
              <p className="text-xs text-[var(--color-text-muted)]">Brief overview of what your company does.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Core Products / Services</label>
              <textarea
                name="coreProducts"
                value={formData.coreProducts || ""}
                onChange={handleChange}
                placeholder="e.g., Aplikasi HIS (Hospital Info System), Layanan Cloud Medis..."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Target Audience (ICP)</label>
              <textarea
                name="targetAudience"
                value={formData.targetAudience || ""}
                onChange={handleChange}
                placeholder="e.g., Direktur RS, Kepala IT Rumah Sakit..."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Unique Selling Proposition (USP)</label>
              <textarea
                name="usp"
                value={formData.usp || ""}
                onChange={handleChange}
                placeholder="e.g., SLA 99.99%, Data terenkripsi HIPAA, Harga 30% lebih murah..."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
              <p className="text-xs text-[var(--color-text-muted)]">Crucial for AI to give accurate coaching hints when sales reps get stuck.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Common Objections</label>
              <textarea
                name="commonObjections"
                value={formData.commonObjections || ""}
                onChange={handleChange}
                placeholder="e.g., Vendor saat ini sudah cukup bagus, Budget IT dipotong tahun ini..."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
              <p className="text-xs text-[var(--color-text-muted)]">The AI Buyer Persona will use these to challenge your sales team during roleplays.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[var(--color-text-muted)] block">Brand Tone & Style</label>
              <textarea
                name="brandTone"
                value={formData.brandTone || ""}
                onChange={handleChange}
                placeholder="e.g., Profesional, ramah, dan sangat menekankan keamanan data."
                className="w-full min-h-[80px] p-3 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-accent)] text-sm"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-[var(--color-border)] flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-accent)] text-white font-medium rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save AI Context
                </>
              )}
            </button>
          </div>

        </form>
      </AutoSkeleton>

      {/* AI Generate Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up">
            
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg)]">
              <div className="flex items-center gap-2 text-[var(--color-accent)]">
                <Sparkles className="w-4 h-4" />
                <h3 className="font-semibold">AI Magic Auto-Fill</h3>
              </div>
              <button 
                onClick={() => setShowAiModal(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-sm text-[var(--color-text-muted)]">
                Let our AI scan your website or read a short brief to automatically deduce your Core Products, Audience, USP, and Objections.
              </p>

              <div className="flex bg-[var(--color-bg)] p-1 rounded-lg border border-[var(--color-border)]">
                <button
                  onClick={() => setAiTab('url')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${aiTab === 'url' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  <Globe className="w-3.5 h-3.5" /> Website / Doc URL
                </button>
                <button
                  onClick={() => setAiTab('file')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${aiTab === 'file' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  <FileText className="w-3.5 h-3.5" /> Upload Dokumen
                </button>
                <button
                  onClick={() => setAiTab('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-semibold rounded-md transition-all ${aiTab === 'text' ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                >
                  <Bot className="w-3.5 h-3.5" /> Short Brief
                </button>
              </div>

              {aiTab === 'url' ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]">Website URL atau URL Dokumen</label>
                  <input
                    type="url"
                    value={aiUrl || ""}
                    onChange={(e) => setAiUrl(e.target.value)}
                    placeholder="https://yourdomain.com atau https://.../file.pdf"
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:ring-1 focus:ring-[var(--color-accent)] text-sm text-[var(--color-text)] outline-none"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)]">Support: website, PDF, DOCX, TXT, HTML, CSV, dan format dokumen lain yang disupport oleh scraper.</p>
                </div>
              ) : aiTab === 'file' ? (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]">Upload file dokumen</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.html,.htm,.csv,.tsv,.rtf,.pptx,.ppt,.xlsx,.xls,.odt,.epub"
                    onChange={(e) => setAiFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text)] outline-none"
                  />
                  <p className="text-[10px] text-[var(--color-text-muted)]">File yang diunggah akan diekstrak langsung oleh scraper, tanpa perlu URL.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]">What does your company do?</label>
                  <textarea
                    value={aiDesc || ""}
                    onChange={(e) => setAiDesc(e.target.value)}
                    placeholder="e.g., Kami perusahaan SaaS B2B yang membuat aplikasi CRM untuk sales property..."
                    className="w-full min-h-[100px] px-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg focus:ring-1 focus:ring-[var(--color-accent)] text-sm text-[var(--color-text)] outline-none"
                  />
                </div>
              )}

              <button
                onClick={handleGenerateContext}
                disabled={isGenerating || (aiTab === 'url' ? !aiUrl : aiTab === 'file' ? !aiFile : !aiDesc)}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold bg-[var(--color-accent)] hover:brightness-110 text-white flex justify-center items-center gap-2 transition-all disabled:opacity-50"
              >
                {isGenerating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? "Analyzing & Generating..." : "Generate Magic"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}