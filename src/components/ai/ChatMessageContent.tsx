import type { ApiReport } from "../../api/client";
import { downloadReportCsv, printReport } from "../../lib/report";
import type { ChatMessage } from "../../lib/conversation";
import { parseMessageBlocks } from "../../lib/markdownTables";

/**
 * El modelo marca énfasis con **negrita**. Se renderiza solo eso (como nodos de
 * React, nunca como HTML) y se respetan los saltos de línea de las listas;
 * cualquier otro markdown se muestra tal cual.
 */
function RichText({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return <span style={{ whiteSpace: "pre-wrap" }}>{parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}</span>;
}

/** Texto con negrita y tablas markdown; las tablas se arman con nodos de React. */
function RichBlocks({ text }: { text: string }) {
  const blocks = parseMessageBlocks(text);
  if (!blocks.some((block) => block.type === "table")) return <RichText text={text} />;
  return (
    <>
      {blocks.map((block, i) =>
        block.type === "text" ? (
          <div key={i}><RichText text={block.text} /></div>
        ) : (
          <div className="msg-table-wrap" key={i}>
            <table className="msg-table">
              <thead><tr>{block.header.map((cell, c) => <th key={c} style={{ textAlign: block.align[c] }}><RichText text={cell} /></th>)}</tr></thead>
              <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((cell, c) => <td key={c} style={{ textAlign: block.align[c] }}><RichText text={cell} /></td>)}</tr>)}</tbody>
            </table>
          </div>
        ),
      )}
    </>
  );
}

function ReportMessage({ answer, report, businessName, saved }: { answer: string; report: ApiReport; businessName: string; saved: boolean }) {
  return (
    <>
      <div><RichBlocks text={answer} /></div>
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
  return <RichBlocks text={message.text} />;
}
