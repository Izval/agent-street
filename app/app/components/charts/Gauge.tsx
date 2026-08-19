/**
 * Gauge — health factor de préstamos (DESIGN.md v2 §15).
 * Semicírculo con zonas de color (polaridad: down/brand/up) + aguja al valor.
 * Zonas por defecto: <1.1 down · 1.1–1.5 brand · >1.5 up. Valor grande tabular
 * teñido por la zona activa. SVG puro, uniform-scaled, SSR-safe.
 */

type ZoneTone = "down" | "brand" | "up";

const TONE_VAR: Record<ZoneTone, string> = {
  down: "var(--down)",
  brand: "var(--brand)",
  up: "var(--up)",
};
const TONE_TEXT: Record<ZoneTone, string> = {
  down: "text-down",
  brand: "text-brand",
  up: "text-up",
};

export interface GaugeZone {
  upTo: number;
  tone: ZoneTone;
}

export interface GaugeProps {
  value: number;
  min?: number;
  max?: number;
  zones?: GaugeZone[];
}

const CX = 100;
const CY = 100;
const R = 78;
const STROKE = 14;

// θ: 180° (izquierda) → 0° (derecha), math estándar (y hacia arriba en pantalla).
function pointAt(r: number, f: number): [number, number] {
  const theta = Math.PI * (1 - Math.min(1, Math.max(0, f)));
  return [CX + r * Math.cos(theta), CY - r * Math.sin(theta)];
}

function arc(f0: number, f1: number): string {
  const [x0, y0] = pointAt(R, f0);
  const [x1, y1] = pointAt(R, f1);
  // sweep=0 abomba hacia arriba (semicírculo superior).
  return `M${x0} ${y0}A${R} ${R} 0 0 0 ${x1} ${y1}`;
}

export function Gauge({ value, min = 0, max = 3, zones }: GaugeProps) {
  const span = max - min || 1;
  const z: GaugeZone[] =
    zones && zones.length > 0
      ? zones
      : [
          { upTo: 1.1, tone: "down" },
          { upTo: 1.5, tone: "brand" },
          { upTo: max, tone: "up" },
        ];

  const f = (value - min) / span;
  const fGap = STROKE * 0.16 / (Math.PI * R); // ~2px de superficie entre zonas

  // construir segmentos en f-space, recortando gaps.
  let prev = min;
  const segs = z.map((zone, i) => {
    const from = prev;
    const to = Math.min(zone.upTo, max);
    prev = to;
    const f0 = (from - min) / span + (i > 0 ? fGap : 0);
    const f1 = (to - min) / span - (i < z.length - 1 ? fGap : 0);
    return { d: f1 > f0 ? arc(f0, f1) : "", tone: zone.tone };
  });

  // zona activa para teñir el valor.
  const activeTone: ZoneTone =
    z.find((zone) => value <= zone.upTo)?.tone ?? z[z.length - 1].tone;

  const [nx, ny] = pointAt(R - STROKE / 2 - 3, f);

  return (
    <div className="relative inline-block w-full max-w-[240px]">
      <svg
        viewBox="0 0 200 128"
        width="100%"
        height="100%"
        role="img"
        aria-label={`Health factor ${value} (rango ${min}–${max})`}
        style={{ display: "block" }}
      >
        {/* track base recesivo */}
        <path
          d={arc(0, 1)}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={STROKE}
          strokeLinecap="butt"
        />
        {segs.map((s, i) =>
          s.d ? (
            <path
              key={i}
              d={s.d}
              fill="none"
              stroke={TONE_VAR[s.tone]}
              strokeWidth={STROKE}
              strokeLinecap="butt"
            />
          ) : null
        )}
        {/* aguja */}
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="var(--text)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={5} fill="var(--text)" />
        <circle cx={CX} cy={CY} r={2} fill="var(--surface)" />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <div className={`tnum text-3xl font-bold leading-none ${TONE_TEXT[activeTone]}`}>
          {Number.isFinite(value)
            ? value.toLocaleString("en-US", { maximumFractionDigits: 2 })
            : "—"}
        </div>
        <div className="text-[11px] text-text-3">health factor</div>
      </div>

      <div className="pointer-events-none absolute inset-x-1 bottom-0 flex justify-between text-[10px] text-text-3">
        <span className="tnum">{min}</span>
        <span className="tnum">{max}</span>
      </div>
    </div>
  );
}
