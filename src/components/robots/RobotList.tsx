import type { Robot, RobotStatus } from "../../types";

const STATUS_LABEL: Record<RobotStatus, string> = { online: "online", warn: "intermitente", offline: "offline" };

export function RobotList({ robots }: { robots: Robot[] }) {
  return <div className="robot-list">{robots.map((robot) => (
    <div className="robot-row" key={robot.id}>
      <span className={`robot-status ${robot.status}`} />
      <div className="robot-info"><div className="robot-name">{robot.name}</div><div className="robot-meta">{robot.store}{robot.city ? ` · ${robot.city}` : ""}</div><div className="robot-seen">{robot.meta}</div></div>
      <span className={`robot-badge ${robot.status}`}>{STATUS_LABEL[robot.status]}</span>
    </div>
  ))}</div>;
}
