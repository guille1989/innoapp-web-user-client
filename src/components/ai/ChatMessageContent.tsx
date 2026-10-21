import type { ApiReport } from "../../api/client";
import { downloadReportCsv, printReport } from "../../lib/report";
import type { ChatMessage } from "../../lib/conversation";

/**
 * El modelo marca énfasis con **negrita**. Se renderiza solo eso (como nodos de
 * React, nunca como HTML) y se respetan los saltos de línea de las listas;
 * cualquier otro markdown se muestra tal cual.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <span style={{ whiteSpace: "pre-wrap" }}>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</span>;
}

function ReportMessage({ answer, report, businessName, saved }: { answer: string; report: ApiReport; businessName: string; saved: boolean }) {
  return (
    <>
      <div><RichText text={answer} /></div>
      <div className="report-actions" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="chip" onClick={() => printReport(report, answer, businessName)}>Ver / guardar PDF</button>
        <button className="chip" onClick={() => downloadReportCsv(report)}>Descargar CSV</button>
      </div>
      {saved && <div style={{ fontSize: "calc(11px * var(--afs, 1))", opacity: 0.7, marginTop: 6 }}>Guardado en la sección Reportes por 30 días.</div>}
    </>
  );
}

export function ChatMessageContent({ message, businessName }: { message: ChatMessage; businessName: string }) {
  if (message.role === "user") return <>{message.text}</>;
  if (message.report) return <ReportMessage answer={message.text} report={message.report} businessName={businessName} saved={Boolean(message.reportId)} />;
  return <RichText text={message.text} />;
}
