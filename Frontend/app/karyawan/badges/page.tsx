"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Award, Lock, Sparkles, Calendar, Zap, AlertCircle } from "lucide-react";
import { AutoSkeleton } from "../../../components/ui";

interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
}

interface EarnedBadge {
  badge: Badge;
  unlockedAt: string;
  metadata?: any;
}

interface BadgesResponse {
  earned: EarnedBadge[];
  available: Badge[];
  totalEarned: number;
  totalAvailable: number;
}

export default function BadgesPage() {
  const [data, setData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "earned" | "locked">("all");

  useEffect(() => {
    apiClient.get("/me/badges")
      .then(res => {
        if (res?.data) {
          setData(res.data);
        }
      })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, []);

  const earned = data?.earned || [];
  const locked = data?.available || [];
  const totalEarned = data?.totalEarned || 0;
  const totalAvailable = data?.totalAvailable || 0;
  const progressPct = totalAvailable > 0 ? Math.round((totalEarned / totalAvailable) * 100) : 0;

  // Last unlocked badge
  const lastUnlocked = earned.length > 0 ? earned[0] : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {/* <Award className="w-6 h-6 text-amber-500 animate-bounce" /> */}
            Badges & Achievements
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm mt-0.5">Collect achievements as you improve your sales rep skills.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[var(--color-danger-light)]/20 border border-[var(--color-danger)]/30 rounded-xl text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Progress Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card flex flex-col gap-2">
          <span className="stat-label">Achievements Unlock Rate</span>
          <div className="text-3xl font-black">{progressPct}%</div>
          <div className="w-full progress-bar mt-1">
            <div className="progress-fill bg-amber-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-1">{totalEarned} earned of {totalAvailable} total badges</p>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div>
            <span className="stat-label">Earned Badges</span>
            <div className="text-3xl font-black mt-1 flex items-center gap-2 text-amber-500">
              <Award className="w-8 h-8 text-amber-500" />
              <span>{totalEarned}</span>
            </div>
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]">Keep completing training courses to unlock more!</p>
        </div>

        <div className="stat-card flex flex-col justify-between">
          <div>
            <span className="stat-label">Last Achievement Unlocked</span>
            {lastUnlocked ? (
              <div className="flex items-center gap-3 mt-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-2xl border border-amber-500/20">
                  {lastUnlocked.badge.icon || "🏆"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--color-text)] truncate">{lastUnlocked.badge.name}</p>
                  <p className="text-[9px] text-[var(--color-text-muted)] mt-0.5 truncate flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-[var(--color-accent)]" /> {new Date(lastUnlocked.unlockedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)] mt-2">No achievements unlocked yet.</p>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-text-muted)]"></p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)]">
        {[
          { key: "all", label: `All Badges (${totalAvailable})` },
          { key: "earned", label: `Earned (${totalEarned})` },
          { key: "locked", label: `Locked (${locked.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 font-medium text-xs border-b-2 transition-all cursor-pointer -mb-px ${
              activeTab === tab.key 
                ? "border-[var(--color-accent)] text-[var(--color-accent)] font-bold" 
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Badge Grid */}
      <AutoSkeleton isLoading={loading} type="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Render Earned Badges */}
          {(activeTab === "all" || activeTab === "earned") && earned.map(eb => (
            <div 
              key={eb.badge.id}
              className="card p-5 relative overflow-hidden group hover:shadow-xl hover:border-amber-500/30 transition-all duration-300 flex gap-4 bg-gradient-to-br from-[var(--color-card)] to-amber-500/5"
            >
              <div className="absolute top-2 right-2 text-amber-500 opacity-60 group-hover:scale-125 transition-transform duration-300">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-4xl shadow-lg shadow-amber-500/10 flex-shrink-0 relative">
                <span>{eb.badge.icon || "🏆"}</span>
                <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-0.5 border border-white">
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="font-bold text-sm text-[var(--color-text)] truncate">{eb.badge.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{eb.badge.description}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-muted)] pt-1">
                  <Calendar className="w-3 h-3 text-[var(--color-accent)]" />
                  <span>Unlocked on {new Date(eb.unlockedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                </div>
                {eb.metadata && typeof eb.metadata === "object" && (
                  <div className="text-[9px] bg-amber-500/10 text-amber-600 rounded px-1.5 py-0.5 mt-1 inline-block">
                    {eb.metadata.score && `Score: ${eb.metadata.score} pts`}
                    {eb.metadata.streak && `Streak: ${eb.metadata.streak} days`}
                  </div>
                )}
              </div>
            </div>
          ))}
          {/* Render Locked Badges */}
          {(activeTab === "all" || activeTab === "locked") && locked.map(b => (
            <div 
              key={b.id}
              className="card p-5 relative overflow-hidden bg-slate-900/10 border-slate-200/40 opacity-70 flex gap-4 hover:opacity-100 transition-opacity"
            >
              <div className="absolute top-2 right-2 text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-4xl grayscale filter flex-shrink-0 border border-slate-700 relative">
                <span>{b.icon || "🔒"}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <h3 className="font-semibold text-sm text-[var(--color-text)] truncate">{b.name}</h3>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{b.description}</p>
                <div className="flex items-center gap-1.5 text-[9px] text-[var(--color-text-muted)] font-medium pt-1">
                  <Zap className="w-3 h-3 text-slate-400" />
                  <span>Locked</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AutoSkeleton>
    </div>
  );
}
