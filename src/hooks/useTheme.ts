import { useSyncExternalStore, useCallback } from "react";

export type Theme = "dark" | "light" | "brand";

const STORAGE_KEY = "ais-theme";

// ─── Shared singleton store ───
// All useTheme() instances read/write the SAME value.
// This prevents AppLayout's stale "dark" state from overriding
// a theme change made in Settings.

let currentTheme: Theme = (() => {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "brand") return stored;
  return "dark";
})();

const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): Theme {
  return currentTheme;
}

function applyTheme(t: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "brand");

  if (t === "dark") {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else if (t === "brand") {
    root.classList.add("dark", "brand");
    root.style.colorScheme = "dark";
  } else {
    root.style.colorScheme = "light";
  }

  localStorage.setItem(STORAGE_KEY, t);
}

function setThemeGlobal(t: Theme) {
  if (t === currentTheme) return;
  currentTheme = t;
  applyTheme(t);
  listeners.forEach((cb) => cb());
}

// Apply once on load
if (typeof window !== "undefined") {
  applyTheme(currentTheme);
}

// ─── Hook ───
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "dark" as Theme);

  const setTheme = useCallback((t: Theme) => setThemeGlobal(t), []);
  const toggle = useCallback(
    () => setThemeGlobal(currentTheme === "dark" ? "light" : currentTheme === "light" ? "brand" : "dark"),
    []
  );

  return { theme, setTheme, toggle };
}
