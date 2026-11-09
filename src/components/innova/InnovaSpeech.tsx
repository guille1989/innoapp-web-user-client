import { useEffect, useRef, useState } from "react";
import { useTypewriter } from "../../hooks/useTypewriter";
import { ASSISTANT_NAME } from "../../lib/innova";

/** Milisegundos que se queda la caja a la vista cuando Innova termina de hablar (para acabar de leerla). */
const LINGER_MS = 7000;
/** Ritmo de escritura: más o menos lo que tarda la voz en decir cada letra, ajustado a la velocidad elegida. */
const BASE_CPS = 15;

interface InnovaSpeechProps {
  /** Frases que Innova ya empezó a decir; se vacía al interrumpirla. */
  said: string[];
  speaking: boolean;
  rate: number;
}

/**
 * Lo que Innova dice, como el chat de un videojuego: una caja arriba a la derecha con su nombre y el
 * texto escribiéndose a la par de la voz. Aparece cuando empieza a hablar y se va unos segundos después
 * de que termina; si la interrumpen, desaparece enseguida. Para quien oye es decorativa: la voz ya
 * lleva todo el contenido (`aria-hidden`).
 */
export function InnovaSpeech({ said, speaking, rate }: InnovaSpeechProps) {
  const text = said.join(" ");
  const typed = useTypewriter(text, BASE_CPS * rate, !speaking);
  const [visible, setVisible] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text) { setVisible(false); return; }
    if (speaking) { setVisible(true); return; }
    const timer = window.setTimeout(() => setVisible(false), LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [text, speaking]);

  // Si la respuesta es larga, la caja se desplaza sola para seguir la última línea.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [typed]);

  if (!visible) return null;
  const typing = typed.length < text.length;
  return (
    <div className="innova-chat" aria-hidden="true">
      <div className="innova-chat-name"><i />{ASSISTANT_NAME}</div>
      <div className="innova-chat-body" ref={bodyRef}>
        {typed}{(typing || speaking) && <span className="innova-chat-caret" />}
      </div>
    </div>
  );
}
