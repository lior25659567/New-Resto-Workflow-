import { font, space, radius } from '@/design-system/tokens';

interface UndercutMetrics {
  undercutPct: number;
  undercutAreaMm2: number;
  totalAreaMm2: number;
  maxOverhangDeg: number;
  meanOverhangDeg: number;
}

interface CopilotUndercutStatsProps {
  metrics?: UndercutMetrics;
}

const MOCK_METRICS: UndercutMetrics = {
  undercutPct: 0.8,
  undercutAreaMm2: 1.24,
  totalAreaMm2: 155.6,
  maxOverhangDeg: 12.4,
  meanOverhangDeg: 4.7,
};

export default function CopilotUndercutStats({ metrics = MOCK_METRICS }: CopilotUndercutStatsProps) {
  const isClear = metrics.undercutPct < 0.2;
  const isWarning = metrics.undercutPct >= 0.2 && metrics.undercutPct < 1.0;

  const statusColor = isClear ? '#16a34a' : isWarning ? '#d97706' : '#dc2626';
  const statusBg = isClear ? '#f0fdf4' : isWarning ? '#fffbeb' : '#fef2f2';
  const statusBorder = isClear ? '#bbf7d0' : isWarning ? '#fde68a' : '#fecaca';
  const statusText = isClear
    ? 'Path is clear — prep draws out cleanly'
    : isWarning
      ? 'Minor undercuts detected'
      : 'Significant undercuts — reduce red zones';

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Status card */}
      <div
        style={{
          background: statusBg,
          border: `1px solid ${statusBorder}`,
          borderRadius: radius.lg,
          padding: `${space[3]} ${space[4]}`,
        }}
      >
        <div style={{ fontSize: font.size['2xs'], fontWeight: font.weight.bold, color: statusColor, marginBottom: 4 }}>
          {metrics.undercutPct.toFixed(1)}% Undercut Area
        </div>
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          {statusText}
        </div>
      </div>

      {/* Metrics grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: space[2],
        }}
      >
        <MetricCard label="Undercut Area" value={`${metrics.undercutAreaMm2.toFixed(2)} mm²`} />
        <MetricCard label="Total Prep Area" value={`${metrics.totalAreaMm2.toFixed(1)} mm²`} />
        <MetricCard label="Max Overhang" value={`${metrics.maxOverhangDeg.toFixed(1)}°`} />
        <MetricCard label="Mean Overhang" value={`${metrics.meanOverhangDeg.toFixed(1)}°`} />
      </div>

      {/* Legend */}
      <div style={{ fontSize: '10px', color: '#64748b' }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#22c55e' }} />
          <span>Draftable (clear path)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-2 rounded-sm" style={{ background: '#ef4444' }} />
          <span>Undercut (blocked)</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: radius.md,
        padding: space[3],
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '9px', color: '#94a3b8', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: font.size['2xs'], fontWeight: font.weight.bold, color: '#1e293b' }}>{value}</div>
    </div>
  );
}
