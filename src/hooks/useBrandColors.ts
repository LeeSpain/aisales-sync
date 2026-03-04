import { useState, useEffect, useCallback } from "react";

export interface BrandColors {
  primary: string;    // hex
  accent: string;     // hex
  success: string;    // hex
  warning: string;    // hex
}

const STORAGE_KEY = "ais-brand-colors";

const DEFAULTS: BrandColors = {
  primary: "#6366f1",  // hsl(239 84% 67%)
  accent: "#67e8f9",   // hsl(187 92% 69%)
  success: "#10b981",  // hsl(160 84% 39%)
  warning: "#f59e0b",  // hsl(38 92% 50%)
};

function hexToHSL(hex: string): string {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getInitial(): BrandColors {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

function applyToDOM(colors: BrandColors) {
  const root = document.documentElement;
  root.style.setProperty("--primary", hexToHSL(colors.primary));
  root.style.setProperty("--primary-light", hexToHSL(colors.primary)); // simplified
  root.style.setProperty("--primary-dark", hexToHSL(colors.primary));
  root.style.setProperty("--ring", hexToHSL(colors.primary));
  root.style.setProperty("--sidebar-primary", hexToHSL(colors.primary));
  root.style.setProperty("--sidebar-ring", hexToHSL(colors.primary));
  root.style.setProperty("--accent", hexToHSL(colors.accent));
  root.style.setProperty("--success", hexToHSL(colors.success));
  root.style.setProperty("--warning", hexToHSL(colors.warning));
}

export function useBrandColors() {
  const [colors, setColorsState] = useState<BrandColors>(getInitial);

  useEffect(() => {
    applyToDOM(colors);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
  }, [colors]);

  const setColors = useCallback((c: Partial<BrandColors>) => {
    setColorsState((prev) => ({ ...prev, ...c }));
  }, []);

  const reset = useCallback(() => {
    setColorsState(DEFAULTS);
  }, []);

  return { colors, setColors, reset, defaults: DEFAULTS };
}
