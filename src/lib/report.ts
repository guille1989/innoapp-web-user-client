import type { ApiReport, ApiReportSection } from "../api/client";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const MONEY_FIELDS = new Set(["total", "subtotal", "discount", "tip", "tax", "unitPrice"]);
const FIELD_LABELS: Record<string, string> = {
  total: "Ventas",
  subtotal: "Ventas por producto",
  discount: "Descuentos",
  tip: "Propinas",
  tax: "Impuestos",
  unitPrice: "Precio unitario",
  quantity: "Unidades",
  event_count: "Tickets",
};
const AGG_LABELS: Record<string, string> = { sum: "Suma", avg: "Promedio", max: "Máximo", min: "Mínimo", count: "Cantidad" };

function fmtValue(field: string, value: number): string {
  const isMoney = MONEY_FIELDS.has(field);
  const text = Math.abs(value).toLocaleString("es-CO", { maximumFractionDigits: isMoney ? 0 : 2 });
  return `${value < 0 ? "-" : ""}${isMoney ? "$" : ""}${text}`;
}

function fmtCompact(v: number, field: string): string {
  const prefix = MONEY_FIELDS.has(field) ? "$" : "";
  if (v >= 1_000_000) return `${prefix}${(v / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M`;
  if (v >= 1_000) return `${prefix}${(v / 1_000).toLocaleString("es-CO", { maximumFractionDigits: 0 })} mil`;
  return `${prefix}${v.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

function metricLabel(s: ApiReportSection): string {
  return `${AGG_LABELS[s.aggregation] ?? s.aggregation} · ${FIELD_LABELS[s.field] ?? s.field}`;
}

/** El chat usa texto plano: se quita el markdown que a veces mete el modelo. */
function plainText(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^\s*[-•]\s+/gm, "").trim();
}

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
    lines.push([csvCell(section.groupBy ?? "Concepto"), csvCell(metricLabel(section))].join(";"));
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

function kpiCard(s: ApiReportSection): string {
  const value = s.data[0]?.value ?? 0;
  let delta = "";
  if (s.previous !== undefined) {
    if (s.previous === 0) {
      delta = `<div class="delta flat">Sin base de comparación</div>`;
    } else {
      const pct = ((value - s.previous) / Math.abs(s.previous)) * 100;
      const cls = pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat";
      const arrow = pct > 0.05 ? "▲" : pct < -0.05 ? "▼" : "■";
      delta = `<div class="delta ${cls}">${arrow} ${Math.abs(pct).toLocaleString("es-CO", { maximumFractionDigits: 1 })} % vs periodo anterior</div>`;
    }
  }
  return `<div class="kpi"><div class="kpi-label">${esc(s.heading)}</div><div class="kpi-value">${esc(fmtValue(s.field, value))}</div>${delta}<div class="kpi-sub">${esc(metricLabel(s))}</div></div>`;
}

/** Barras verticales por día con rejilla; las etiquetas del eje X se reparten para no encimarse. */
function trendChart(s: ApiReportSection): string {
  const data = s.data;
  if (data.length === 0) return `<p class="empty">Sin datos en este periodo.</p>`;
  const W = 680, H = 220, L = 56, R = 8, T = 10, B = 28;
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / data.length;
  const barW = Math.max(2, Math.min(28, slot * 0.7));
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = T + plotH - plotH * f;
      return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="grid"/><text x="${L - 6}" y="${y + 3}" class="axis" text-anchor="end">${esc(fmtCompact(max * f, s.field))}</text>`;
    })
    .join("");
  const step = Math.ceil(data.length / 10);
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const bars = data
    .map((d, i) => {
      const h = (d.value / max) * plotH;
      const x = L + slot * i + (slot - barW) / 2;
      const label = i % step === 0 ? `<text x="${x + barW / 2}" y="${H - 8}" class="axis" text-anchor="middle">${esc((d.label ?? "").slice(5))}</text>` : "";
      return `<rect x="${x}" y="${T + plotH - h}" width="${barW}" height="${h}" rx="2" class="${i === peak ? "bar peak" : "bar"}"><title>${esc(d.label ?? "")}: ${esc(fmtValue(s.field, d.value))}</title></rect>${label}`;
    })
    .join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(s.heading)}">${grid}${bars}</svg><div class="note">El día más alto se resalta: ${esc(data[peak].label ?? "")} (${esc(fmtValue(s.field, data[peak].value))}).</div>`;
}

/** Top 8 con barras horizontales y el resto agrupado en "Otros". */
function rankingChart(s: ApiReportSection): string {
  const sorted = [...s.data].sort((a, b) => b.value - a.value);
  if (sorted.length === 0) return `<p class="empty">Sin datos en este periodo.</p>`;
  const TOP = 8;
  const top = sorted.slice(0, TOP);
  const rest = sorted.slice(TOP);
  const rows = rest.length ? [...top, { label: `Otros (${rest.length})`, value: rest.reduce((a, d) => a + d.value, 0) }] : top;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = sorted.reduce((a, d) => a + d.value, 0);
  const canShare = s.aggregation === "sum" && total > 0;
  return `<div class="rank">${rows
    .map(
      (r) =>
        `<div class="rank-row"><div class="rank-name">${esc(r.label ?? "")}</div><div class="rank-track"><div class="rank-fill" style="width:${((r.value / max) * 100).toFixed(1)}%"></div></div><div class="rank-val">${esc(fmtValue(s.field, r.value))}${canShare ? `<span>${Math.round((r.value / total) * 100)} %</span>` : ""}</div></div>`,
    )
    .join("")}</div>`;
}

