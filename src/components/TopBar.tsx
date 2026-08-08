import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import type { AppView } from "./BottomNav";

interface TopBarProps {
  active: AppView;
  onChange: (view: AppView) => void;
}

export function TopBar({ active, onChange }: TopBarProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const email = user?.email ?? "Usuario InnoApp";
  const initials = email.slice(0, 2).toUpperCase();

  useEffect(() => {
    function closeMenu(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", closeMenu);
    return () => window.removeEventListener("pointerdown", closeMenu);
  }, []);

  return (
    <header className="floating-header">
      <div className="floating-brand glass">
        <img src="/brand/innoapp-mark.png" alt="" />
        <strong>Inno<span>App</span></strong>
      </div>
      <nav className="view-switcher glass" aria-label="Secciones principales">
        <button className={active === "dashboard" ? "active" : ""} onClick={() => onChange("dashboard")}>Datos</button>
        <button className={active === "robots" ? "active" : ""} onClick={() => onChange("robots")}>Agentes</button>
      </nav>
      <div className="user-menu" ref={menuRef}>
        <button className="user-avatar glass" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>{initials}</button>
        {open && (
          <div className="user-popover glass" role="menu">
            <div className="user-identity"><strong>{email}</strong><span>Sesión segura</span></div>
            <button role="menuitem" onClick={logout}>Cerrar sesión <span>↗</span></button>
          </div>
        )}
      </div>
    </header>
  );
}
