import { api, type ApiReportListItem } from "../api/client";
import { downloadReportCsv, printReport } from "./report";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS));
}

export function expiryLabel(expiresAt: string): string {
  const left = daysLeft(expiresAt);
  return left <= 1 ? "se borra hoy o mañana" : `se borra en ${left} días`;
}

/** Se llama directo desde el click: la ventana se abre antes del await porque los navegadores bloquean window.open después. */
export async function openStoredReportPdf(idToken: string, item: ApiReportListItem, businessName: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const w = window.open("", "_blank");
  let closed = false;
  const close = () => {
    if (!closed) w?.close();
    closed = true;
  };
  signal?.addEventListener("abort", close, { once: true });
  try {
    const stored = await api.report(idToken, item.reportId, signal);
    // Some transports can resolve just as cancellation happens. Never render
    // another account's response after its authenticated tree was disposed.
    signal?.throwIfAborted();
    printReport(stored.report, stored.summary, businessName, w);
  } catch (err) {
    close();
    throw err;
  } finally {
    signal?.removeEventListener("abort", close);
  }
}

export async function downloadStoredReportCsv(idToken: string, item: ApiReportListItem, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const stored = await api.report(idToken, item.reportId, signal);
  signal?.throwIfAborted();
  downloadReportCsv(stored.report);
}
