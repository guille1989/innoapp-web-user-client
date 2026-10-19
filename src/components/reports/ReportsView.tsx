import { useCallback, useEffect, useState } from "react";
import { api, type ApiReportListItem } from "../../api/client";
import { downloadReportCsv, printReport } from "../../lib/report";

interface ReportsViewProps {
  active: boolean;
  idToken: string;
  businessName: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS));
}

export function ReportsView({ active, idToken, businessName }: ReportsViewProps) {
  const [reports, setReports] = useState<ApiReportListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { reports: items } = await api.reports(idToken);
      setReports(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes");
    }
  }, [idToken]);

  // Se recarga cada vez que se abre la pestaña: un reporte nuevo se genera desde el chat, no desde acá.
  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  async function openPdf(item: ApiReportListItem) {
    // La ventana se abre en el click: tras el await el navegador la bloquearía como popup.
    const w = window.open("", "_blank");
    setBusyId(item.reportId);
    try {
      const stored = await api.report(idToken, item.reportId);
      printReport(stored.report, stored.summary, businessName, w);
    } catch (err) {
      w?.close();
      setError(err instanceof Error ? err.message : "No se pudo abrir el reporte");
    } finally {
      setBusyId(null);
    }
  }

  async function downloadCsv(item: ApiReportListItem) {
    setBusyId(item.reportId);
    try {
      const stored = await api.report(idToken, item.reportId);
      downloadReportCsv(stored.report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el reporte");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: ApiReportListItem) {
    if (!window.confirm(`¿Borrar el reporte "${item.title}"?`)) return;
    setBusyId(item.reportId);
    try {
      await api.deleteReport(idToken, item.reportId);
      setReports((current) => current?.filter((r) => r.reportId !== item.reportId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo borrar el reporte");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className={`reports-view view${active ? " active" : ""}`}>
      <div className="reports-panel glass">
        <header className="reports-head">
          <div>
            <h2>Reportes</h2>
            <p>Los que genera el asistente quedan guardados 30 días y se borran solos. Pedile uno en el chat: "hazme un reporte de ventas de este mes".</p>
          </div>
          <button className="chip" onClick={() => void load()}>Actualizar</button>
        </header>
        {error && <div className="reports-error" role="alert">{error}</div>}
        {reports === null && !error && <div className="empty-state">Cargando reportes…</div>}
        {reports?.length === 0 && <div className="empty-state">Todavía no hay reportes guardados.</div>}
        {reports?.map((item) => {
          const busy = busyId === item.reportId;
          const left = daysLeft(item.expiresAt);
          return (
            <article className="report-row" key={item.reportId}>
              <div className="report-row-info">
                <strong>{item.title}</strong>
                <span>
                  {new Date(item.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  {" · "}
                  {left <= 1 ? "se borra hoy o mañana" : `se borra en ${left} días`}
                </span>
              </div>
              <div className="report-row-actions">
                <button className="chip" disabled={busy} onClick={() => void openPdf(item)}>Ver / guardar PDF</button>
                <button className="chip" disabled={busy} onClick={() => void downloadCsv(item)}>CSV</button>
                <button className="chip" disabled={busy} onClick={() => void remove(item)} aria-label={`Borrar ${item.title}`}>Borrar</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
