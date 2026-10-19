import { useCallback, useEffect, useState } from "react";
import { api, type ApiReportListItem } from "../api/client";

/**
 * Lista de reportes guardados del negocio, compartida entre la pestaña Reportes
 * y el widget de la vista de Datos. Los reportes nacen en el chat del asistente,
 * así que `refresh` también se llama cuando el chat avisa que guardó uno.
 */
export function useReports(idToken: string) {
  const [reports, setReports] = useState<ApiReportListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { reports: items } = await api.reports(idToken);
      setReports(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes");
    } finally {
      setLoaded(true);
    }
  }, [idToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const remove = useCallback(async (reportId: string) => {
    await api.deleteReport(idToken, reportId);
    setReports((current) => current.filter((r) => r.reportId !== reportId));
  }, [idToken]);

  return { reports, loaded, error, setError, refresh, remove };
}
