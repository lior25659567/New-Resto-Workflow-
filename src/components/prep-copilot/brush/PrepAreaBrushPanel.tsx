import { motion } from 'framer-motion';
import { Eraser, Paintbrush, Trash2 } from 'lucide-react';
import { color, radius, font, space } from '@/design-system/tokens';

type BrushSize = 'S' | 'M' | 'L';

interface PrepAreaBrushPanelProps {
  brushSize: BrushSize;
  onBrushSizeChange: (size: BrushSize) => void;
  eraseMode: boolean;
  onEraseModeChange: (v: boolean) => void;
  paintedCount: number;
  onClear: () => void;
  onRunAnalysis: () => void;
}

const SIZES: { key: BrushSize; px: number }[] = [
  { key: 'S', px: 12 },
  { key: 'M', px: 18 },
  { key: 'L', px: 26 },
];

export function PrepAreaBrushPanel({
  brushSize,
  onBrushSizeChange,
  eraseMode,
  onEraseModeChange,
  paintedCount,
  onClear,
  onRunAnalysis,
}: PrepAreaBrushPanelProps) {
  const canAnalyze = paintedCount >= 100;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: space[4],
        padding: space[4],
      }}
    >
      {/* Header */}
      <div>
        <h4
          style={{
            fontSize: font.size.sm,
            fontWeight: font.weight.semibold,
            color: 'rgba(255,255,255,0.9)',
            margin: 0,
          }}
        >
          Define Prep Area
        </h4>
        <p
          style={{
            fontSize: font.size['2xs'],
            color: 'rgba(255,255,255,0.5)',
            margin: `${space[1]} 0 0`,
          }}
        >
          Paint on the model to select the prep region
        </p>
      </div>

      {/* Brush size selector */}
      <div>
        <span style={{ fontSize: font.size['2xs'], color: 'rgba(255,255,255,0.6)' }}>
          Brush Size
        </span>
        <div style={{ display: 'flex', gap: space[2], marginTop: space[2] }}>
          {SIZES.map(({ key, px }) => (
            <button
              key={key}
              onClick={() => onBrushSizeChange(key)}
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                border: `1.5px solid ${brushSize === key ? color.primary : 'rgba(255,255,255,0.15)'}`,
                background: brushSize === key ? 'rgba(0,154,206,0.15)' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  width: px,
                  height: px,
                  borderRadius: '50%',
                  background: brushSize === key ? color.primary : 'rgba(255,255,255,0.4)',
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: space[2] }}>
        <button
          onClick={() => onEraseModeChange(false)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[2],
            padding: `${space[2]} ${space[3]}`,
            borderRadius: radius.md,
            border: `1.5px solid ${!eraseMode ? color.primary : 'rgba(255,255,255,0.15)'}`,
            background: !eraseMode ? 'rgba(0,154,206,0.15)' : 'transparent',
            color: !eraseMode ? color.primary : 'rgba(255,255,255,0.6)',
            fontSize: font.size['2xs'],
            fontWeight: font.weight.medium,
            cursor: 'pointer',
          }}
        >
          <Paintbrush size={14} />
          Paint
        </button>
        <button
          onClick={() => onEraseModeChange(true)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space[2],
            padding: `${space[2]} ${space[3]}`,
            borderRadius: radius.md,
            border: `1.5px solid ${eraseMode ? color.danger : 'rgba(255,255,255,0.15)'}`,
            background: eraseMode ? 'rgba(212,63,88,0.15)' : 'transparent',
            color: eraseMode ? color.danger : 'rgba(255,255,255,0.6)',
            fontSize: font.size['2xs'],
            fontWeight: font.weight.medium,
            cursor: 'pointer',
          }}
        >
          <Eraser size={14} />
          Erase
        </button>
      </div>

      {/* Status */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${space[2]} ${space[3]}`,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: radius.sm,
        }}
      >
        <span style={{ fontSize: font.size['2xs'], color: 'rgba(255,255,255,0.6)' }}>
          {paintedCount.toLocaleString()} vertices selected
        </span>
        <button
          onClick={onClear}
          disabled={paintedCount === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[1],
            padding: `${space[1]} ${space[2]}`,
            background: 'transparent',
            border: 'none',
            color: paintedCount > 0 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)',
            fontSize: font.size['2xs'],
            cursor: paintedCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          <Trash2 size={12} />
          Clear
        </button>
      </div>

      {/* Run Analysis button */}
      <button
        disabled={!canAnalyze}
        onClick={onRunAnalysis}
        style={{
          width: '100%',
          padding: `${space[3]} ${space[4]}`,
          background: canAnalyze ? color.primary : 'rgba(255,255,255,0.1)',
          color: canAnalyze ? '#fff' : 'rgba(255,255,255,0.4)',
          border: 'none',
          borderRadius: radius.md,
          fontSize: font.size.sm,
          fontWeight: font.weight.semibold,
          cursor: canAnalyze ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
        }}
      >
        Run Analysis
      </button>

      {!canAnalyze && paintedCount > 0 && (
        <span style={{ fontSize: font.size['2xs'], color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          Select at least 100 vertices to run analysis
        </span>
      )}
    </motion.div>
  );
}
