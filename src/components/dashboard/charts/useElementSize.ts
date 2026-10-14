import { useLayoutEffect, useState } from "react";

/**
 * Tamaño real en píxeles de un contenedor. Las gráficas se dibujan en
 * coordenadas de píxel (no en un viewBox estirado con
 * preserveAspectRatio="none") para que los puntos sigan siendo círculos y
 * los textos del eje no se deformen al redimensionar el widget. Ref por
 * callback: el nodo puede aparecer después (p. ej. al salir del estado vacío).
 */
export function useElementSize<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [setNode, size] as const;
}
