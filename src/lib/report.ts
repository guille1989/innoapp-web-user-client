import type { ApiReport } from "../api/client";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n: number) => n.toLocaleString("es-CO", { maximumFractionDigits: 2 });

function slug(title: string) {
  return title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reporte";
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function reportToCsv(report: ApiReport): string {
  const lines: string[] = [csvCell(report.title), csvCell(`Generado ${new Date(report.generatedAt).toLocaleString("es-CO")}`), ""];
  for (const section of report.sections) {
    lines.push(csvCell(section.heading));
    lines.push([csvCell(section.groupBy ?? "Concepto"), csvCell(`${section.aggregation}(${section.field})`)].join(";"));
    for (const row of section.data) lines.push([csvCell(row.label ?? "Total"), csvCell(row.value)].join(";"));
    lines.push("");
  }
  // BOM para que Excel abra bien las tildes.
  return "﻿" + lines.join("\r\n");
}

export function downloadReportCsv(report: ApiReport) {
  const url = URL.createObjectURL(new Blob([reportToCsv(report)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(report.title)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function reportToHtml(report: ApiReport): string {
  const sections = report.sections
    .map((s) => {
      const rows = s.data.map((r) => `<tr><td>${esc(r.label ?? "Total")}</td><td class="n">${fmt(r.value)}</td></tr>`).join("");
      return `<h2>${esc(s.heading)}</h2><table><thead><tr><th>${esc(s.groupBy ?? "Concepto")}</th><th class="n">${esc(s.aggregation)} · ${esc(s.field)}</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
body{font:14px system-ui,sans-serif;margin:32px;color:#111}h1{margin:0 0 4px}.meta{color:#666;margin-bottom:24px}
table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}.n{text-align:right}
@media print{body{margin:0}}</style></head><body><h1>${esc(report.title)}</h1><div class="meta">Generado ${esc(new Date(report.generatedAt).toLocaleString("es-CO"))}</div>${sections}</body></html>`;
}

/** Abre el reporte en otra pestaña listo para imprimir / "Guardar como PDF". */
export function printReport(report: ApiReport) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(reportToHtml(report));
  w.document.close();
  w.focus();
  w.print();
}
