import type { Robot, RobotStatus } from "../../types";

const STATUS_LABEL: Record<RobotStatus, string> = { online: "online", warn: "reintentando", offline: "offline" };

export function RobotList({ robots }: { robots: Robot[] }) {
  return (
    <div>
      {robots.map((r) => (
        <div className="robot-row" key={r.name}>
          <span className={`robot-status ${r.status}`} />
          <div className="robot-info">
            <div className="robot-name">{r.name}</div>
            <div className="robot-meta">
              {r.store} · {r.city} · {r.meta}
            </div>
          </div>
          <span className={`robot-badge ${r.status}`}>{STATUS_LABEL[r.status]}</span>
        </div>
      ))}
    </div>
  );
}
