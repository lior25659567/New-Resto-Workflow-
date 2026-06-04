import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ZONES = ['Occlusal', 'Buccal', 'Lingual', 'Mesial', 'Distal'] as const;
type Zone = typeof ZONES[number];

const BRUSH_SIZES = [
  { label: 'S', value: 4, title: 'Small' },
  { label: 'M', value: 8, title: 'Medium' },
  { label: 'L', value: 14, title: 'Large' },
] as const;

interface CopilotUndercutBrushProps {
  onSelectionChange?: (zones: Zone[]) => void;
}

export default function CopilotUndercutBrush({ onSelectionChange }: CopilotUndercutBrushProps) {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [brushSize, setBrushSize] = useState<4 | 8 | 14>(8);
  const [selectedZones, setSelectedZones] = useState<Set<Zone>>(new Set());
  const [isPainting, setIsPainting] = useState(false);

  const toggleZone = (zone: Zone) => {
    setSelectedZones(prev => {
      const next = new Set(prev);
      if (next.has(zone)) {
        next.delete(zone);
      } else {
        next.add(zone);
      }
      onSelectionChange?.(Array.from(next));
      return next;
    });
  };

  const clearAll = () => {
    setSelectedZones(new Set());
    onSelectionChange?.([]);
  };

  const selectAll = () => {
    const all = new Set(ZONES);
    setSelectedZones(all);
    onSelectionChange?.(Array.from(all));
  };

  const switchMode = (m: 'auto' | 'manual') => {
    setMode(m);
    if (m === 'auto') {
      setSelectedZones(new Set());
      onSelectionChange?.([]);
    }
  };

  return (
    <div className="px-4 pb-3 pt-1 border-b border-[#f1f5f9] shrink-0">
      {/* Mode toggle */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wide">Region of Interest</span>

        <div
          className="ml-auto flex rounded-lg overflow-hidden border border-[#e2e8f0]"
          style={{ background: '#f8fafc' }}
        >
          {(['auto', 'manual'] as const).map(m => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="px-2.5 py-1 text-[11px] font-semibold transition-all capitalize"
              style={{
                background: mode === m ? '#009ACE' : 'transparent',
                color: mode === m ? '#fff' : '#64748b',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {mode === 'manual' && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            {/* Brush size + clear row */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[10px] text-[#94a3b8] font-medium shrink-0">Brush</span>
              <div className="flex gap-1">
                {BRUSH_SIZES.map(({ label, value, title }) => (
                  <button
                    key={value}
                    title={title}
                    onClick={() => setBrushSize(value as 4 | 8 | 14)}
                    className="flex items-center justify-center rounded-md transition-all"
                    style={{
                      width: 26,
                      height: 26,
                      background: brushSize === value ? '#009ACE' : '#f1f5f9',
                      color: brushSize === value ? '#fff' : '#64748b',
                      border: brushSize === value ? '1px solid #009ACE' : '1px solid #e2e8f0',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Brush cursor preview */}
              <div
                className="flex items-center justify-center rounded-full border-2 border-dashed shrink-0 transition-all"
                style={{
                  width: brushSize * 2.5,
                  height: brushSize * 2.5,
                  borderColor: '#009ACE',
                  opacity: 0.6,
                  minWidth: 16,
                }}
              />

              <button
                onClick={clearAll}
                className="ml-auto text-[10px] font-semibold text-[#94a3b8] hover:text-[#475569] transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Painting hint */}
            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2.5"
              style={{
                background: isPainting ? 'rgba(0,154,206,0.07)' : '#f8fafc',
                border: `1px solid ${isPainting ? 'rgba(0,154,206,0.25)' : '#e5e7eb'}`,
                transition: 'all 0.15s',
              }}
              onMouseDown={() => setIsPainting(true)}
              onMouseUp={() => setIsPainting(false)}
              onMouseLeave={() => setIsPainting(false)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isPainting ? '#009ACE' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 3a3 3 0 0 1 0 6L8 19l-4 1 1-4Z"/><path d="m15 6 3 3"/>
              </svg>
              <span
                className="text-[11px] font-medium"
                style={{ color: isPainting ? '#009ACE' : '#94a3b8' }}
              >
                {isPainting ? 'Painting on model…' : 'Paint on the 3D model to select regions'}
              </span>
              {isPainting && (
                <motion.div
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-[#009ACE]"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>

            {/* Zone chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-[#94a3b8] font-medium">
                  {selectedZones.size === 0 ? 'No zones selected' : `${selectedZones.size} zone${selectedZones.size > 1 ? 's' : ''} selected`}
                </span>
                <button
                  onClick={selectedZones.size === ZONES.length ? clearAll : selectAll}
                  className="text-[10px] font-semibold text-[#009ACE] hover:underline"
                >
                  {selectedZones.size === ZONES.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ZONES.map(zone => {
                  const active = selectedZones.has(zone);
                  return (
                    <button
                      key={zone}
                      onClick={() => toggleZone(zone)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: active ? 'rgba(0,154,206,0.10)' : '#f1f5f9',
                        color: active ? '#009ACE' : '#64748b',
                        border: `1px solid ${active ? 'rgba(0,154,206,0.3)' : '#e2e8f0'}`,
                      }}
                    >
                      {active && (
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#009ACE" strokeWidth="3" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                      {zone}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {mode === 'auto' && (
          <motion.div
            key="auto-hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: '#f8fafc', border: '1px solid #e5e7eb' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#009ACE" strokeWidth="2" strokeLinecap="round">
              <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2a10 10 0 0 0-10 10"/>
            </svg>
            <span className="text-[11px] text-[#64748b]">Analyzing all regions automatically</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
