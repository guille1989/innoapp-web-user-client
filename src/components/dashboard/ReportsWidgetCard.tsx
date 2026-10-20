import { useState } from "react";
import type { ApiReportListItem } from "../../api/client";
import { downloadStoredReportCsv, expiryLabel, openStoredReportPdf } from "../../lib/storedReports";
import { useRequestScope } from "../../hooks/useRequestScope";

interface ReportsWidgetCardProps {
  reports: ApiReportListItem[];
  idToken: string;
  businessName: string;
  onDelete: (reportId: string) => Promise<void>;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDragStart: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
}

/** Sin límite fijo de filas: el cuerpo scrollea si la tarjeta es chica (los reportes viven 30 días como mucho). */
export function ReportsWidgetCard({ reports, idToken, businessName, onDelete, hasMore, loadingMore, onLoadMore, onDragStart, onResizeStart }: ReportsWidgetCardProps) {
  const scope = useRequestScope(idToken);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(item: ApiReportListItem, action: (signal: AbortSignal) => Promise<void>) {
    const task = scope.start("report:" + item.reportId);
    setBusyId(item.reportId);
    setError(null);
    try {
      await action(task.signal);
    } catch (err) {
      if (task.isCurrent() && !(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "No se pudo abrir el reporte");
      }
    } finally {
      if (task.isCurrent()) setBusyId((current) => current === item.reportId ? null : current);
      task.finish();
    }
  }

  return (
    <article className="widget glass">
      <header className="widget-head" onPointerDown={onDragStart}>
        <div className="drag-dots"><i /><i /><i /></div>
        <div className="widget-label"><span className="widget-type-tag bar">Reportes</span><span>Reportes guardados</span></div>
        <span className="widget-count">{reports.length}</span>
      </header>
      <div className="widget-body reports-widget-body">
        {error && <div className="reports-error" role="alert">{error}</div>}
        {reports.map((item) => {
          const busy = busyId === item.reportId;
          return (
            <div className="reports-widget-row" key={item.reportId}>
              <div className="report-row-info">
                <strong>{item.title}</strong>
                <span>{new Date(item.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} · {expiryLabel(item.expiresAt)}</span>
              </div>
              <div className="report-row-actions">
                <button className="chip" disabled={busy} onClick={() => void run(item, (signal) => openStoredReportPdf(idToken, item, businessName, signal))}>PDF</button>
                <button className="chip" disabled={busy} onClick={() => void run(item, (signal) => downloadStoredReportCsv(idToken, item, signal))}>CSV</button>
                <button className="chip" disabled={busy} aria-label={`Borrar ${item.title}`} onClick={() => { if (window.confirm(`¿Borrar el reporte "${item.title}"?`)) void run(item, () => onDelete(item.reportId)); }}>Borrar</button>
              </div>
            </div>
          );
        })}
        {hasMore && <button className="chip" disabled={loadingMore} onClick={onLoadMore}>{loadingMore ? "Cargando…" : "Cargar más"}</button>}
      </div>
      <button className="resize-handle" onPointerDown={onResizeStart} aria-label="Redimensionar reportes"><span>⌟</span></button>
    </article>
  );
}
