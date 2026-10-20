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

  const refresh = useCallback(async () => {
    const task = scope.start("reports");
    try {
      const { reports: items } = await api.reports(idToken, task.signal);
      if (!task.isCurrent()) return;
      setReports(items);
      setError(null);
    } catch (err) {
      if (task.isCurrent()) setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes");
    } finally {
      if (task.isCurrent()) setLoaded(true);
      task.finish();
    }
  }, [idToken, scope]);

  useEffect(() => { void refresh(); }, [refresh]);

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

  return { reports, loaded, error, setError, refresh, remove };
}
