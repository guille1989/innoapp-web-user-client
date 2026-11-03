import type { ApiMatter } from "../../api/client";
import { questionAbout, SEVERITY_LABEL } from "../../lib/matters";

// Más de tres avisos empujarían el chat fuera de la pantalla; el resto queda en la cuenta ("y 2 más").
const MAX_VISIBLE = 3;

interface AttentionPanelProps {
  matters: ApiMatter[];
  /** Manda la pregunta al chat. */
  onAsk: (question: string) => void;
  onMark: (id: string, status: "seen" | "dismissed") => void;
  disabled?: boolean;
}

/** Avisos del asesor del negocio, en la portada de la vista IA: lo importante, antes de que preguntes nada. */
export function AttentionPanel({ matters, onAsk, onMark, disabled }: AttentionPanelProps) {
  if (matters.length === 0) return null;
  const shown = matters.slice(0, MAX_VISIBLE);
  const hidden = matters.length - shown.length;
  return (
    <section className="attention" aria-label="Avisos que requieren tu atención">
      <h2 className="attention-head"><span className="pulse-dot" aria-hidden="true" />Requiere tu atención</h2>
      {shown.map((matter) => (
        <article key={matter.id} className={`attention-card${matter.status === "seen" ? " seen" : ""}`} data-severity={matter.severity}>
          <span className="attention-tag">{SEVERITY_LABEL[matter.severity]}</span>
          <h3 className="attention-title">{matter.title}</h3>
          <p className="attention-detail">{matter.detail}</p>
          <div className="attention-actions">
            <button type="button" className="primary" disabled={disabled} onClick={() => onAsk(questionAbout(matter))}>Preguntar</button>
            {matter.status === "new" && <button type="button" onClick={() => onMark(matter.id, "seen")}>Entendido</button>}
            <button type="button" onClick={() => onMark(matter.id, "dismissed")}>Descartar</button>
          </div>
        </article>
      ))}
      {hidden > 0 && <p className="attention-more">y {hidden} más</p>}
    </section>
  );
}
