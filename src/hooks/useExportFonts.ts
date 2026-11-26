"use client";

import { useEffect, useReducer } from "react";
import { DEFAULT_EXPORT_FONT, ExportFontMetrics } from "@/lib/subtitle-render-style";

// Shared by every preview on the page; a family is looked up once per page load
const known = new Map<string, ExportFontMetrics>();
const requested = new Set<string>();
const listeners = new Set<() => void>();

/**
 * For each font name (as handed to libass, see assFontName), the font the
 * server will really draw it with and its size ratio. Until the server answers,
 * assumes Noto Sans, the export default.
 */
export function useExportFonts(names: string[]): Record<string, ExportFontMetrics> {
  const key = [...new Set(names.filter(Boolean))].sort().join(",");
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    listeners.add(rerender);
    return () => { listeners.delete(rerender); };
  }, []);

  useEffect(() => {
    const missing = key.split(",").filter(n => n && !known.has(n) && !requested.has(n));
    if (missing.length === 0) return;
    missing.forEach(n => requested.add(n));

    fetch(`/api/font-metrics?families=${encodeURIComponent(missing.join(","))}`)
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then((data: { fonts?: Record<string, ExportFontMetrics> } | null) => {
        for (const n of missing) known.set(n, data?.fonts?.[n] ?? DEFAULT_EXPORT_FONT);
        listeners.forEach(notify => notify());
      });
  }, [key]);

  return Object.fromEntries(key.split(",").map(n => [n, known.get(n) ?? DEFAULT_EXPORT_FONT]));
}
