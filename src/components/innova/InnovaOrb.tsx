import { useEffect, useRef } from "react";
import { ORB_STATE_LABEL, type OrbState } from "../../lib/innova";

type Rgb = [number, number, number];

// Variable de color del tema para cada estado, y qué tan rápido giran los anillos.
const STATE_STYLE: Record<OrbState, { rgbVar: string; spin: number }> = {
  idle: { rgbVar: "--teal-rgb", spin: 0.1 },
  listening: { rgbVar: "--teal-2-rgb", spin: 0.3 },
  thinking: { rgbVar: "--violet-rgb", spin: 1.3 },
  speaking: { rgbVar: "--teal-rgb", spin: 0.35 },
  alert: { rgbVar: "--amber-rgb", spin: 0.22 },
};

const RINGS = [
  { r: 1.42, w: 1.6, dash: [6, 10], speed: 1.0, alpha: 0.55 },
  { r: 1.72, w: 1.0, dash: [2, 8], speed: -0.7, alpha: 0.35 },
  { r: 2.02, w: 2.2, dash: [90, 60], speed: 0.45, alpha: 0.28 },
  { r: 2.36, w: 1.0, dash: [1, 6], speed: -0.3, alpha: 0.2 },
];

const readRgb = (styles: CSSStyleDeclaration, name: string): Rgb => {
  const [r, g, b] = styles.getPropertyValue(name).split(",").map((n) => Number(n.trim()));
  return [r || 0, g || 0, b || 0];
};

interface InnovaOrbProps {
  state: OrbState;
  /** 0-1: volumen de la voz (de quien habla o de quien escucha), para que el núcleo lata con ella. */
  level?: number;
}

/**
 * El núcleo animado de Innova. Dibuja en un canvas 2D (sin dependencias) con los colores del tema:
 * en oscuro suma luz sobre el fondo; en claro dibuja con tinta, porque la luz sumada sobre blanco
 * no se vería. Respeta `prefers-reduced-motion` y se detiene solo cuando la pestaña no se ve.
 */
export function InnovaOrb({ state, level = 0 }: InnovaOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // El bucle de dibujo lee siempre lo último desde acá, sin reiniciarse en cada cambio de estado.
  const live = useRef({ state, level });
  live.current = { state, level };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let light = root.dataset.theme === "light";
    let colors = paletteFor(root);
    const observer = new MutationObserver(() => { light = root.dataset.theme === "light"; colors = paletteFor(root); });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    let width = 0, height = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width; height = rect.height;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();

    const color: Rgb = [...colors.idle];
    const ringAngle = RINGS.map((_, i) => i);
    const sparks = Array.from({ length: 46 }, (_, i) => ({ a: (i / 46) * Math.PI * 2, r: 1.5 + Math.random() * 1.2, s: 0.05 + Math.random() * 0.2, z: Math.random() }));
    let level = 0, last = performance.now(), raf = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (width === 0 || height === 0) return;      // pestaña oculta (display: none): nada que dibujar
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const motion = reduceMotion ? 0.25 : 1;
      const { state: current, level: input } = live.current;

      const target = colors[current];
      for (let k = 0; k < 3; k++) color[k] += (target[k] - color[k]) * Math.min(1, dt * 4);
      const goal = current === "listening" ? Math.max(0.06, input)
        : current === "speaking" ? Math.min(1, 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(t / 130)) + input * 0.5)
        : current === "thinking" ? 0.12 + 0.05 * Math.sin(t / 260) : 0;
      level += (goal - level) * Math.min(1, dt * 9);

      const [r, g, b] = color.map(Math.round);
      const rgba = (a: number) => `rgba(${r},${g},${b},${a})`;
      const cx = width / 2, cy = height / 2, base = Math.min(width, height) * 0.17;
      const spin = STATE_STYLE[current].spin * motion;
      ctx.clearRect(0, 0, width, height);
      // Oscuro: la luz se suma. Claro: tinta normal, con menos opacidad en el halo.
      ctx.globalCompositeOperation = light ? "source-over" : "lighter";
      const haloAlpha = light ? 0.16 : 0.3;

      const halo = ctx.createRadialGradient(cx, cy, base * 0.3, cx, cy, base * 3.4);
      halo.addColorStop(0, rgba(haloAlpha + level * 0.25)); halo.addColorStop(0.45, rgba(light ? 0.04 : 0.07)); halo.addColorStop(1, rgba(0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, base * 3.4, 0, Math.PI * 2); ctx.fill();

      RINGS.forEach((ring, i) => {
        ringAngle[i] += dt * spin * ring.speed;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(ringAngle[i]);
        ctx.beginPath(); ctx.setLineDash(ring.dash); ctx.lineWidth = ring.w;
        ctx.strokeStyle = rgba(Math.min(1, (light ? ring.alpha * 1.3 : ring.alpha) + level * 0.25));
        ctx.arc(0, 0, base * ring.r * (1 + level * 0.04), 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      });
      ctx.setLineDash([]);

      const bars = 120, inner = base * 1.16;
      ctx.lineWidth = 2; ctx.lineCap = "round";
      for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const wave = (0.5 + 0.5 * Math.sin(i * 0.9 + (t / 240) * motion)) * (0.5 + 0.5 * Math.sin(i * 0.37 - (t / 420) * motion));
        const len = base * (0.035 + level * 0.62 * wave + 0.02 * wave);
        ctx.strokeStyle = rgba((light ? 0.45 : 0.35) + 0.5 * wave);
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner); ctx.lineTo(cx + Math.cos(angle) * (inner + len), cy + Math.sin(angle) * (inner + len)); ctx.stroke();
      }

      for (const s of sparks) {
        s.a += dt * s.s * (current === "thinking" ? 6 : 1) * motion;
        const rr = base * s.r * (1 + level * 0.08);
        ctx.fillStyle = rgba((light ? 0.35 : 0.25) + s.z * 0.5);
        ctx.beginPath(); ctx.arc(cx + Math.cos(s.a) * rr, cy + Math.sin(s.a) * rr, 1 + s.z * 1.6, 0, Math.PI * 2); ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      const core = base * (1 + 0.035 * Math.sin((t / 900) * motion) + level * 0.14);
      const sphere = ctx.createRadialGradient(cx - core * 0.3, cy - core * 0.35, core * 0.08, cx, cy, core);
      sphere.addColorStop(0, "rgba(255,255,255,0.97)"); sphere.addColorStop(0.28, rgba(0.96));
      const shade = light ? 0.55 : 0.25;
      sphere.addColorStop(1, `rgba(${Math.round(r * shade)},${Math.round(g * shade)},${Math.round(b * (light ? 0.7 : 0.45))},0.96)`);
      ctx.fillStyle = sphere; ctx.beginPath(); ctx.arc(cx, cy, core, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = rgba(0.7); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, core, 0, Math.PI * 2); ctx.stroke();
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); resizeObserver.disconnect(); observer.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="innova-orb" role="img" aria-label={`Innova: ${ORB_STATE_LABEL[state].replace("…", "")}`} />;
}

function paletteFor(root: HTMLElement): Record<OrbState, Rgb> {
  const styles = getComputedStyle(root);
  const entries = (Object.keys(STATE_STYLE) as OrbState[]).map((s) => [s, readRgb(styles, STATE_STYLE[s].rgbVar)] as const);
  return Object.fromEntries(entries) as Record<OrbState, Rgb>;
}