function annexTable(s: ApiReportSection): string {
  const rows = s.data.map((r) => `<tr><td>${esc(r.label ?? "Total")}</td><td class="n">${esc(fmtValue(s.field, r.value))}</td></tr>`).join("");
  return `<h3>${esc(s.heading)}</h3><table><thead><tr><th>${esc(s.groupBy === "day" ? "Día" : s.groupBy ?? "Concepto")}</th><th class="n">${esc(metricLabel(s))}</th></tr></thead><tbody>${rows || '<tr><td colspan="2">Sin datos</td></tr>'}</tbody></table>`;
}

export function reportToHtml(report: ApiReport, summary: string, businessName: string): string {
  const kpis = report.sections.filter((s) => s.kind === "kpi");
  const charts = report.sections.filter((s) => s.kind !== "kpi");
  const date = new Date(report.generatedAt).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  const chartsHtml = charts
    .map((s) => `<section class="block"><h2>${esc(s.heading)}</h2>${s.kind === "trend" ? trendChart(s) : rankingChart(s)}</section>`)
    .join("");
  const annex = charts.filter((s) => s.data.length > 0);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(report.title)}</title><style>
@page{size:A4;margin:16mm 14mm 18mm}
*{box-sizing:border-box}
body{font:13px/1.5 "Segoe UI",system-ui,-apple-system,sans-serif;color:#1b2430;margin:0 auto;max-width:780px;padding:32px 24px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
header{border-bottom:3px solid #0f766e;padding-bottom:16px;margin-bottom:24px}
.biz{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#0f766e;font-weight:700}
h1{font-size:28px;line-height:1.15;margin:6px 0 4px;letter-spacing:-.02em}
.meta{color:#6b7684;font-size:12px}
h2{font-size:15px;margin:0 0 10px;color:#0b1f33}
h3{font-size:12px;margin:18px 0 6px;color:#0b1f33}
.summary{background:#f1f7f6;border-left:4px solid #0f766e;border-radius:4px;padding:14px 16px;margin-bottom:24px;white-space:pre-line}
.summary b{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#0f766e;margin-bottom:4px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:28px}
.kpi{border:1px solid #dde3ea;border-radius:8px;padding:14px 16px}
.kpi-label{font-size:11px;color:#6b7684;text-transform:uppercase;letter-spacing:.06em}
.kpi-value{font-size:26px;font-weight:700;margin:4px 0;letter-spacing:-.02em}
.kpi-sub{font-size:10px;color:#9aa4b0}
.delta{font-size:12px;font-weight:600}.up{color:#15803d}.down{color:#b91c1c}.flat{color:#6b7684}
.block{margin-bottom:28px;break-inside:avoid}
.chart{width:100%;height:auto}.grid{stroke:#e5eaf0;stroke-width:1}.axis{font-size:9px;fill:#6b7684}
.bar{fill:#7cc4bd}.peak{fill:#0f766e}
.note{font-size:11px;color:#6b7684;margin-top:4px}
.rank-row{display:grid;grid-template-columns:34% 1fr 22%;gap:10px;align-items:center;padding:4px 0;font-size:12px}
.rank-track{height:12px;background:#eef2f6;border-radius:6px;overflow:hidden}.rank-fill{height:100%;background:#0f766e;border-radius:6px}
.rank-val{text-align:right;font-weight:600}.rank-val span{color:#6b7684;font-weight:400;margin-left:6px}
.annex{page-break-before:always}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{border-bottom:1px solid #e5eaf0;padding:5px 8px;text-align:left}th{background:#f5f7fa;color:#4b5663}.n{text-align:right}
.empty{color:#6b7684}
footer{margin-top:32px;padding-top:10px;border-top:1px solid #dde3ea;color:#9aa4b0;font-size:10px;display:flex;justify-content:space-between}
</style></head><body>
<header><div class="biz">${esc(businessName || "Reporte")}</div><h1>${esc(report.title)}</h1><div class="meta">Generado el ${esc(date)}</div></header>
${summary ? `<div class="summary"><b>Resumen ejecutivo</b>${esc(plainText(summary))}</div>` : ""}
${kpis.length ? `<div class="kpis">${kpis.map(kpiCard).join("")}</div>` : ""}
${chartsHtml}
${annex.length ? `<section class="annex"><h2>Anexo: datos detallados</h2>${annex.map(annexTable).join("")}</section>` : ""}
<footer><span>Generado con InnoApp</span><span>${esc(businessName)}</span></footer>
</body></html>`;
}

/** Abre el reporte en otra pestaña listo para imprimir / "Guardar como PDF". */
export function printReport(report: ApiReport, summary: string, businessName: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(reportToHtml(report, summary, businessName));
  w.document.close();
  w.focus();
  // Deja que el navegador pinte antes de abrir el diálogo de impresión.
  w.setTimeout(() => w.print(), 300);
}
