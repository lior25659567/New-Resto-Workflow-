import { useState } from 'react';
import { color, font, space, radius } from '@/design-system/tokens';
import { MATERIALS, regionMinMm, regionTargetMm } from './analysis/reductionStats';
import type { MaterialType } from './types';

type Region = 'all' | 'marginal' | 'occlusal';

interface CopilotReductionStatsProps {
  selectedMaterial: MaterialType;
}

const MATERIAL_MAP: Record<MaterialType, string> = {
  'bruxzir-esthetic': 'zirconia',
  'bruxzir-full-strength': 'zirconia',
  'emax': 'emax',
  'lithium-disilicate': 'emax',
  'pfm': 'pfm',
};

const MOCK_STATS: Record<Region, { min: number; mean: number; pass: boolean; pctBelow: number }> = {
  all: { min: 0.62, mean: 1.18, pass: true, pctBelow: 1.4 },
  marginal: { min: 0.48, mean: 0.72, pass: false, pctBelow: 8.2 },
  occlusal: { min: 0.91, mean: 1.52, pass: true, pctBelow: 0.5 },
};

export default function CopilotReductionStats({ selectedMaterial }: CopilotReductionStatsProps) {
  const [region, setRegion] = useState<Region>('all');

  const matId = MATERIAL_MAP[selectedMaterial] ?? 'zirconia';
  const mat = MATERIALS.find(m => m.id === matId) ?? MATERIALS[0];
  const minThreshold = regionMinMm(region, mat);
  const targetThreshold = regionTargetMm(region, mat);

  const stats = MOCK_STATS[region];

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Region selector */}
      <div className="flex items-center gap-2">
        <span style={{ fontSize: font.size['2xs'], color: '#64748b', fontWeight: font.weight.semibold }}>
          Region:
        </span>
        {(['all', 'marginal', 'occlusal'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            style={{
              fontSize: font.size['2xs'],
              fontWeight: font.weight.semibold,
              padding: `${space[1]} ${space[3]}`,
              borderRadius: radius.md,
              border: 'none',
              background: region === r ? color.primary : '#f1f5f9',
              color: region === r ? '#fff' : '#64748b',
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Threshold info */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: space[2],
        }}
      >
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: radius.md,
            padding: space[3],
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: 2 }}>Minimum</div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#334155' }}>
            {minThreshold.toFixed(1)} mm
          </div>
        </div>
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: radius.md,
            padding: space[3],
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: 2 }}>Target</div>
          <div style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#334155' }}>
            {targetThreshold.toFixed(1)} mm
          </div>
        </div>
      </div>

      {/* Pass/fail card */}
      <div
        style={{
          background: stats.pass ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${stats.pass ? '#bbf7d0' : '#fecaca'}`,
          borderRadius: radius.lg,
          padding: `${space[3]} ${space[4]}`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            style={{
              fontSize: font.size['2xs'],
              fontWeight: font.weight.bold,
              color: stats.pass ? '#16a34a' : '#dc2626',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            {stats.pass ? 'Pass' : 'Under-Reduced'}
          </span>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            {stats.pctBelow.toFixed(1)}% below min
          </span>
        </div>

        <div className="flex gap-4">
          <div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Min depth</div>
            <div style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#1e293b' }}>
              {stats.min.toFixed(2)} mm
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>Mean depth</div>
            <div style={{ fontSize: font.size.sm, fontWeight: font.weight.bold, color: '#1e293b' }}>
              {stats.mean.toFixed(2)} mm
            </div>
          </div>
        </div>
      </div>

      {/* Material info */}
      <div style={{ fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
        Material: {mat.name} — Pass threshold: &lt;2% below minimum
      </div>
    </div>
  );
}
