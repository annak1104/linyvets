"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="focus-ring inline-flex h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
      onClick={toggleTheme}
      aria-label={isDark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      aria-pressed={isDark}
      title={isDark ? "Світла тема" : "Темна тема"}
    >
      {isDark ? <Sun className="size-4 text-primary" aria-hidden="true" /> : <Moon className="size-4 text-primary-hover" aria-hidden="true" />}
      <span className="hidden sm:inline">{isDark ? "Світла" : "Темна"}</span>
    </button>
  );
}
