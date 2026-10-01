"use client";

import { useState } from "react";
import { FastForward } from "lucide-react";

export interface TimelineMoment {
  turn: number;
  salesSnippet: string;
  customerSnippet: string;
  trustLevel: number;
  trustDelta?: number;
  mood?: string;
  stage?: string;
  type: "breakthrough" | "friction" | "objection" | "neutral";
  badgeLabel: string;
  annotation: string;
  fillerCountInTurn: number;
}

export function SessionTimelineReplay({ timelineMoments }: { timelineMoments: TimelineMoment[] }) {
  const [selectedTimelineTurn, setSelectedTimelineTurn] = useState(timelineMoments[0]?.turn ?? 1);
  const activeMoment = timelineMoments.find((m) => m.turn === selectedTimelineTurn) || timelineMoments[0];

  if (!timelineMoments.length) return null;

  return (
    <div className="card overflow-hidden">
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-light)] flex items-center justify-center">
            <FastForward className="w-4 h-4 text-[var(--color-accent)]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Putar ulang sesi</h3>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Klik setiap turn untuk menganalisis momen kunci, lonjakan trust, dan keberatan
            </p>
          </div>
        </div>
        <span className="text-xs font-bold px-2 py-1 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] text-[var(--color-accent)]">
              {timelineMoments.length} momen
        </span>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          {timelineMoments.map((tm) => (
            <button
              key={tm.turn}
              onClick={() => setSelectedTimelineTurn(tm.turn)}
              aria-pressed={selectedTimelineTurn === tm.turn}
              aria-label={`Turn ${tm.turn}: ${tm.badgeLabel}`}
              className={`flex flex-col items-center p-2 rounded-xl border transition-all flex-shrink-0 min-w-[76px] ${
                selectedTimelineTurn === tm.turn
                  ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] shadow-sm scale-105"
                  : "bg-[var(--color-bg)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
              }`}
            >
              <span className="text-[10px] font-bold text-[var(--color-text-muted)]">Turn {tm.turn}</span>
              <span
                className={`text-xs my-0.5 ${
                  tm.type === "breakthrough"
                    ? "text-[var(--color-success)] font-black"
                    : tm.type === "friction"
                      ? "text-[var(--color-danger)] font-black"
                      : tm.type === "objection"
                        ? "text-[var(--color-warning)] font-black"
                        : "text-[var(--color-text-muted)]"
                }`}
              >
                {tm.type === "breakthrough"
                  ? "Trust naik"
                  : tm.type === "friction"
                    ? "Trust turun"
                    : tm.type === "objection"
                      ? "Keberatan"
                      : "Stabil"}
              </span>
              <span className="text-[9px] text-[var(--color-text-subtle)]">{tm.trustLevel}/5</span>
            </button>
          ))}
        </div>

        {activeMoment && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-[var(--color-surface)] px-2.5 py-1 rounded-lg border border-[var(--color-border)]">
                  Turn {activeMoment.turn}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                    activeMoment.type === "breakthrough"
                      ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                      : activeMoment.type === "friction"
                        ? "bg-[var(--color-danger)]/15 text-[var(--color-danger)]"
                        : activeMoment.type === "objection"
                          ? "bg-[var(--color-warning)]/15 text-[var(--color-warning)]"
                          : "bg-[var(--color-surface)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {activeMoment.badgeLabel}
                </span>
              </div>
              <div className="text-xs font-bold text-[var(--color-text-muted)]">
                Trust: <span className="text-[var(--color-text)]">{activeMoment.trustLevel} / 5.0</span>
                {activeMoment.trustDelta
                  ? ` (${activeMoment.trustDelta > 0 ? "+" : ""}${activeMoment.trustDelta})`
                  : ""}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]">
                <p className="font-bold text-[var(--color-accent)] mb-1 uppercase text-[9px]">Ucapan sales</p>
                <p className="text-[var(--color-text)] leading-relaxed italic">&ldquo;{activeMoment.salesSnippet}&rdquo;</p>
                {activeMoment.fillerCountInTurn > 0 && (
                  <p className="text-[10px] text-[var(--color-warning)] mt-1.5 font-medium">
                    {activeMoment.fillerCountInTurn} kata pengisi terdeteksi di turn ini.
                  </p>
                )}
              </div>

              <div className="bg-[var(--color-surface)] p-3 rounded-lg border border-[var(--color-border)]">
                <p className="font-bold text-[var(--color-text-muted)] mb-1 uppercase text-[9px]">Respons prospek</p>
                <p className="text-[var(--color-text)] leading-relaxed italic">&ldquo;{activeMoment.customerSnippet}&rdquo;</p>
              </div>
            </div>

            <div className="bg-[var(--color-surface)]/60 p-2.5 rounded-lg border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
              <span>
                <strong>Catatan pelatih:</strong> {activeMoment.annotation}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
