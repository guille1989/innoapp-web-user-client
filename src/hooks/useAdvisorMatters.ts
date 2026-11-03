import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, type ApiMatter } from "../api/client";
import { applyMark, countUnseen, sortMatters } from "../lib/matters";
import { useRequestScope } from "./useRequestScope";

// El endpoint lee solo DynamoDB (no Athena), así que consultarlo seguido es barato; aun así no hace falta más a menudo.
const REFRESH_MS = 5 * 60_000;
const MIN_GAP_MS = 30_000;
const DAYS = 14;

/**
 * Avisos del asesor del negocio (Innova): lo no visto y lo visto de las últimas dos semanas.
 * Es un extra: si el backend todavía no tiene el endpoint o falla, simplemente no hay avisos
 * y el dashboard sigue igual, sin mostrar un error.
 */
export function useAdvisorMatters(idToken: string) {
  const scope = useRequestScope(idToken);
  const [matters, setMatters] = useState<ApiMatter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const current = useRef<ApiMatter[]>([]);
  current.current = matters;
  const lastRefresh = useRef(0);

  const refresh = useCallback(async () => {
    lastRefresh.current = Date.now();
    const task = scope.start("advisor-matters");
    try {
      const { matters: items } = await api.advisorMatters(idToken, { status: ["new", "seen"], days: DAYS }, task.signal);
      if (task.isCurrent()) setMatters(items);
    } catch {
      // Sin avisos: ver el comentario del hook.
    } finally {
      if (task.isCurrent()) setLoaded(true);
      task.finish();
    }
  }, [idToken, scope]);

  useEffect(() => { void refresh(); }, [refresh]);

  // Al volver a la pestaña y cada 5 min mientras esté a la vista.
  useEffect(() => {
    const tick = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRefresh.current > MIN_GAP_MS) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearInterval(tick); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  /** Visto o descartado: se refleja al instante y, si el servidor lo rechaza, se vuelve atrás. */
  const mark = useCallback(async (id: string, status: "seen" | "dismissed") => {
    const before = current.current;
    scope.cancel("advisor-matters"); // una lectura en vuelo traería el estado viejo y lo pisaría
    setMatters(applyMark(before, id, status));
    try {
      await api.markAdvisorMatter(idToken, id, status);
    } catch {
      setMatters(before);
      void refresh();
    }
  }, [idToken, scope, refresh]);

  const sorted = useMemo(() => sortMatters(matters), [matters]);
  return { matters: sorted, newCount: countUnseen(matters), loaded, refresh, mark };
}
