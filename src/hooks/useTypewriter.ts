import { useEffect, useRef, useState } from "react";

/**
 * Escribe `target` letra a letra, a `cps` caracteres por segundo. Si `target` crece (llega otra frase)
 * sigue desde donde iba; si cambia por completo, empieza de cero. Con `hurry` (la voz ya terminó)
 * acaba de escribir lo que falte cuatro veces más rápido. Con movimiento reducido, lo muestra entero.
 */
export function useTypewriter(target: string, cps: number, hurry: boolean): string {
  const [length, setLength] = useState(0);
  const previous = useRef("");
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!target.startsWith(previous.current)) setLength(0);
    previous.current = target;
  }, [target]);

  useEffect(() => {
    if (reduce || length >= target.length) return;
    const step = Math.max(1, Math.round((cps * (hurry ? 4 : 1)) / 20));
    const timer = window.setTimeout(() => setLength((n) => Math.min(target.length, n + step)), 50);
    return () => window.clearTimeout(timer);
  }, [target, length, cps, hurry, reduce]);

  const shown = reduce ? target.length : Math.min(length, target.length);
  return target.slice(0, shown);
}
