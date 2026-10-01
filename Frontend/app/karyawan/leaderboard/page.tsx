"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { apiClient } from "../../../lib/api/client";
import { Trophy, Medal } from "lucide-react";
import { PageHeader, PeriodSwitcher, AutoSkeleton } from "../../../components/ui";

interface RankingItem {
  rank: number;
  userId: string;
  name: string;
  sawScore: number;
  totalSessions: number;
  avgScore: number;
  isMe: boolean;
}

interface MyPosition {
  rank: number;
  sawScore: number;
  totalSessions: number;
  sawBreakdown: {
    c1_avgScore: number;
    c2_outcomeRate: number;
    c3_improvementRate: number;
    c4_completionRate: number;
    c5_deadlineRate: number;
  } | null;
}

interface LeaderboardData {
  rankings: RankingItem[];
  myPosition: MyPosition | null;
}

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const PERIOD_OPTIONS = [
  { key: "daily",   label: "Daily"    },
  { key: "weekly",  label: "Weekly"   },
  { key: "monthly", label: "Monthly"  },
  { key: "alltime", label: "All-Time" },
];

const RANK_COLOR: Record<number, string> = {
  1: "text-[var(--color-text)]",
  2: "text-[var(--color-text-secondary)]",
  3: "text-[var(--color-text-muted)]",
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [scope, setScope] = useState<"company" | "team">("company");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "alltime">("monthly");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.get(`/leaderboard?period=${period}&scope=${scope}`)
      .then(res => {
        if (res?.data) setData(res.data);
      })
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [period, scope]);

  const rankings    = data?.rankings    || [];
  const myPosition  = data?.myPosition  || null;

  const top1 = rankings.find(r => r.rank === 1);
  const top2 = rankings.find(r => r.rank === 2);
  const top3 = rankings.find(r => r.rank === 3);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">

      {/* Page Header + Period Switcher */}
      <PageHeader
        title="My Ranking"
        subtitle="See where you stand against other sales reps using the SAW algorithm."
        // icon={<Medal className="w-4 h-4" />}
        actions={
          <div className="flex gap-2">
            <PeriodSwitcher
              options={[
                { key: "company", label: "My Company" },
                { key: "team", label: "My Team" },
              ]}
              value={scope}
              onChange={(k) => setScope(k as typeof scope)}
            />
            <PeriodSwitcher
              options={PERIOD_OPTIONS}
              value={period}
              onChange={(k) => setPeriod(k as typeof period)}
            />
          </div>
        }
      />

      {error && (
        <div className="p-3 bg-[var(--color-danger-light)]/20 border border-[var(--color-danger)]/30 rounded-xl text-sm text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {/* Podium (Top 3) */}
      {rankings.length > 0 && (
        <div className="flex flex-col items-center py-4">
          <div className="flex items-end justify-center w-full max-w-xl gap-2 md:gap-4 h-60 px-4">

            {/* Rank 2 - Left */}
            <div className="flex flex-col items-center flex-1">
              {top2 ? (
                <>
                  <div className="w-11 h-11 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-border-strong)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] mb-2 relative">
                    {getInitials(top2.name)}
                    {top2.isMe && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-accent)] text-white px-1 rounded-full text-[9px] font-bold">You</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-center truncate max-w-full text-[var(--color-text)]">{top2.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium mb-2">{(top2.sawScore * 100).toFixed(0)}%</p>
                </>
              ) : (
                <div className="h-10" />
              )}
              <div className="w-full bg-[var(--color-accent-light)]/40 border-t border-[var(--color-accent-light)] rounded-t-xl h-20 flex items-center justify-center shadow-sm">
                <span className="text-2xl font-black text-[var(--color-accent)]/50">2</span>
              </div>
            </div>

            {/* Rank 1 - Centre (tallest) */}
            <div className="flex flex-col items-center flex-1">
              {top1 ? (
                <>
                  <Trophy className="w-5 h-5 text-[var(--color-accent)] mb-1" />
                  <div className="w-14 h-14 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-accent)] flex items-center justify-center text-sm font-bold text-white mb-2 relative shadow-md shadow-[var(--color-accent)]/20">
                    {getInitials(top1.name)}
                    {top1.isMe && (
                      <span className="absolute -top-1.5 -right-1.5 bg-white text-[var(--color-accent)] px-1 rounded-full text-[9px] font-bold border border-[var(--color-accent)]">You</span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-center truncate max-w-full text-[var(--color-accent)]">{top1.name}</p>
                  <p className="text-xs font-black text-[var(--color-accent)] mb-3">{(top1.sawScore * 100).toFixed(0)}%</p>
                </>
              ) : (
                <div className="h-10" />
              )}
              <div className="w-full bg-[var(--color-accent)] rounded-t-2xl h-28 flex items-center justify-center shadow-lg shadow-[var(--color-accent)]/20">
                <span className="text-4xl font-black text-white">1</span>
              </div>
            </div>

            {/* Rank 3 - Right */}
            <div className="flex flex-col items-center flex-1">
              {top3 ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface)] border-2 border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-text-muted)] mb-2 relative">
                    {getInitials(top3.name)}
                    {top3.isMe && (
                      <span className="absolute -top-1.5 -right-1.5 bg-[var(--color-accent)] text-white px-1 rounded-full text-[9px] font-bold">You</span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-center truncate max-w-full text-[var(--color-text)]">{top3.name}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)] font-medium mb-2">{(top3.sawScore * 100).toFixed(0)}%</p>
                </>
              ) : (
                <div className="h-10" />
              )}
              <div className="w-full bg-[var(--color-surface)] border-t border-[var(--color-border)] rounded-t-xl h-14 flex items-center justify-center">
                <span className="text-lg font-black text-[var(--color-text-muted)]">3</span>
              </div>
            </div>

          </div>
        </div>
      )}



      {/* Your Performance Breakdown */}
      {myPosition && myPosition.sawBreakdown && (
        <div className="card p-4 space-y-3 bg-gradient-to-br from-[var(--color-card)] to-[var(--color-accent-light)]/5 border-l-4 border-[var(--color-accent)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-sm text-[var(--color-text)]">Your Performance Breakdown</h2>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Calculated using Simple Additive Weighting (SAW) metrics</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-[var(--color-text-muted)] block">Your Rank</span>
              <span className="text-xl font-black text-[var(--color-accent)]">#{myPosition.rank}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "C1: Avg Score",    value: myPosition.sawBreakdown.c1_avgScore },
              { label: "C2: Win Rate",     value: myPosition.sawBreakdown.c2_outcomeRate },
              { label: "C3: Improvement",  value: myPosition.sawBreakdown.c3_improvementRate },
              { label: "C4: Completion",   value: myPosition.sawBreakdown.c4_completionRate },
              { label: "C5: Deadline",     value: myPosition.sawBreakdown.c5_deadlineRate },
            ].map((m) => (
              <div key={m.label} className="p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                <p className="text-[9px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">{m.label}</p>
                <p className="text-sm font-black text-[var(--color-text)] mt-0.5">{m.value.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Ranking Table */}
      <AutoSkeleton isLoading={loading} type="table">
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="font-semibold text-sm">Full Ranking List</h2>
          <span className="text-xs text-[var(--color-text-muted)]">{rankings.length} Active Representatives</span>
        </div>

        {rankings.length === 0 ? (
          <div className="p-8 text-center text-xs text-[var(--color-text-muted)]">
            No rankings available for this period.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th className="text-right">Sessions</th>
                  <th className="text-right">Avg Score</th>
                  <th className="text-right">SAW Score</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr
                    key={r.userId}
                    className={r.isMe ? "bg-[var(--color-accent-light)]" : undefined}
                  >
                    {/* Rank */}
                    <td>
                      <span className={`font-black text-xs ${RANK_COLOR[r.rank] ?? "text-[var(--color-text-muted)]"}`}>
                        #{r.rank}
                      </span>
                    </td>

                    {/* Name */}
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] flex-shrink-0 ${
                          r.isMe
                            ? "bg-[var(--color-accent)] text-white"
                            : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                        }`}>
                          {getInitials(r.name)}
                        </div>
                        <span className={`text-xs ${r.isMe ? "font-bold text-[var(--color-text)]" : "font-medium text-[var(--color-text)]"}`}>
                          {r.name}
                        </span>
                        {r.isMe && (
                          <span className="badge" style={{ fontSize: "9px", padding: "1px 5px" }}>You</span>
                        )}
                      </div>
                    </td>

                    {/* Sessions */}
                    <td className="text-right text-xs text-[var(--color-text-muted)]">
                      {r.totalSessions}
                    </td>

                    {/* Avg Score */}
                    <td className="text-right text-xs text-[var(--color-text-muted)]">
                      {r.avgScore}
                    </td>

                    {/* SAW Score */}
                    <td className="text-right">
                      <span className="text-xs font-black text-[var(--color-text)]">
                        {(r.sawScore * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </AutoSkeleton>

    </div>
  );
}
