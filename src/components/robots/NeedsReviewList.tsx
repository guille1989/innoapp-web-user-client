import { useState } from "react";
import { fmtAmount } from "../../data/format";
import type { ApiTicket } from "../../api/client";

interface NeedsReviewListProps {
  tickets: ApiTicket[];
  onReview: (ticketId: string, capturedAt: string, action: "confirm" | "discard") => Promise<void>;
}

/**
 * `needs_review` es lo que resolvió el fallback de Bedrock — un LLM puede
 * alucinar de forma internamente consistente, así que no cuenta como venta
 * confiable hasta que el dueño del negocio lo confirme (o lo descarte si
 * no era una venta real). Sin la imagen del ticket todavía — con lo que se
 * extrajo alcanza para el caso más común; si hace falta comparar contra el
 * papel, se agrega después.
 */
export function NeedsReviewList({ tickets, onReview }: NeedsReviewListProps) {
  const [pending, setPending] = useState<string | null>(null);
  const needsReview = tickets.filter((t) => t.status === "needs_review").slice().reverse();

  async function act(ticket: ApiTicket, action: "confirm" | "discard") {
    setPending(ticket.ticketId);
    try {
      await onReview(ticket.ticketId, ticket.capturedAt, action);
    } catch {
      // El error ya queda visible en el banner general (cloud.error) — acá solo se libera el botón.
    } finally {
      setPending(null);
    }
  }

  if (needsReview.length === 0) {
    return <div className="empty-state">No hay tickets pendientes de revisión.</div>;
  }

  return (
    <>
      <p className="review-hint">Un modelo de IA leyó estos tickets pero no está garantizado — confirmalos si el monto y los productos coinciden con el papel, o descartalos si no era una venta real.</p>
      {needsReview.map((ticket) => {
        const time = new Date(ticket.capturedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
        const busy = pending === ticket.ticketId;
        return (
          <div className="record-card review-card" key={ticket.ticketId}>
            <div className="record-top">
              <div className="record-left">
                <span className="record-time mono">{time}</span>
                <span className="record-type" style={{ background: "var(--teal-dim)", color: "var(--teal)" }}>{ticket.port}</span>
              </div>
              <span className="record-store">{fmtAmount(ticket.total ?? 0)}</span>
            </div>
            <div className="record-fields">
              {(ticket.items ?? []).map((item, i) => (
                <span className="record-chip" key={i}>
                  {item.description ?? "ítem"} <b>× {item.quantity ?? 1}</b>
                </span>
              ))}
              {(ticket.items?.length ?? 0) === 0 && <span className="record-chip">sin ítems extraídos</span>}
            </div>
            <div className="review-actions">
              <button className="review-confirm" disabled={busy} onClick={() => void act(ticket, "confirm")}>
                {busy ? "…" : "Confirmar"}
              </button>
              <button className="review-discard" disabled={busy} onClick={() => void act(ticket, "discard")}>
                {busy ? "…" : "Descartar"}
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}
