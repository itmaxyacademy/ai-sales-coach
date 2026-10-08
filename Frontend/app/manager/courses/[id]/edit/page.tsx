"use client";
import { getErrorMessage } from "@/lib/api/client";
import { toast } from "sonner";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiClient } from "../../../../../lib/api/client";
import { ArrowLeft, Save, ChevronRight, ChevronLeft, Check, AlertCircle } from "lucide-react";
import { AvatarSelector } from "../../../../../components/AvatarSelector";

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [formData, setFormData] = useState({
    title: "", description: "", difficulty: "Intermediate", category: "B2B Sales",
    personaName: "", personaRole: "", personaGender: "M", personaBackground: "", personaPainPoints: "", personaObjections: "", personaBuyingSignals: "", personaPersonality: "",
    productName: "", productDescription: "", productStrengths: "", competitorNotes: "",
    scenarioContext: "", idealOutcome: "", courseModule: "",
    aiModelSize: "7b", aiTemperature: 0.3, maxTurns: 20
  });

  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!params.id) return;
    
    const fetchCourse = async () => {
      try {
        const data = await apiClient.get('/courses/' + params.id);
        if (data.course) {
          const c = data.course;
          setFormData({
            title: c.title || "",
            description: c.description || "",
            difficulty: c.difficulty || "Intermediate",
            category: c.category || "B2B Sales",
            personaName: c.personaName || "",
            personaRole: c.personaRole || "",
            personaGender: c.personaGender || "M",
            personaBackground: c.personaBackground || "",
            personaPainPoints: c.personaPainPoints || "",
            personaObjections: c.personaObjections || "",
            personaBuyingSignals: c.personaBuyingSignals || "",
            personaPersonality: c.personaPersonality || "",
            productName: c.productName || "",
            productDescription: c.productDescription || "",
            productStrengths: c.productStrengths || "",
            competitorNotes: c.competitorNotes || "",
            scenarioContext: c.scenarioContext || "",
            idealOutcome: c.idealOutcome || "",
            courseModule: c.courseModule || c.documents?.find((d: any) => d.category === 'module')?.content || "",
            aiModelSize: c.aiModelSize || "7b",
            aiTemperature: c.aiTemperature || 0.3,
            maxTurns: c.maxTurns || 20
          });
        }
      } catch (err) {
        toast.error("Failed to load course: " + getErrorMessage(err, "Terjadi kesalahan."));
      } finally {
        setFetching(false);
      }
    };
    
    fetchCourse();
  }, [params.id]);

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
      if (!formData.courseModule.trim()) errors.push("Course Module / Preparation Material is required");
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
      const payload = { ...formData };
      await apiClient.patch("/courses/" + params.id, payload);
      toast.success("Course updated successfully!");
      router.push("/manager/courses");
    } catch (err) {
      toast.error("Failed to update course: " + getErrorMessage(err, "Terjadi kesalahan."));
    } finally {
      setLoading(false);
    }
  };

  const stepsInfo = [
    { title: "Course Details", desc: "General setup & scenario context" },
    { title: "Customer Persona", desc: "Customer profile & objections" },
    { title: "Product Knowledge", desc: "Product details & competitor notes" },
    { title: "Course Module", desc: "Preparation material & guidelines" },
    { title: "Model Configuration", desc: "AI engine rules & review" }
  ];

  const voiceLabel = formData.personaGender === "F"
    ? "Female voice (F1–F3)"
    : "Male voice (M1–M5)";

  if (fetching) {
    return <div className="p-6 text-center text-[var(--color-text-muted)] animate-pulse">Loading course data...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-1.5"><ArrowLeft className="w-4 h-4" /></button>
          <div>
            <h1 className="text-xl font-bold">Edit Training Course</h1>
            <p className="text-[var(--color-text-muted)] text-sm">Update customer persona, product details, and training rules.</p>
          </div>
        </div>
      </div>

      {/* Stepper Progress Bar */}
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
            {[1, 2, 3, 4].map((stepNum) => (
              <div 
                key={stepNum} 
                className={`h-2 rounded-full transition-all duration-300 ${
                  currentStep === stepNum ? "w-10 bg-[var(--color-accent)]" :
                  currentStep > stepNum ? "w-4 bg-[var(--color-success)]" :
                  "w-4 bg-slate-700"
                }`}
              />
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
        
        {/* STEP 1: General Info & Scenario */}
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
                <textarea required rows={2} className="input resize-none" placeholder="Explain what the sales rep will learn from this course..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
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
                <label className="block text-xs font-semibold mb-1">Skenario Context (Setting)</label>
                <textarea required rows={2} className="input resize-none" placeholder="Where is this happening? e.g. Phone call intro, offline meeting..." value={formData.scenarioContext} onChange={e => setFormData({...formData, scenarioContext: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1">Ideal Outcome</label>
                <input required type="text" className="input" placeholder="What constitutes a successful closing?" value={formData.idealOutcome} onChange={e => setFormData({...formData, idealOutcome: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Customer Persona */}
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
                <textarea required rows={2} className="input resize-none" placeholder="e.g. Strict manager who hates wasting time on useless tools..." value={formData.personaBackground} onChange={e => setFormData({...formData, personaBackground: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1">Pain Points</label>
                <textarea required rows={2} className="input resize-none" placeholder="What are they struggling with?" value={formData.personaPainPoints} onChange={e => setFormData({...formData, personaPainPoints: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1">Objections & Excuses</label>
                <textarea required rows={2} className="input resize-none" placeholder="What doubts or objections will they raise during the call?" value={formData.personaObjections} onChange={e => setFormData({...formData, personaObjections: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1">Buying Signals</label>
                <input type="text" className="input" placeholder="What questions indicate they are interested?" value={formData.personaBuyingSignals} onChange={e => setFormData({...formData, personaBuyingSignals: e.target.value})} />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Product Knowledge */}
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

        {/* STEP 4: Course Module */}
        {currentStep === 4 && (
          <div className="card p-5 space-y-4 animate-fade-in">
            <h2 className="font-bold text-sm text-[var(--color-accent)]">4. Course Module</h2>
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

        {/* STEP 5: AI Model Settings & Confirmation */}
        {currentStep === 5 && (
          <div className="space-y-6 animate-fade-in">
            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-sm text-[var(--color-accent)]">5. AI Model Settings</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">AI Model Size</label>
                  <select className="input" value={formData.aiModelSize} onChange={e => setFormData({...formData, aiModelSize: e.target.value})}>
                    <option value="7b">Llama-3-8B (Fast & Standard)</option>
                    <option value="70b">Llama-3-70B (Smart & Slower)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">AI Temperature (Creativity)</label>
                  <input type="range" min="0.1" max="1.0" step="0.1" className="w-full mt-2" value={formData.aiTemperature} onChange={e => setFormData({...formData, aiTemperature: parseFloat(e.target.value)})} />
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mt-1">
                    <span>Conservative ({formData.aiTemperature})</span>
                    <span>Creative</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Max Turns</label>
                  <input required type="number" className="input" min="5" max="50" value={formData.maxTurns} onChange={e => setFormData({...formData, maxTurns: parseInt(e.target.value)})} />
                </div>
              </div>
            </div>

            <div className="card p-5 space-y-4">
              <h2 className="font-bold text-sm text-[var(--color-success)] flex items-center gap-1.5"><Check className="w-4 h-4" /> Ready for Review</h2>
              <div className="divide-y divide-[var(--color-border)] text-xs">
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Course Title:</span> <span className="font-bold">{formData.title || "-"}</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Customer Persona:</span> <span className="font-bold">{formData.personaName} ({formData.personaRole})</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Persona Gender:</span> <span className="font-bold">{formData.personaGender === "F" ? "👩 Female" : "👨 Male"} ({voiceLabel})</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Product Target:</span> <span className="font-bold">{formData.productName}</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Target Difficulty:</span> <span className="font-bold">{formData.difficulty}</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Course Module:</span> <span className="font-bold">{formData.courseModule.length > 50 ? formData.courseModule.substring(0, 50) + "..." : formData.courseModule || "-"}</span></div>
                <div className="py-2 flex justify-between"><span className="text-[var(--color-text-muted)]">Max Turn Limit:</span> <span className="font-bold">{formData.maxTurns} turns</span></div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          {currentStep > 1 ? (
            <button type="button" onClick={prevStep} className="btn btn-secondary px-5 flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button type="button" onClick={() => router.back()} className="btn btn-secondary px-5">
              Cancel
            </button>
          )}

          {currentStep < totalSteps ? (
            <button type="button" onClick={nextStep} className="btn btn-primary px-6 flex items-center gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button type="submit" disabled={loading} className="btn btn-success px-8 flex items-center gap-2">
              {loading ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}