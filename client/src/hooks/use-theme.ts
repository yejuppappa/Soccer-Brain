import { useState, useEffect, useCallback } from "react";

export type ThemeMode = "dark" | "light" | "system";
const THEME_KEY = "soccerbrain_theme";

function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {}
  return "dark"; // default
}

function applyTheme(mode: ThemeMode) {
  const isDark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);

  // Apply on mount and when mode changes
  useEffect(() => {
    applyTheme(mode);
    localStorage.setItem(THEME_KEY, mode);
  }, [mode]);

  // Listen to system preference changes when in "system" mode
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setTheme = useCallback((next: ThemeMode) => setMode(next), []);

  const isDark =
    mode === "dark" ||
    (mode === "system" && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return { mode, setTheme, isDark };
}

// Apply theme immediately on script load (before React hydration) to prevent flash
(function initTheme() {
  if (typeof window === "undefined") return;
  const stored = getStoredTheme();
  applyTheme(stored);
})();
