import { IconDashboard, IconRobots } from "./icons";

export type AppView = "dashboard" | "robots";

interface BottomNavProps {
  active: AppView;
  onChange: (view: AppView) => void;
}

const ITEMS: Array<{ view: AppView; label: string; icon: () => React.ReactElement }> = [
  { view: "dashboard", label: "Dashboard", icon: IconDashboard },
  { view: "robots", label: "Robots", icon: IconRobots },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottomnav">
      {ITEMS.map(({ view, label, icon: Icon }) => (
        <button
          key={view}
          className={`bottomnav-item${active === view ? " active" : ""}`}
          onClick={() => onChange(view)}
        >
          <Icon />
          <span>{label}</span>
          <div className="bottomnav-indicator" />
        </button>
      ))}
    </nav>
  );
}
