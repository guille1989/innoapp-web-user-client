import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * Tamaño del texto dentro de los widgets de la vista de Datos. Es una
 * preferencia de quien mira (vive en localStorage, como el layout) y no cambia
 * el resto de la app. El CSS lo recibe como `--wfs` en `.canvas-widgets`; los
 * gráficos que miden en píxeles (filas, márgenes de ejes) lo leen con
 * `useWidgetFontScale()` para que la geometría crezca junto con la letra.
 *
 * El mismo nivel escala el texto del asistente IA: se publica como `--afs` en
 * <html> (el asistente vive fuera del canvas). Por eso el nivel es un store
 * compartido: el selector del dashboard y el del panel del asistente quedan
 * sincronizados.
 */
export type FontSizeLevel = "normal" | "large" | "xlarge";

export const FONT_LEVELS: FontSizeLevel[] = ["normal", "large", "xlarge"];
export const FONT_SCALES: Record<FontSizeLevel, number> = { normal: 1, large: 1.25, xlarge: 1.5 };
export const FONT_LEVEL_LABELS: Record<FontSizeLevel, string> = { normal: "Normal", large: "Grande", xlarge: "Muy grande" };

const STORAGE_KEY = "innoapp.widget-font-size.v1";

export function loadFontLevel(): FontSizeLevel {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return FONT_LEVELS.includes(saved as FontSizeLevel) ? (saved as FontSizeLevel) : "normal";
  } catch {
    return "normal";
  }
}

export function saveFontLevel(level: FontSizeLevel) {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Sin storage (modo privado, cuota): vuelve a "Normal" al recargar.
  }
}

let currentLevel = loadFontLevel();
const listeners = new Set<() => void>();

function publish(level: FontSizeLevel) {
  document.documentElement.style.setProperty("--afs", String(FONT_SCALES[level]));
}
publish(currentLevel);

function setFontLevel(level: FontSizeLevel) {
  if (level === currentLevel) return;
  currentLevel = level;
  saveFontLevel(level);
  publish(level);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useFontLevel() {
  const level = useSyncExternalStore(subscribe, () => currentLevel);
  return [level, setFontLevel] as const;
}

const WidgetFontScaleContext = createContext(1);
export const WidgetFontScaleProvider = WidgetFontScaleContext.Provider;
export const useWidgetFontScale = () => useContext(WidgetFontScaleContext);
