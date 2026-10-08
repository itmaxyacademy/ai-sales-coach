"use client";

import React from "react";
import Image from "next/image";
import { Check, Sparkles } from "lucide-react";

interface AvatarSelectorProps {
  value: "M" | "F" | string;
  onChange: (gender: "M" | "F") => void;
  language?: "id" | "en";
  className?: string;
}

export function AvatarSelector({
  value,
  onChange,
  language = "id",
  className = "",
}: AvatarSelectorProps) {
  const currentGender = (value || "M").toUpperCase() === "F" ? "F" : "M";

  const avatars = [
    {
      id: "M" as const,
      name: "Avatar Cowok",
      genderLabel: "Pria (Male)",
      modelFile: "m1.vrm",
      image: "/3d/avatar_cowok_m1.png",
      voice: language === "en" ? "en-US-GuyNeural (Guy)" : "id-ID-ArdiNeural (Ardi)",
      description: "Karakter pria profesional dengan setelan kemeja kerja, postur tegas, dan artikulasi vokal natural.",
      tag: "3D VRM Cowok",
    },
    {
      id: "F" as const,
      name: "Avatar Cewek",
      genderLabel: "Wanita (Female)",
      modelFile: "f1.vrm",
      image: "/3d/avatar_cewek_f1.png",
      voice: language === "en" ? "en-US-JennyNeural (Jenny)" : "id-ID-GadisNeural (Gadis)",
      description: "Karakter wanita profesional dengan blazer formal, ekspresi hangat responsif, dan artikulasi vokal natural.",
      tag: "3D VRM Cewek",
    },
  ];

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-bold text-[var(--color-text)]">
            Pilihan Avatar Roleplay 3D
          </label>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
            Pilih model 3D AI Simulator yang akan tampil di hadapan sales saat sesi latihan roleplay.
          </p>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 flex items-center gap-1 font-semibold">
          <Sparkles className="w-3 h-3" /> 2 Avatar Tersedia
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {avatars.map((av) => {
          const isSelected = currentGender === av.id;

          return (
            <div
              key={av.id}
              onClick={() => onChange(av.id)}
              className={`relative cursor-pointer rounded-2xl border-2 p-3.5 transition-all duration-200 select-none flex items-start gap-3.5 ${
                isSelected
                  ? "border-indigo-600 bg-indigo-600/5 ring-4 ring-indigo-500/15 shadow-md shadow-indigo-500/10"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-slate-500/40 hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {/* Checkmark Badge */}
              <div
                className={`absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                  isSelected
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "border border-[var(--color-border)] text-transparent"
                }`}
              >
                <Check className="w-3 h-3 stroke-[3]" />
              </div>

              {/* Avatar Preview Thumbnail */}
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 border border-white/10 shrink-0 shadow-inner flex items-center justify-center">
                <img
                  src={av.image}
                  alt={av.name}
                  className="w-full h-full object-cover object-top transition-transform duration-300 hover:scale-105"
                  onError={(e) => {
                    // Fallback visual emoji if thumbnail failed to render
                    const target = e.currentTarget;
                    target.style.display = "none";
                    if (target.parentElement) {
                      target.parentElement.innerHTML = `<span class="text-3xl">${av.id === "F" ? "👩" : "👨"}</span>`;
                    }
                  }}
                />
                <span className="absolute bottom-1 left-1 right-1 text-[9px] font-mono text-center bg-black/70 backdrop-blur-xs text-white/90 rounded py-0.5 px-1 truncate">
                  {av.modelFile}
                </span>
              </div>

              {/* Info text */}
              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-bold text-sm text-[var(--color-text)]">
                    {av.name}
                  </h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      av.id === "F"
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                    }`}
                  >
                    {av.genderLabel}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-relaxed">
                  {av.description}
                </p>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-text)]">Suara Neural:</span>
                  <span className="font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded truncate max-w-[170px]">
                    {av.voice}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
