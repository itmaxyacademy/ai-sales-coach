"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../../lib/api/client";
import { SlidersHorizontal, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { PageHeader, AutoSkeleton } from "../../../../components/ui";

interface SAWConfig {
  c1_avgScore: number;
  c2_outcomeRate: number;
  c3_improvement: number;
  c4_completionRate: number;
  c5_deadlineCompliance: number;
  updatedAt: string;
}

const labels: Record<keyof Omit<SAWConfig, "updatedAt">, { title: string; desc: string }> = {
  c1_avgScore: { title: "Average Score", desc: "Overall roleplay performance score" },
  c2_outcomeRate: { title: "Outcome Rate", desc: "Success rate in closing deals" },
  c3_improvement: { title: "Improvement", desc: "Month-over-month score growth" },
  c4_completionRate: { title: "Completion Rate", desc: "Percentage of assignments completed" },
  c5_deadlineCompliance: { title: "Deadline Compliance", desc: "Completing tasks before due dates" },
};

export default function SAWConfigPage() {
  const [config, setConfig] = useState<Omit<SAWConfig, "updatedAt"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  useEffect(() => {
    apiClient.get("/manager/leaderboard/config")
      .then(res => {
        if (res) {
          const cfg = res.config || res.data?.config || res;
          // Map backend keys (c1, c2, c3, c4, c5) to frontend keys
          const { c1, c2, c3, c4, c5 } = cfg || {};
          setConfig({
            c1_avgScore: (c1 ?? 30) / 100,        // Backend returns percentage (0-100), convert to decimal (0-1)
            c2_outcomeRate: (c2 ?? 30) / 100,
            c3_improvement: (c3 ?? 20) / 100,
            c4_completionRate: (c4 ?? 15) / 100,
            c5_deadlineCompliance: (c5 ?? 5) / 100
          });
        }
      })
      .catch(err => setMessage({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") }))
      .finally(() => setLoading(false));
  }, []);

  const total = config ? Object.values(config).reduce((acc, val) => acc + val, 0) : 0;
  const isValid = Math.abs(total - 1.0) < 0.001; // Allow float imprecision

  const handleSave = async () => {
    if (!config || !isValid) return;
    setSaving(true);
    setMessage(null);
    try {
      // Convert decimal format (0-1) back to percentage (0-100) with backend keys
      const payload = {
        c1: Math.round(config.c1_avgScore * 100),
        c2: Math.round(config.c2_outcomeRate * 100),
        c3: Math.round(config.c3_improvement * 100),
        c4: Math.round(config.c4_completionRate * 100),
        c5: Math.round(config.c5_deadlineCompliance * 100),
      };
      await apiClient.patch("/manager/leaderboard/config", payload);
      setMessage({ type: "success", text: "Configuration saved successfully." });
    } catch (err) {
      setMessage({ type: "error", text: getErrorMessage(err, "Terjadi kesalahan.") });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof Omit<SAWConfig, "updatedAt">, value: number) => {
    if (!config) return;
    setConfig({ ...config, [key]: value / 100 });
  };

  if (!loading && !config) return null;

  return (
    <AutoSkeleton isLoading={loading} type="card">
      {config && (
        <div className="p-6 max-w-3xl mx-auto space-y-5">
      <PageHeader
        title="SAW Rankings & Weights"
        subtitle="Configure criteria weights for the Simple Additive Weighting (SAW) algorithm used to rank sales reps."
        // icon={<SlidersHorizontal className="w-4 h-4" />}
      />

      <div className="card p-6">
        <div className={`p-4 rounded-lg text-sm flex flex-col gap-2 mb-6 ${
          isValid ? "bg-[var(--color-accent-light)] text-[var(--color-accent)]" : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total Weight Distribution</span>
            <span className="font-bold text-lg">{(total * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden bg-white/50">
            <div 
              className={`h-full rounded-full transition-all ${isValid ? "bg-[var(--color-accent)]" : "bg-[var(--color-danger)]"}`} 
              style={{ width: `${Math.min(total * 100, 100)}%` }} 
            />
          </div>
          {!isValid && <p className="text-xs font-semibold">Total weight must be exactly 100%.</p>}
        </div>

        <div className="space-y-6">
          {(Object.keys(config) as Array<keyof Omit<SAWConfig, "updatedAt">>).map((key) => {
            const pct = Math.round(config[key] * 100);
            return (
              <div key={key}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <label className="font-semibold text-sm">{labels[key].title}</label>
                    <p className="text-xs text-[var(--color-text-muted)]">{labels[key].desc}</p>
                  </div>
                  <span className="text-sm font-bold bg-[var(--color-bg)] px-2 py-1 rounded border border-[var(--color-border)] w-14 text-center">
                    {pct}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0" max="100" step="5"
                  value={pct}
                  onChange={(e) => handleChange(key, parseInt(e.target.value))}
                  className="w-full h-2 bg-[var(--color-border)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                />
              </div>
            );
          })}
        </div>

        {message && (
          <div className={`mt-6 p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.type === "success" ? "bg-[var(--color-success-light)] text-[var(--color-success)]" : "bg-[var(--color-danger-light)] text-[var(--color-danger)]"
          }`}>
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {message.text}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="btn btn-primary px-8 flex items-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </button>
        </div>
      </div>
        </div>
      )}
    </AutoSkeleton>
  );
}
