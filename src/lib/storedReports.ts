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
export async function openStoredReportPdf(idToken: string, item: ApiReportListItem, businessName: string) {
  const w = window.open("", "_blank");
  try {
    const stored = await api.report(idToken, item.reportId);
    printReport(stored.report, stored.summary, businessName, w);
  } catch (err) {
    w?.close();
    throw err;
  }
}

export async function downloadStoredReportCsv(idToken: string, item: ApiReportListItem) {
  const stored = await api.report(idToken, item.reportId);
  downloadReportCsv(stored.report);
}
