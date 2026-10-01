"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

// Komponen internal untuk menangani pembersihan mutasi DOM & Sinkronisasi
function ThemeWatcher({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Pastikan manipulasi DOM hanya berjalan setelah komponen menempel di browser
  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || !theme) return;

    const root = document.documentElement;

    // 1. Bersihkan inline style dari Custom Lab jika beralih ke tema resmi
    if (theme !== "theme-custom") {
      root.style.removeProperty("--custom-bg");
      root.style.removeProperty("--custom-surface");
      root.style.removeProperty("--custom-accent");
      root.style.removeProperty("--custom-text");
      root.style.removeProperty("--custom-border");
    } else {
      // Jika beralih ke custom, panggil kembali dari memori lokal
      const savedCustom = localStorage.getItem("custom-theme-variables");
      if (savedCustom) {
        try {
          const colors = JSON.parse(savedCustom);
          root.style.setProperty("--custom-bg", colors.bg);
          root.style.setProperty("--custom-surface", colors.surface);
          root.style.setProperty("--custom-accent", colors.accent);
          root.style.setProperty("--custom-text", colors.text);
          root.style.setProperty("--custom-border", colors.border);
        } catch {}
      }
    }

    // 2. FORCE CLEANUP: Hapus sisa-sisa class tema lama agar tidak duplikat
    const allRegisteredThemes = [
      "light", "dark", "cyberpunk", "forest", "maxy", "teal-neon", "dracula", "nordic",
      "mongo-leaf", "gpt-slate", "claude-anthracite", "cerebras-coral", "notebook-calm", "wa-emerald", "tele-night", "insta-twilight",
      "theme-custom"
    ];
    
    allRegisteredThemes.forEach((t) => {
      if (t !== theme) {
        root.classList.remove(t);
      }
    });

    // Pastikan class yang aktif menempel sempurna
    root.classList.add(theme);

  }, [theme, mounted]);

  return <>{children}</>;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      themes={[
        "light", "dark", "cyberpunk", "forest", "maxy", "teal-neon", "dracula", "nordic",
        "mongo-leaf", "gpt-slate", "claude-anthracite", "cerebras-coral", "notebook-calm", "wa-emerald", "tele-night", "insta-twilight",
        "theme-custom"
      ]}
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange={false}
      {...props}
    >
      <ThemeWatcher>{children}</ThemeWatcher>
    </NextThemesProvider>
  );
}