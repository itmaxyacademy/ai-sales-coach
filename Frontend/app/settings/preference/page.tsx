"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { AVAILABLE_THEMES } from "../../../config/themes";
import { Check, Sliders, Palette, RefreshCw } from "lucide-react";

export default function PreferencePage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // State untuk kustomisasi warna mandiri
  const [customColors, setCustomColors] = useState({
    bg: "#1e1b4b",
    surface: "#312e81",
    accent: "#f43f5e",
    text: "#ffffff",
    border: "#4338ca"
  });

  useEffect(() => {
    setMounted(true);
    // Ambil data warna kustom lama jika tersimpan di komputer user
    const saved = localStorage.getItem("custom-theme-variables");
    if (saved) {
      try { setCustomColors(JSON.parse(saved)); } catch {}
    }
  }, []);

  if (!mounted) return <div className="p-6">Loading preferences...</div>;

  // Handler mengubah warna kustom real-time
  const handleCustomColorChange = (key: string, value: string) => {
    const updated = { ...customColors, [key]: value };
    setCustomColors(updated);
    
    // Simpan ke memori browser
    localStorage.setItem("custom-theme-variables", JSON.stringify(updated));

    // Jika user sedang memakai tema kustom, langsung suntikkan variabelnya ke CSS
    if (theme === "theme-custom") {
      const root = document.documentElement;
      root.style.setProperty(`--custom-${key}`, value);
    }
  };
// Cari fungsi ini di app/settings/preference/page.tsx kamu dan sesuaikan:

const activateCustomTheme = () => {
  const root = document.documentElement;
  
  // Suntik variabel kustom
  Object.entries(customColors).forEach(([key, val]) => {
    root.style.setProperty(`--custom-${key}`, val);
  });
  
  // Set tema utama ke custom
  setTheme("theme-custom");
};

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)] flex items-center gap-2">
          <Palette className="w-5 h-5 text-[var(--color-accent)]" />
          Appearance & Themes
        </h1>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Sesuaikan tampilan visual dashboard aplikasi Sales AI Coach sesuai kenyamanan kerja Anda.
        </p>
      </div>

      <hr className="border-[var(--color-border)]" />

      {/* SECTION 1: PRESET THEMES */}
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Official Application Presets</h2>
          <p className="text-[11px] text-[var(--color-text-muted)]">Pilih dari koleksi tema pilihan yang kami optimalkan.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_THEMES.map((preset) => {
            const Icon = preset.icon;
            const isActive = theme === preset.id;

            return (
              <div
                key={preset.id}
                onClick={() => setTheme(preset.id)}
                className={`card card-hover p-4 cursor-pointer flex flex-col justify-between relative transition-all ${
                  isActive ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)]">
                    <Icon className={`w-4 h-4 ${preset.iconClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-[var(--color-text)] flex items-center gap-2">
                      {preset.label}
                      {isActive && <span className="text-[9px] bg-[var(--color-accent-light)] text-[var(--color-accent)] px-1.5 py-0.5 rounded-full font-bold">Active</span>}
                    </h3>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 leading-relaxed">
                      {preset.description}
                    </p>
                  </div>
                </div>

                {/* Mini Visual Preview Palette */}
                <div className="flex gap-1.5 mt-4 pt-3 border-t border-[var(--color-border)]">
                  <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.previewColors.bg }} title="Background" />
                  <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.previewColors.surface }} title="Surface" />
                  <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.previewColors.accent }} title="Accent" />
                  <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.previewColors.text }} title="Text" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CUSTOM THEME BUILDER */}
      <div className="card p-5 bg-[var(--color-surface)] border-[var(--color-border)] space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--color-border)]">
          <Sliders className="w-4 h-4 text-pink-500" />
          <div>
            <h2 className="text-xs font-bold text-[var(--color-text)]">Custom Theme Lab (DIY)</h2>
            <p className="text-[10px] text-[var(--color-text-muted)]">Rakit palet warna identitas perusahaan Anda sendiri secara bebas.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Inputs */}
          <div className="space-y-3">
            {Object.entries(customColors).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <label className="text-xs font-medium capitalize text-[var(--color-text-secondary)]">
                  {key === "bg" ? "Main Canvas Background" : `${key} Color`}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleCustomColorChange(key, e.target.value)}
                    className="input text-xs font-mono max-w-[90px] py-1 text-center"
                  />
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => handleCustomColorChange(key, e.target.value)}
                    className="w-7 h-7 p-0 border-0 rounded cursor-pointer"
                  />
                </div>
              </div>
            ))}

            <button
              onClick={activateCustomTheme}
              className={`btn w-full text-xs mt-4 ${
                theme === "theme-custom" ? "btn-secondary border-[var(--color-accent)]" : "btn-primary"
              }`}
            >
              {theme === "theme-custom" ? "✓ Currently Using Custom Theme" : "Apply Custom Color Palette"}
            </button>
          </div>

          {/* Sandbox Live Mockup Preview Box */}
          <div 
            className="rounded-xl p-4 border flex flex-col justify-between transition-all"
            style={{ 
              backgroundColor: customColors.bg, 
              borderColor: customColors.border,
              color: customColors.text 
            }}
          >
            <div>
              <div className="flex items-center gap-1.5 opacity-70 text-[10px] uppercase font-bold tracking-wider">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: customColors.accent }} />
                Live Engine Simulator
              </div>
              <h4 className="text-sm font-bold mt-2" style={{ color: customColors.text }}>Workspace Title</h4>
              <p className="text-xs mt-1 opacity-70 leading-relaxed">
                Ini adalah visualisasi langsung bagaimana data text dan background Anda berkolaborasi di sistem nyata.
              </p>
              
              <div className="mt-4 p-2 rounded-lg border text-[11px]" style={{ backgroundColor: customColors.surface, borderColor: customColors.border }}>
                Elemen Kotak Dalam (Surface Card)
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <span className="px-2.5 py-1 text-[10px] font-semibold rounded-md text-white" style={{ backgroundColor: customColors.accent }}>
                Primary Action Button
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}