import { useEffect, useRef, useState } from "react";
import { WidgetCard } from "./WidgetCard";
import { IconPlus } from "../icons";
import type { BusinessEvent, Widget } from "../../types";

interface DashboardViewProps {
  active: boolean;
  widgets: Widget[];
  events: BusinessEvent[];
  onRemoveWidget: (id: string) => void;
  onOpenBuilder: () => void;
}

interface WidgetLayout { x: number; y: number; w: number; h: number }
type LayoutMap = Record<string, WidgetLayout>;
type Interaction = { kind: "drag" | "resize"; id: string; startX: number; startY: number; initial: WidgetLayout };
const STORAGE_KEY = "innoapp.widget-layout.v1";

function loadLayout(): LayoutMap {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as LayoutMap; } catch { return {}; }
}

function defaultLayout(index: number, type: Widget["type"]): WidgetLayout {
  const column = index % 3;
  const row = Math.floor(index / 3);
  return { x: 48 + column * 340, y: 106 + row * 242, w: type === "kpi" ? 280 : 320, h: type === "kpi" ? 156 : 216 };
}

export function DashboardView({ active, widgets, events, onRemoveWidget, onOpenBuilder }: DashboardViewProps) {
  const [layout, setLayout] = useState<LayoutMap>(loadLayout);
  const [selected, setSelected] = useState<string | null>(null);
  const interaction = useRef<Interaction | null>(null);

  useEffect(() => {
    setLayout((current) => {
      const next = { ...current };
      widgets.forEach((widget, index) => { if (!next[widget.id]) next[widget.id] = defaultLayout(index, widget.type); });
      return next;
    });
  }, [widgets]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); }, [layout]);

  useEffect(() => {
    function move(e: PointerEvent) {
      const activeInteraction = interaction.current;
      if (!activeInteraction) return;
      const dx = e.clientX - activeInteraction.startX;
      const dy = e.clientY - activeInteraction.startY;
      setLayout((current) => {
        const previous = current[activeInteraction.id] ?? activeInteraction.initial;
        const next = activeInteraction.kind === "drag"
          ? { ...previous, x: Math.max(12, activeInteraction.initial.x + dx), y: Math.max(86, activeInteraction.initial.y + dy) }
          : { ...previous, w: Math.max(220, activeInteraction.initial.w + dx), h: Math.max(132, activeInteraction.initial.h + dy) };
        return { ...current, [activeInteraction.id]: next };
      });
    }
    function stop() { interaction.current = null; document.body.classList.remove("is-dragging"); }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); window.removeEventListener("pointercancel", stop); };
  }, []);

  function start(kind: Interaction["kind"], id: string, e: React.PointerEvent) {
    if (e.pointerType !== "mouse" && window.innerWidth < 760) return;
    const initial = layout[id];
    if (!initial) return;
    e.preventDefault();
    e.stopPropagation();
    interaction.current = { kind, id, startX: e.clientX, startY: e.clientY, initial };
    setSelected(id);
    document.body.classList.add("is-dragging");
  }

  return (
    <section className={`data-canvas view${active ? " active" : ""}`} onPointerDown={() => setSelected(null)}>
      <div className="canvas-grid" />
      <div className="canvas-vignette" />
      <div className="canvas-intro"><span>Espacio de datos</span><strong>{widgets.length} {widgets.length === 1 ? "widget" : "widgets"}</strong></div>
      <div className="canvas-widgets">
        {widgets.map((widget, index) => {
          const box = layout[widget.id] ?? defaultLayout(index, widget.type);
          return (
            <div className={`widget-position${selected === widget.id ? " selected" : ""}`} style={{ left: box.x, top: box.y, width: box.w, height: box.h }} key={widget.id} onPointerDown={(e) => { e.stopPropagation(); setSelected(widget.id); }}>
              <WidgetCard widget={widget} events={events} onRemove={onRemoveWidget} onDragStart={(e) => start("drag", widget.id, e)} onResizeStart={(e) => start("resize", widget.id, e)} />
            </div>
          );
        })}
      </div>
      {widgets.length === 0 && <div className="canvas-empty"><div className="empty-icon">＋</div><strong>Tu espacio de datos está vacío</strong><span>Añade un KPI o una gráfica para comenzar.</span><button onClick={onOpenBuilder}>Crear primer widget</button></div>}
      {active && <button className="fab glass" onClick={onOpenBuilder} aria-label="Agregar widget"><IconPlus /><span>Añadir widget</span></button>}
    </section>
  );
}
