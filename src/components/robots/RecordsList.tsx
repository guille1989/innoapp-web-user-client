import { useMemo, useState } from "react";
import { fmtAmount } from "../../data/format";
import type { BusinessEvent, EventType } from "../../types";

const FILTERS: Array<{ key: EventType | "all"; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "venta", label: "Venta" },
  { key: "devolucion", label: "Devolución" },
  { key: "apertura_caja", label: "Apertura de caja" },
];

interface RecordsListProps {
  events: BusinessEvent[];
  latestEventId: string | null;
}

/** "2026-10-22" → "22/10/2026", sin pasar por Date para no correr el día por zona horaria. */
function fmtDueDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function fieldChips(ev: BusinessEvent) {
  if (ev.eventType === "venta") {
    return (
      <>
        <span className="record-chip">
          monto: <b>{fmtAmount(ev.monto)}</b>
        </span>
        <span className="record-chip">
          items: <b>{ev.items}</b>
        </span>
        {ev.vence && (
          <span className="record-chip">
            vence: <b>{fmtDueDate(ev.vence)}</b>
          </span>
        )}
      </>
    );
  }
  if (ev.eventType === "devolucion") {
    return (
      <>
        <span className="record-chip">
          monto: <b>{fmtAmount(ev.monto)}</b>
        </span>
        <span className="record-chip">
          motivo: <b>{ev.motivo}</b>
        </span>
      </>
    );
  }
  return (
    <span className="record-chip">
      monto_inicial: <b>{fmtAmount(ev.montoInicial)}</b>
    </span>
  );
}

export function RecordsList({ events, latestEventId }: RecordsListProps) {
  const [filter, setFilter] = useState<EventType | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter((e) => filter === "all" || e.eventType === filter)
      .filter((e) => !q || e.store.toLowerCase().includes(q) || e.robot.toLowerCase().includes(q))
      .slice()
      .reverse()
      .slice(0, 40);
  }, [events, filter, search]);

  return (
    <>
      <div className="section-label">Registros</div>
      <div className="filters-scroll">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`filter-pill${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        className="filter-search"
        placeholder="Buscar sucursal o robot..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div>
        {filtered.map((ev) => (
          <div className={`record-card${ev.id === latestEventId ? " is-new" : ""}`} key={ev.id}>
            <div className="record-top">
              <div className="record-left">
                <span className="record-time mono">{ev.timeStr}</span>
                <span className="record-type" style={{ background: ev.meta.bg, color: ev.meta.color }}>
                  {ev.meta.label}
                </span>
              </div>
            </div>
            <div className="record-store">
              {ev.store} · {ev.robot}
            </div>
            <div className="record-fields">{fieldChips(ev)}</div>
          </div>
        ))}
      </div>
      <div className="record-count">
        Mostrando {filtered.length} de {events.length} registros
      </div>
    </>
  );
}
