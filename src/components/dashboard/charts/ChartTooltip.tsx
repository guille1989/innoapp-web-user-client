import { useLayoutEffect, useRef, useState } from "react";

interface ChartTooltipProps {
  /** Punto de anclaje dentro del contenedor (px). */
  x: number;
  y: number;
  containerWidth: number;
  containerHeight: number;
  /**
   * Franja vertical que el tooltip no debe tapar (la fila de una barra):
   * se pone debajo si entra, si no encima. Sin esto se pega al costado del ancla.
   */
  avoid?: { top: number; bottom: number };
  value: string;
  unit: string;
  label: string;
  extra?: string;
  keyColor?: string;
}

const GAP = 12;

/**
 * Tooltip compartido: el valor manda (fuerte, tinta primaria) y la fecha o
 * categoría lo acompaña debajo. Se mide a sí mismo para quedar siempre
 * dentro del widget, que recorta con overflow hidden.
 */
export function ChartTooltip({ x, y, containerWidth, containerHeight, avoid, value, unit, label, extra, keyColor }: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 120, height: 48 });
  // El tamaño solo depende del texto: se vuelve a medir cuando cambia.
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    setBox((current) => (current.width === width && current.height === height ? current : { width, height }));
  }, [value, unit, label, extra]);

  const clampX = (left: number) => Math.min(Math.max(0, left), Math.max(0, containerWidth - box.width));
  const clampY = (top: number) => Math.min(Math.max(0, top), Math.max(0, containerHeight - box.height));
  let left: number;
  let top: number;
  if (avoid) {
    left = clampX(x - box.width / 2);
    top = avoid.bottom + 4 + box.height <= containerHeight ? avoid.bottom + 4 : clampY(avoid.top - 4 - box.height);
  } else {
    left = clampX(x + GAP + box.width <= containerWidth ? x + GAP : x - GAP - box.width);
    top = clampY(y - box.height / 2);
  }

  return (
    <div ref={ref} className="chart-tooltip" style={{ left, top }} aria-hidden="true">
      <div className="chart-tooltip-value">
        {keyColor && <i style={{ background: keyColor }} />}
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      <div className="chart-tooltip-label">{label}</div>
      {extra && <div className="chart-tooltip-extra">{extra}</div>}
    </div>
  );
}
