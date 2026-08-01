import { useState } from "react";
import { RobotList } from "./RobotList";
import { RobotMap } from "./RobotMap";
import { RecordsList } from "./RecordsList";
import { IconList, IconMap } from "../icons";
import type { BusinessEvent } from "../../types";

interface RobotsViewProps {
  active: boolean;
  events: BusinessEvent[];
  latestEventId: number | null;
}

type RobotSubview = "list" | "map";

export function RobotsView({ active, events, latestEventId }: RobotsViewProps) {
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
        <RobotList />
      </div>

      <div className={`panel map-panel${isMap ? " active" : ""}`}>
        <div className="panel-head">
          <div className="panel-title">Vista de mapa · España</div>
        </div>
        <RobotMap active={active && isMap} />
      </div>

      <RecordsList events={events} latestEventId={latestEventId} />
    </div>
  );
}
