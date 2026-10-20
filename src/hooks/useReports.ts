import { useCallback, useEffect, useState } from "react";
import { api, type ApiReportListItem } from "../api/client";
import { useRequestScope } from "./useRequestScope";

/**
 * Lista de reportes guardados del negocio, compartida entre la pestaña Reportes
 * y el widget de la vista de Datos. Los reportes nacen en el chat del asistente,
 * así que `refresh` también se llama cuando el chat avisa que guardó uno.
 */
export function useReports(idToken: string) {
  const scope = useRequestScope(idToken);
  const [reports, setReports] = useState<ApiReportListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  // Recarga la primera página (lo más nuevo); si el usuario había pedido más, vuelve al inicio.
  const refresh = useCallback(async () => {
    const task = scope.start("reports");
    try {
      const { reports: items, nextCursor: cursor } = await api.reports(idToken, undefined, task.signal);
      if (!task.isCurrent()) return;
      setReports(items);
      setNextCursor(cursor);
      setError(null);
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes");
    } finally {
      if (task.isCurrent()) setLoaded(true);
      task.finish();
    }
  }, [idToken, scope]);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    const task = scope.start("reports-more");
    setLoadingMore(true);
    try {
      const { reports: items, nextCursor: cursor } = await api.reports(idToken, nextCursor, task.signal);
      if (!task.isCurrent()) return;
      setReports((current) => {
        const known = new Set(current.map((r) => r.reportId));
        return [...current, ...items.filter((r) => !known.has(r.reportId))];
      });
      setNextCursor(cursor);
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : "No se pudieron cargar más reportes");
    } finally {
      if (task.isCurrent()) setLoadingMore(false);
      task.finish();
    }
  }, [idToken, nextCursor, scope]);

  const remove = useCallback(async (reportId: string) => {
    scope.cancel("reports");
    const task = scope.start("delete:" + reportId);
    try {
      await api.deleteReport(idToken, reportId, task.signal);
      if (task.isCurrent()) {
        scope.cancel("reports");
        setReports((current) => current.filter((r) => r.reportId !== reportId));
      }
    } finally {
      task.finish();
    }
  }, [idToken, scope]);

  return { reports, loaded, error, setError, refresh, remove, hasMore: nextCursor !== undefined, loadingMore, loadMore };
}
