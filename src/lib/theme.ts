import { useSyncExternalStore } from "react";

/**
 * Tema de la interfaz. La preferencia de quien mira vive en localStorage (como
 * el tamaño del texto) y puede ser "system": en ese caso se sigue el tema del
 * sistema operativo y se actualiza solo si cambia mientras la app está abierta.
 *
 * El tema resuelto se publica como `data-theme` en <html>; el CSS cambia solo
 * las variables de index.css. El mismo cálculo corre antes del primer render en
 * un script de index.html (evita el destello oscuro al cargar en light): si se
 * cambia la clave o los valores, hay que actualizar ambos sitios.
 */
export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_PREFERENCES: ThemePreference[] = ["system", "light", "dark"];
export const THEME_LABELS: Record<ThemePreference, string> = { system: "Sistema", light: "Claro", dark: "Oscuro" };

const STORAGE_KEY = "innoapp.theme.v1";
const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#0D1117", light: "#F4F6F9" };

export function loadThemePreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEME_PREFERENCES.includes(saved as ThemePreference) ? (saved as ThemePreference) : "system";
  } catch {
    return "system";
  }
}

function saveThemePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Sin storage (modo privado, cuota): vuelve a "Sistema" al recargar.
  }
}

const systemQuery = typeof window !== "undefined" && typeof window.matchMedia === "function"
  ? window.matchMedia("(prefers-color-scheme: light)")
  : null;

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return systemQuery?.matches ? "light" : "dark";
  return preference;
}

let currentPreference = loadThemePreference();
let currentTheme = resolveTheme(currentPreference);
const listeners = new Set<() => void>();

function publish(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}
publish(currentTheme);

function refresh() {
  const next = resolveTheme(currentPreference);
  if (next === currentTheme) return;
  currentTheme = next;
  publish(next);
  listeners.forEach((listener) => listener());
}

export function setThemePreference(preference: ThemePreference) {
  if (preference === currentPreference) return;
  currentPreference = preference;
  saveThemePreference(preference);
  refresh();
  listeners.forEach((listener) => listener());
}

systemQuery?.addEventListener("change", () => {
  if (currentPreference === "system") refresh();
});

/** Tema aplicado ahora mismo, para código fuera de React (Leaflet). */
export const getResolvedTheme = (): ResolvedTheme => currentTheme;

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** [preferencia elegida, tema aplicado, cambiar preferencia]. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, () => currentPreference);
  const theme = useSyncExternalStore(subscribe, () => currentTheme);
  return [preference, theme, setThemePreference] as const;
}

/** Solo el tema aplicado: para lo que no se pinta con CSS (tiles del mapa). */
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(subscribe, () => currentTheme);
}
