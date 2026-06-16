import { color, font, space, radius } from '@/design-system/tokens';

interface SectionMeasurement {
  position: number;
  distance: number;
}

interface CopilotSectionPanelProps {
  measurements?: SectionMeasurement[];
  viewMode: 'clip' | 'overlay';
  onViewModeChange: (mode: 'clip' | 'overlay') => void;
}

const MOCK_MEASUREMENTS: SectionMeasurement[] = [
  { position: 0.15, distance: 1.12 },
  { position: 0.32, distance: 0.95 },
  { position: 0.50, distance: 1.34 },
  { position: 0.68, distance: 1.08 },
  { position: 0.85, distance: 0.78 },
];

export default function CopilotSectionPanel({
  measurements = MOCK_MEASUREMENTS,
  viewMode,
  onViewModeChange,
}: CopilotSectionPanelProps) {
  const svgWidth = 240;
  const svgHeight = 120;
  const padding = 24;
  const plotW = svgWidth - padding * 2;
  const plotH = svgHeight - padding * 2;

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* View mode toggle */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: font.size['2xs'], color: '#64748b', fontWeight: font.weight.semibold }}>
          View:
        </span>
        {(['clip', 'overlay'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onViewModeChange(mode)}
            style={{
              fontSize: font.size['2xs'],
              fontWeight: font.weight.semibold,
              padding: `${space[1]} ${space[3]}`,
              borderRadius: radius.md,
              border: 'none',
              background: viewMode === mode ? color.primary : '#f1f5f9',
              color: viewMode === mode ? '#fff' : '#64748b',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* 2D Profile SVG */}
      <div
        style={{
          background: '#f8fafc',
          borderRadius: radius.lg,
          border: '1px solid #e2e8f0',
          padding: space[2],
        }}
      >
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={`grid-${t}`}
              x1={padding}
              y1={padding + plotH * (1 - t)}
              x2={padding + plotW}
              y2={padding + plotH * (1 - t)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
          ))}

          {/* Simulated prep profile (post-treatment) — solid blue */}
          <path
            d={`M ${padding} ${padding + plotH * 0.7} Q ${padding + plotW * 0.25} ${padding + plotH * 0.3} ${padding + plotW * 0.5} ${padding + plotH * 0.25} Q ${padding + plotW * 0.75} ${padding + plotH * 0.3} ${padding + plotW} ${padding + plotH * 0.7}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2}
          />

          {/* Simulated pre-treatment profile — dashed gray */}
          <path
            d={`M ${padding} ${padding + plotH * 0.55} Q ${padding + plotW * 0.25} ${padding + plotH * 0.15} ${padding + plotW * 0.5} ${padding + plotH * 0.1} Q ${padding + plotW * 0.75} ${padding + plotH * 0.15} ${padding + plotW} ${padding + plotH * 0.55}`}
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />

          {/* Measurement lines */}
          {measurements.map((m, i) => {
            const x = padding + plotW * m.position;
            const y1 = padding + plotH * (0.15 + m.position * 0.15);
            const y2 = y1 + plotH * 0.15 + (m.distance / 2) * plotH * 0.2;
            return (
              <g key={i}>
                <line x1={x} y1={y1} x2={x} y2={y2} stroke="#f59e0b" strokeWidth={1} />
                <circle cx={x} cy={y1} r={2} fill="#f59e0b" />
                <circle cx={x} cy={y2} r={2} fill="#f59e0b" />
                <text
                  x={x}
                  y={y2 + 10}
                  textAnchor="middle"
                  fontSize={8}
                  fill="#92400e"
                  fontWeight="600"
                >
                  {m.distance.toFixed(1)}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex justify-between px-2" style={{ fontSize: '9px', color: '#94a3b8' }}>
          <span>Mesial</span>
          <span>Distal</span>
        </div>
      </div>

      {/* Measurement table */}
      <div style={{ fontSize: font.size['2xs'], color: '#334155' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-0.5 rounded" style={{ background: '#3b82f6' }} />
          <span>Post-treatment (prep)</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-0.5 rounded border-dashed border-t" style={{ borderColor: '#94a3b8' }} />
          <span>Pre-treatment (reference)</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: space[1],
            textAlign: 'center',
          }}
        >
          {measurements.map((m, i) => (
            <div
              key={i}
              style={{
                background: m.distance < 0.8 ? '#fef2f2' : '#f0fdf4',
                borderRadius: radius.sm,
                padding: `${space[1]} 0`,
                border: `1px solid ${m.distance < 0.8 ? '#fecaca' : '#bbf7d0'}`,
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: font.weight.bold, color: m.distance < 0.8 ? '#dc2626' : '#16a34a' }}>
                {m.distance.toFixed(2)}
              </div>
              <div style={{ fontSize: '8px', color: '#94a3b8' }}>mm</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
