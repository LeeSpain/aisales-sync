import { useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light" | "brand";

const STORAGE_KEY = "ais-theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "brand") return stored;
  return "dark";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  // Apply theme class to <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "brand");

    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else if (theme === "brand") {
      // Brand theme is dark-based but with primary-tinted surfaces
      root.classList.add("dark", "brand");
      root.style.colorScheme = "dark";
    } else {
      root.style.colorScheme = "light";
    }

    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : prev === "light" ? "brand" : "dark")),
    []
  );

  return { theme, setTheme, toggle };
}
