import { useState } from "react";
import { RobotList } from "./RobotList";
import { RobotMap } from "./RobotMap";
import { RecordsList } from "./RecordsList";
import { IconList, IconMap } from "../icons";
import type { BusinessEvent, Robot } from "../../types";
import type { ApiActivationCode } from "../../api/client";

interface RobotsViewProps {
  active: boolean;
  events: BusinessEvent[];
  latestEventId: string | null;
  robots: Robot[];
  codes: ApiActivationCode[];
}

type RobotSubview = "list" | "map";

export function RobotsView({ active, events, latestEventId, robots, codes }: RobotsViewProps) {
  const [subview, setSubview] = useState<RobotSubview>("list");
  const isMap = subview === "map";

  return (
    <div className={`view${active ? " active" : ""}`}>
      <div className="page-title">Robots</div>
      <div className="page-sub">Estado de los equipos instalados en cada sucursal</div>

      <div className="view-toggle">
        <button className={`view-toggle-opt${!isMap ? " active" : ""}`} onClick={() => setSubview("list")}>
          <IconList /> Lista
        </button>
        <button className={`view-toggle-opt${isMap ? " active" : ""}`} onClick={() => setSubview("map")}>
          <IconMap /> Mapa
        </button>
      </div>

      <div className={`panel list-panel${isMap ? " hidden-panel" : ""}`}>
        <div className="panel-head">
          <div className="panel-title">Robots instalados</div>
        </div>
        <RobotList robots={robots} />
        {robots.length === 0 && <div className="empty-state">Todavía no hay robots activados.</div>}
      </div>

      <div className={`panel map-panel${isMap ? " active" : ""}`}>
        <div className="panel-head">
          <div className="panel-title">Vista de mapa · España</div>
        </div>
        <RobotMap active={active && isMap} robots={robots} />
      </div>

      <div className="section-label">Códigos de activación disponibles</div>
      <div className="activation-codes">
        {codes.filter((code) => code.status === "unused").map((code) => (
          <button key={code.code} className="activation-code mono" onClick={() => void navigator.clipboard.writeText(code.code)} title="Copiar código">
            {code.code}
          </button>
        ))}
        {!codes.some((code) => code.status === "unused") && <span className="empty-state">No quedan códigos disponibles.</span>}
      </div>

      <RecordsList events={events} latestEventId={latestEventId} />
    </div>
  );
}
