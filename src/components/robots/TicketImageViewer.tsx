import { useEffect, useState } from "react";
import { api, type ApiTicket } from "../../api/client";

interface TicketImageViewerProps {
  ticket: ApiTicket;
  idToken: string;
  onClose: () => void;
}

/**
 * Muestra el ticket-imagen reconstruido (ver `image/handler.ts` del backend)
 * para que el dueño del negocio lo compare contra el papel antes de
 * confirmar/descartar un `needs_review`. Se pide bajo demanda al abrir el
 * modal en vez de junto con la lista — es una imagen por ticket, no algo que
 * haga falta precargar para los que todavía no se están mirando.
 */
export function TicketImageViewer({ ticket, idToken, onClose }: TicketImageViewerProps) {
  const [image, setImage] = useState<{ png: string; width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setImage(null);
    api
      .ticketImage(idToken, ticket.ticketId, ticket.capturedAt)
      .then((result) => { if (!cancelled) setImage(result); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [idToken, ticket.ticketId, ticket.capturedAt]);

  return (
    <div className="ticket-image-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="ticket-image-viewer glass">
        <header>
          <div><span>Ticket original</span><h2>{new Date(ticket.capturedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </header>
        <div className="ticket-image-body">
          {loading && <div className="ticket-image-status">Cargando imagen…</div>}
          {!loading && error && <div className="ticket-image-status ticket-image-error">No se pudo cargar la imagen: {error}</div>}
          {!loading && !error && image && <img src={image.png} alt={`Ticket capturado el ${ticket.capturedAt}`} width={image.width} height={image.height} />}
        </div>
      </div>
    </div>
  );
}
