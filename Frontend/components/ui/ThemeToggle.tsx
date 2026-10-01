"use client";

import * as React from "react";
import { Moon, Sun, Zap } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Menghindari hydration mismatch warning pada rendering pertama
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="w-8 h-8" />;

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("cyberpunk");
    else setTheme("light");
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full hover:bg-[var(--color-bg)] transition-colors border border-transparent hover:border-[var(--color-border)] flex items-center justify-center relative"
      title={`Current theme: ${theme}. Click to switch.`}
    >
      {theme === "light" && <Sun className="h-[1.2rem] w-[1.2rem] text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />}
      {theme === "dark" && <Moon className="h-[1.2rem] w-[1.2rem] text-[var(--color-text-muted)] hover:text-[var(--color-text)]" />}
      {theme === "cyberpunk" && <Zap className="h-[1.2rem] w-[1.2rem] text-pink-500 animate-pulse" />}
      <span className="sr-only">Toggle theme</span>
    </button>
  );
}