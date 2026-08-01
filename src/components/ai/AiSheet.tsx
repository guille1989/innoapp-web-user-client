import { useRef, useState } from "react";
import { respond } from "../../lib/aiAssistant";
import { IconAi, IconClose, IconSend } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface AiSheetProps {
  open: boolean;
  onClose: () => void;
  events: BusinessEvent[];
  onCreateWidget: (cfg: Omit<Widget, "id">) => void;
}

interface ChatMessage {
  id: number;
  role: "ai" | "user";
  content: React.ReactNode;
}

const SUGGESTED = [
  { q: "¿Cuál sucursal vendió más hoy?", label: "¿Sucursal con más ventas?" },
  { q: "Hazme una gráfica de ventas por sucursal", label: "Gráfica por sucursal" },
  { q: "Crea un kpi con el conteo de devoluciones", label: "KPI de devoluciones" },
];

let msgSeq = 1;

export function AiSheet({ open, onClose, events, onCreateWidget }: AiSheetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: msgSeq++,
      role: "ai",
      content: "Hola, soy tu asistente de datos. Puedo interpretar lo que capturan tus robots y también crear KPIs o gráficas por ti.",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    });
  }

  function send(question: string) {
    const value = question.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { id: msgSeq++, role: "user", content: value }]);
    setInput("");
    setTyping(true);
    scrollToBottom();

    setTimeout(() => {
      const res = respond(value, events);
      let content: React.ReactNode;
      if (res.kind === "widget") {
        onCreateWidget(res.cfg);
        content = (
          <>
            Listo, añadí <span className="mono-inline">{res.cfg.title}</span> a tu dashboard.
          </>
        );
      } else {
        content = res.text;
      }
      setTyping(false);
      setMessages((prev) => [...prev, { id: msgSeq++, role: "ai", content }]);
      scrollToBottom();
    }, 850 + Math.random() * 500);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className={`sheet ai-sheet${open ? " open" : ""}`} id="dpAiSheet">
      <div className="sheet-handle" />
      <div className="ai-head">
        <div className="ai-head-title">
          <div className="ai-avatar">
            <IconAi />
          </div>
          <div>
            <div className="ai-title-text">Asistente de datos</div>
            <div className="ai-subtitle">Conoce tus lecturas en tiempo real</div>
          </div>
        </div>
        <button className="ai-close" onClick={onClose} aria-label="Cerrar asistente">
          <IconClose />
        </button>
      </div>
      <div className="ai-body" ref={bodyRef}>
        {messages.map((m) => (
          <div className={`msg ${m.role}`} key={m.id}>
            <div className="msg-avatar">{m.role === "ai" ? "IA" : "Tú"}</div>
            <div className="msg-bubble">{m.content}</div>
          </div>
        ))}
        {typing && (
          <div className="msg ai">
            <div className="msg-avatar">IA</div>
            <div className="msg-bubble">
              <div className="typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="suggested">
        {SUGGESTED.map((s) => (
          <button className="chip" key={s.q} onClick={() => send(s.q)}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="ai-input-wrap">
        <textarea
          className="ai-input"
          rows={1}
          placeholder="Pregunta o pide un KPI..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="ai-send" onClick={() => send(input)} aria-label="Enviar">
          <IconSend />
        </button>
      </div>
    </div>
  );
}
