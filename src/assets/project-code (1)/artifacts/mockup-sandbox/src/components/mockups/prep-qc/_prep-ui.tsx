import {
  useState,
  type ComponentType,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Check } from "lucide-react";
import type { CrossSectionData } from "./prep-geometry";

// ---------------------------------------------------------------------------
// Shared UI primitives used by both the Pre-Entry stage and the Main App.
// ---------------------------------------------------------------------------

// Toggle group — small segmented control.
export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  disabled,
  done,
}: {
  value: T;
  onChange: Dispatch<SetStateAction<T>>;
  options: {
    value: T;
    label: string;
    icon: ComponentType<{ className?: string }>;
  }[];
  disabled: boolean;
  // Values whose step has been saved — renders a small check badge.
  done?: ReadonlySet<T>;
}) {
  return (
    <div
      className={[
        "inline-flex rounded-md border p-0.5",
        disabled
          ? "border-[#e2e7ee] bg-[#f4f7fa]"
          : "border-[#cbd6e2] bg-white",
      ].join(" ")}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        const isDone = done?.has(opt.value) ?? false;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={[
              "flex items-center gap-1.5 rounded px-2.5 py-1 text-[12px] font-medium transition",
              disabled
                ? "cursor-not-allowed text-[#a0a8b4]"
                : active
                ? "bg-[#2a8fd8] text-white shadow-sm"
                : "text-[#5a6270] hover:bg-[#f4f7fa]",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
            {isDone && (
              <Check
                className={[
                  "h-3.5 w-3.5",
                  active ? "text-white" : "text-[#1c7d4d]",
                ].join(" ")}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// Legend shown over the viewer. `kind` selects the undercut or heatmap legend;
// null renders nothing.
export function Legend({
  kind,
  step,
  onStep,
}: {
  kind: "heatmap" | "undercut" | null;
  step: 0.1 | 0.2;
  onStep: (s: 0.1 | 0.2) => void;
}) {
  if (kind === "undercut") {
    return (
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-white/90 px-3 py-2 shadow-md ring-1 ring-[#cbd6e2] backdrop-blur">
        <div className="flex items-center gap-4 text-[11px] text-[#1c1f24]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-[#3fae6e]" />
            Draftable
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-6 rounded-sm"
              style={{ background: "linear-gradient(90deg,#f5c71e,#c41f1f)" }}
            />
            Undercut (mild → severe)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-[#8c8c93]" />
            Not prep
          </span>
        </div>
      </div>
    );
  }
  if (kind !== "heatmap") return null;
  // Build N discrete color bands from 0..maxDistance using the same palette
  // as the heatmap (dark red = under-reduced, dark blue = over-reduced).
  const maxDistance = 1.4;
  const bands = Math.max(1, Math.round(maxDistance / step));
  const swatches: string[] = [];
  for (let i = 0; i < bands; i++) {
    const t = (i + 0.5) / bands;
    swatches.push(bandColor(1 - t)); // visual: warm on left, cool on right
  }
  const labels: string[] = [`<${step.toFixed(1)}`];
  for (let i = 1; i <= bands; i++) {
    labels.push((i * step).toFixed(1));
  }
  labels[labels.length - 1] = `>${(bands * step).toFixed(1)}`;
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-white/90 px-3 py-2 shadow-md ring-1 ring-[#cbd6e2] backdrop-blur">
      <div className="flex items-end gap-3">
        <div>
          <div className="flex h-4 overflow-hidden rounded-sm">
            {swatches.map((c, i) => (
              <div
                key={i}
                style={{ background: c, width: 28 }}
                className="h-full"
              />
            ))}
          </div>
        </div>
        <div className="flex gap-1 pb-4">
          {([0.1, 0.2] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onStep(s)}
              className={[
                "h-7 w-9 rounded text-[11px] font-medium ring-1 transition",
                step === s
                  ? "bg-[#dbeafe] text-[#1d4ed8] ring-[#93c5fd]"
                  : "bg-white text-[#1c1f24] ring-[#cbd6e2] hover:bg-[#f3f6fa]",
              ].join(" ")}
            >
              {s.toFixed(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Discrete band color matching three-utils.ts STOPS (red→blue across t∈[0,1]).
function bandColor(t: number) {
  const STOPS: [number, number, number][] = [
    [0.1, 0.11, 0.43],
    [0.12, 0.23, 0.62],
    [0.12, 0.53, 0.84],
    [0.12, 0.75, 0.56],
    [0.25, 0.79, 0.3],
    [0.84, 0.81, 0.12],
    [0.91, 0.5, 0.12],
    [0.84, 0.16, 0.12],
    [0.48, 0.04, 0.1],
  ];
  const x = Math.max(0, Math.min(1, t)) * (STOPS.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = STOPS[i];
  const b = STOPS[Math.min(STOPS.length - 1, i + 1)];
  const r = Math.round((a[0] + (b[0] - a[0]) * f) * 255);
  const g = Math.round((a[1] + (b[1] - a[1]) * f) * 255);
  const bb = Math.round((a[2] + (b[2] - a[2]) * f) * 255);
  return `rgb(${r},${g},${bb})`;
}

// Small label / value row for the undercut metrics.
export function Metric({
  label,
  value,
  detail,
  bad,
}: {
  label: string;
  value: string;
  detail?: string;
  bad?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-[#5a6270]">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span
          className={[
            "font-mono text-[12.5px] font-semibold",
            bad ? "text-[#c41f1f]" : "text-[#1c7d4d]",
          ].join(" ")}
        >
          {value}
        </span>
        {detail && (
          <span className="font-mono text-[10px] text-[#a0a8b4]">{detail}</span>
        )}
      </span>
    </div>
  );
}

export function SizeRow({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-[#1c1f24]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-[#5a6675]">
          {value.toFixed(1)} mm
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#2a8fd8]"
      />
    </div>
  );
}

// SectionPanel — right-side column rendering the pre/tx cross-section curve for
// each section with five mm distance measurements.
export function SectionPanel({ data }: { data: CrossSectionData[] }) {
  return (
    <div className="flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-[#cbd6e2] bg-[#f4f7fa] p-3">
      <div className="flex items-center gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-wide text-[#1c1f24]">
          Cross-sections
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10.5px] text-[#6b7686]">
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-4 bg-[#1c1f24]" />
            tx
          </span>
          <span className="flex items-center gap-1">
            <svg width="16" height="2">
              <line
                x1="0"
                y1="1"
                x2="16"
                y2="1"
                stroke="#7a8597"
                strokeDasharray="3 2"
              />
            </svg>
            pre
          </span>
        </div>
      </div>
      {data.map((d) => (
        <SectionCard key={d.id} data={d} />
      ))}
    </div>
  );
}

function SectionCard({ data }: { data: CrossSectionData }) {
  // Per-card zoom + rotation of the 2D plot. Rotation spins all (x,y) points
  // around the original bounds center; zoom shrinks the visible window.
  const [zoom, setZoom] = useState(1);
  const [rotDeg, setRotDeg] = useState(0);
  const W = 332;
  const H = 220;
  const PAD = 18;
  const rot = (rotDeg * Math.PI) / 180;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  // Rotate around the center of the original (unpadded) bounds.
  const cx0 = (data.bounds.xMin + data.bounds.xMax) / 2;
  const cy0 = (data.bounds.yMin + data.bounds.yMax) / 2;
  const rx = (x: number, y: number) =>
    cosR * (x - cx0) - sinR * (y - cy0) + cx0;
  const ry = (x: number, y: number) =>
    sinR * (x - cx0) + cosR * (y - cy0) + cy0;
  // Recompute bounds from rotated segment endpoints so the rotated content
  // still fits the panel before zoom.
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const arr of [data.txSegments, data.preSegments]) {
    for (let i = 0; i < arr.length; i += 2) {
      const x = rx(arr[i], arr[i + 1]);
      const y = ry(arr[i], arr[i + 1]);
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
  }
  if (!isFinite(xMin)) {
    xMin = data.bounds.xMin;
    xMax = data.bounds.xMax;
    yMin = data.bounds.yMin;
    yMax = data.bounds.yMax;
  }
  // Padding for label headroom.
  const xPad = Math.max(0.5, (xMax - xMin) * 0.05);
  const yPad = Math.max(0.5, (yMax - yMin) * 0.15);
  xMin -= xPad;
  xMax += xPad;
  yMin -= yPad;
  yMax += yPad;
  // Zoom shrinks the visible window around its center.
  const cxV = (xMin + xMax) / 2;
  const cyV = (yMin + yMax) / 2;
  const spanX = (xMax - xMin) / zoom || 1;
  const spanY = (yMax - yMin) / zoom || 1;
  xMin = cxV - spanX / 2;
  xMax = cxV + spanX / 2;
  yMin = cyV - spanY / 2;
  yMax = cyV + spanY / 2;
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (H - spanY * scale) / 2;
  const toX = (x: number) => offX + (x - xMin) * scale;
  // Y is flipped: world up should render as visual up.
  const toY = (y: number) => H - offY - (y - yMin) * scale;
  // Apply rotation as part of the projection.
  const px = (x: number, y: number) => toX(rx(x, y));
  const py = (x: number, y: number) => toY(ry(x, y));
  const segPath = (arr: Float32Array): string => {
    let s = "";
    for (let i = 0; i < arr.length; i += 4) {
      const x1 = px(arr[i], arr[i + 1]);
      const y1 = py(arr[i], arr[i + 1]);
      const x2 = px(arr[i + 2], arr[i + 3]);
      const y2 = py(arr[i + 2], arr[i + 3]);
      s += `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} `;
    }
    return s;
  };
  const colorHex = `#${data.color.toString(16).padStart(6, "0")}`;
  return (
    <div className="rounded-lg border border-[#cbd6e2] bg-white p-2 shadow-sm">
      <div className="mb-1 flex items-center gap-2 px-1">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ background: colorHex }}
        />
        <span className="text-[11px] font-semibold text-[#1c1f24]">
          Cut #{data.id + 1}
        </span>
        <span className="ml-auto text-[10.5px] text-[#6b7686]">
          {data.measurements.length > 0
            ? `avg ${(
                data.measurements.reduce((a, b) => a + b.mm, 0) /
                data.measurements.length
              ).toFixed(2)} mm`
            : "—"}
        </span>
      </div>
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="w-9 text-[10px] font-medium text-[#6b7686]">Zoom</span>
        <input
          type="range"
          min={1}
          max={6}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#2a8fd8]"
        />
        <span className="w-10 text-right text-[10px] tabular-nums text-[#6b7686]">
          {zoom.toFixed(1)}×
        </span>
      </div>
      <div className="mb-1 flex items-center gap-2 px-1">
        <span className="w-9 text-[10px] font-medium text-[#6b7686]">
          Rotate
        </span>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotDeg}
          onChange={(e) => setRotDeg(Number(e.target.value))}
          className="flex-1 accent-[#2a8fd8]"
        />
        <span className="w-10 text-right text-[10px] tabular-nums text-[#6b7686]">
          {rotDeg}°
        </span>
        <button
          type="button"
          onClick={() => {
            setZoom(1);
            setRotDeg(0);
          }}
          className="rounded border border-[#cbd6e2] bg-white px-1.5 py-0.5 text-[9.5px] font-medium text-[#1c1f24] hover:bg-[#f4f7fa]"
          title="Reset zoom and rotation"
        >
          Reset
        </button>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
      >
        <rect x="0" y="0" width={W} height={H} fill="#fafbfc" rx="6" />
        {/* Pre profile (reference): dashed gray */}
        <path
          d={segPath(data.preSegments)}
          stroke="#7a8597"
          strokeWidth="1.4"
          strokeDasharray="3 2"
          fill="none"
        />
        {/* Tx profile (treatment): solid in the section color */}
        <path
          d={segPath(data.txSegments)}
          stroke={colorHex}
          strokeWidth="1.6"
          fill="none"
        />
        {/* Distance lines + labels */}
        {data.measurements.map((m, i) => {
          const x1 = px(m.tx[0], m.tx[1]);
          const y1 = py(m.tx[0], m.tx[1]);
          const x2 = px(m.pre[0], m.pre[1]);
          const y2 = py(m.pre[0], m.pre[1]);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#1c1f24"
                strokeWidth="1"
              />
              <circle cx={x1} cy={y1} r="2" fill={colorHex} />
              <circle cx={x2} cy={y2} r="2" fill="#7a8597" />
              <rect
                x={mx - 18}
                y={my - 8}
                width="36"
                height="14"
                rx="3"
                fill="white"
                stroke="#cbd6e2"
              />
              <text
                x={mx}
                y={my + 3}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="600"
                fill="#1c1f24"
              >
                {m.mm.toFixed(2)} mm
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
