import { useAuth } from "../auth/AuthContext";
import { IconAi, IconLogout } from "./icons";

interface TopBarProps {
  onOpenAi: () => void;
}

export function TopBar({ onOpenAi }: TopBarProps) {
  const { user, logout } = useAuth();

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-dot">DP</div>
        <div className="brand-name">DataPulse Ops</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div className="live-dot-wrap">
          <span className="pulse-dot" />
          en vivo
        </div>
        <button className="ai-btn" onClick={onOpenAi} aria-label="Abrir asistente de datos">
          <IconAi />
        </button>
        <button className="ai-btn" onClick={logout} aria-label={user ? `Cerrar sesión (${user.email})` : "Cerrar sesión"}>
          <IconLogout />
        </button>
      </div>
    </div>
  );
}
