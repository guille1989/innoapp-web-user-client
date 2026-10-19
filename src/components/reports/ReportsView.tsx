import { useEffect, useState } from "react";
import type { ApiReportListItem } from "../../api/client";
import { downloadStoredReportCsv, expiryLabel, openStoredReportPdf } from "../../lib/storedReports";

interface ReportsViewProps {
  active: boolean;
  idToken: string;
  businessName: string;
  reports: ApiReportListItem[];
  loaded: boolean;
  error: string | null;
  onError: (message: string | null) => void;
  onRefresh: () => Promise<void>;
  onDelete: (reportId: string) => Promise<void>;
}

export function ReportsView({ active, idToken, businessName, reports, loaded, error, onError, onRefresh, onDelete }: ReportsViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  // Se recarga cada vez que se abre la pestaña: un reporte nuevo se genera desde el chat, no desde acá.
  useEffect(() => {
    if (active) void onRefresh();
  }, [active, onRefresh]);

  async function run(item: ApiReportListItem, action: () => Promise<void>, failure: string) {
    setBusyId(item.reportId);
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : failure);
    } finally {
      setBusyId(null);
    }
  }

  function remove(item: ApiReportListItem) {
    if (!window.confirm(`¿Borrar el reporte "${item.title}"?`)) return;
    void run(item, () => onDelete(item.reportId), "No se pudo borrar el reporte");
  }

  return (
    <section className={`reports-view view${active ? " active" : ""}`}>
      <div className="reports-panel glass">
        <header className="reports-head">
          <div>
            <h2>Reportes</h2>
            <p>Los que genera el asistente quedan guardados 30 días y se borran solos. Pedile uno en el chat: "hazme un reporte de ventas de este mes".</p>
          </div>
          <button className="chip" onClick={() => void onRefresh()}>Actualizar</button>
        </header>
        {error && <div className="reports-error" role="alert">{error}</div>}
        {!loaded && !error && <div className="empty-state">Cargando reportes…</div>}
        {loaded && reports.length === 0 && <div className="empty-state">Todavía no hay reportes guardados.</div>}
        {reports.map((item) => {
          const busy = busyId === item.reportId;
          return (
            <article className="report-row" key={item.reportId}>
              <div className="report-row-info">
                <strong>{item.title}</strong>
                <span>{new Date(item.createdAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })} · {expiryLabel(item.expiresAt)}</span>
              </div>
              <div className="report-row-actions">
                <button className="chip" disabled={busy} onClick={() => void run(item, () => openStoredReportPdf(idToken, item, businessName), "No se pudo abrir el reporte")}>Ver / guardar PDF</button>
                <button className="chip" disabled={busy} onClick={() => void run(item, () => downloadStoredReportCsv(idToken, item), "No se pudo descargar el reporte")}>CSV</button>
                <button className="chip" disabled={busy} onClick={() => remove(item)} aria-label={`Borrar ${item.title}`}>Borrar</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
