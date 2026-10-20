import { FONT_LEVELS, FONT_LEVEL_LABELS, type FontSizeLevel } from "./fontScale";

interface TextSizeControlProps {
  level: FontSizeLevel;
  onChange: (level: FontSizeLevel) => void;
  className?: string;
  label?: string;
}

/** Selector "Texto A A A". Con `inline` deja de ser un flotante fijo y cabe en una cabecera. */
export function TextSizeControl({ level, onChange, className = "", label = "Tamaño del texto" }: TextSizeControlProps) {
  return (
    <div className={`text-size ${className}`} role="group" aria-label={label} onPointerDown={(e) => e.stopPropagation()}>
      <span>Texto</span>
      {FONT_LEVELS.map((item, index) => (
        <button key={item} type="button" className={level === item ? "active" : ""} aria-pressed={level === item} aria-label={FONT_LEVEL_LABELS[item]} title={FONT_LEVEL_LABELS[item]} onClick={() => onChange(item)}>
          <span style={{ fontSize: 11 + index * 3 }}>A</span>
        </button>
      ))}
    </div>
  );
}
