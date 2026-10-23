import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { THEME_LABELS, THEME_PREFERENCES, useTheme } from "../lib/theme";
import { PeriodControl } from "./dashboard/PeriodControl";
import { TextSizeControl } from "./dashboard/TextSizeControl";
import { useFontLevel } from "./dashboard/fontScale";
import type { AppView } from "./BottomNav";

interface TopBarProps {
  active: AppView;
  onChange: (view: AppView) => void;
  onOpenGuide: () => void;
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
    </svg>
  );
}

export function TopBar({ active, onChange, onOpenGuide }: TopBarProps) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [themePreference, theme, setThemePreference] = useTheme();
  const [fontLevel, setFontLevel] = useFontLevel();
  const nextTheme = theme === "dark" ? "light" : "dark";
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
        <img src="/brand/innoapp-mark.png" alt="InnoApp" />
      </div>
      <nav className="view-switcher glass" aria-label="Secciones principales">
        <button data-tour="view-ai" className={active === "ai" ? "active" : ""} onClick={() => onChange("ai")}>IA</button>
        <button data-tour="view-data"className={active === "dashboard" ? "active" : ""} onClick={() => onChange("dashboard")}>Datos</button>
        <button data-tour="view-agents" className={active === "robots" ? "active" : ""} onClick={() => onChange("robots")}>Agentes</button>
      </nav>
      <div className="header-tools">
      {active === "dashboard" && <PeriodControl variant="header" />}
      <TextSizeControl className="glass header-text-size" level={fontLevel} onChange={setFontLevel} label="Tamaño del texto" />
      <button type="button" className="theme-toggle glass" onClick={() => setThemePreference(nextTheme)} aria-label={`Cambiar a tema ${THEME_LABELS[nextTheme].toLowerCase()}`} title={`Tema ${THEME_LABELS[nextTheme].toLowerCase()}`}>
        {theme === "dark" ? <IconSun /> : <IconMoon />}
      </button>
      <div className="user-menu" ref={menuRef} data-tour="user-menu">
        <button className="user-avatar glass" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open}>{initials}</button>
        {open && (
          <div className="user-popover glass" role="menu">
            <div className="user-identity"><strong>{email}</strong><span>Sesión segura</span></div>
            <div className="theme-switch" role="group" aria-label="Tema de la interfaz">
              <span>Tema</span>
              <div>
                {THEME_PREFERENCES.map((item) => (
                  <button key={item} type="button" className={themePreference === item ? "active" : ""} aria-pressed={themePreference === item} onClick={() => setThemePreference(item)}>{THEME_LABELS[item]}</button>
                ))}
              </div>
            </div>
            {active === "dashboard" && <PeriodControl variant="popover" />}
            <TextSizeControl className="popover-text-size" level={fontLevel} onChange={setFontLevel} label="Tamaño del texto" />
            <button role="menuitem" onClick={() => { setOpen(false); onOpenGuide(); }}>Guía de la aplicación <span>?</span></button>
            <button role="menuitem" onClick={logout}>Cerrar sesión <span>↗</span></button>
          </div>
        )}
      </div>
      </div>
    </header>
  );
}
