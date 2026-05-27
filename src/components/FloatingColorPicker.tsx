import { useState } from 'react';

interface FloatingColorPickerProps {
  currentColor: string;
  onColorChange: (color: string) => void;
}

const QUICK_COLORS = [
  '#E0EDF4', '#BDD8EA', '#A3C4D9', '#E0F2FE',
  '#C5EAD0', '#D1FAE5', '#F1F5F9', '#E2E8F0',
  '#FEF3C7', '#FECACA', '#1a1a2e', '#2d2d2d',
  '#1e293b', '#374151', '#111827', '#0F172A',
];

const QUICK_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e, #16213e)',
  'linear-gradient(135deg, #2d2d2d, #1a1a1a)',
  'linear-gradient(180deg, #e2e8f0, #cbd5e1)',
  'linear-gradient(135deg, #E0EDF4, #a3c4d9)',
  'radial-gradient(circle, #C5EAD0, #a7f3d0)',
  'radial-gradient(circle, #fef3c7, #fed7aa)',
  'linear-gradient(180deg, #374151, #1f2937)',
  'radial-gradient(circle, #1e293b, #312e81)',
];

function isLight(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 140;
}

function isGradient(bg: string): boolean {
  return bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient');
}

function isLightBg(bg: string): boolean {
  if (isGradient(bg)) {
    const colors = bg.match(/#[0-9a-fA-F]{6}/g);
    if (colors && colors.length > 0) return isLight(colors[0]);
    return true;
  }
  return isLight(bg);
}

function bgStyle(bg: string): React.CSSProperties {
  return isGradient(bg) ? { background: bg } : { backgroundColor: bg };
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

type GradType = 'linear' | 'radial';

export default function FloatingColorPicker({ currentColor, onColorChange }: FloatingColorPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const light = isLightBg(currentColor);
  const gradient = isGradient(currentColor);

  // Custom gradient builder state
  const [gradType, setGradType] = useState<GradType>('linear');
  const [stop1, setStop1] = useState('#E0EDF4');
  const [stop2, setStop2] = useState('#a3c4d9');
  const [angle, setAngle] = useState(135);
  const [hex1, setHex1] = useState('#E0EDF4');
  const [hex2, setHex2] = useState('#a3c4d9');

  const buildGradient = (type: GradType, s1: string, s2: string, a: number) =>
    type === 'linear'
      ? `linear-gradient(${a}deg, ${s1}, ${s2})`
      : `radial-gradient(circle, ${s1}, ${s2})`;

  const applyBuilderGradient = () => {
    onColorChange(buildGradient(gradType, stop1, stop2, angle));
  };

  const handleSwap = () => {
    setStop1(stop2);
    setStop2(stop1);
    setHex1(hex2);
    setHex2(hex1);
    onColorChange(buildGradient(gradType, stop2, stop1, angle));
  };

  const handleHex1Submit = () => {
    if (isValidHex(hex1)) { setStop1(hex1.trim()); onColorChange(buildGradient(gradType, hex1.trim(), stop2, angle)); }
  };

  const handleHex2Submit = () => {
    if (isValidHex(hex2)) { setStop2(hex2.trim()); onColorChange(buildGradient(gradType, stop1, hex2.trim(), angle)); }
  };

  const inputSt: React.CSSProperties = {
    backgroundColor: light ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
    color: light ? '#0f172a' : '#f1f5f9',
    border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`,
  };

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-6 left-6 z-[9999] w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        style={{
          ...bgStyle(currentColor),
          border: `2.5px solid ${light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)'}`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}
        title="Change canvas color"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={light ? '#334155' : '#e2e8f0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-[9999]" style={{ width: 260 }}>
      <div
        className="rounded-2xl shadow-2xl overflow-hidden"
        style={{
          backgroundColor: light ? 'rgba(255,255,255,0.95)' : 'rgba(15,23,42,0.95)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: light ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full shrink-0"
              style={{ ...bgStyle(currentColor), border: `1.5px solid ${light ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.3)'}` }}
            />
            <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: light ? '#475569' : '#94a3b8' }}>
              Canvas {gradient ? 'Gradient' : 'Color'}
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            className="w-6 h-6 rounded flex items-center justify-center transition-colors"
            style={{ color: light ? '#94a3b8' : '#64748b' }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = light ? '#f1f5f9' : 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            title="Minimize"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-3">
          {/* Solid Colors */}
          <span className="text-[9px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: light ? '#94a3b8' : '#64748b' }}>
            Solid Colors
          </span>
          <div className="grid grid-cols-8 gap-1 mb-3">
            {QUICK_COLORS.map(c => {
              const active = currentColor.toLowerCase() === c.toLowerCase();
              const sw = isLight(c);
              return (
                <button
                  key={c}
                  onClick={() => { onColorChange(c); setShowBuilder(false); }}
                  className="w-full aspect-square rounded transition-all hover:scale-125"
                  style={{
                    backgroundColor: c,
                    border: active ? '2px solid #009ACE' : `1px solid ${sw ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'}`,
                    boxShadow: active ? '0 0 0 2px rgba(0,154,206,0.3)' : 'none',
                  }}
                />
              );
            })}
          </div>

          {/* Preset Gradients */}
          <span className="text-[9px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: light ? '#94a3b8' : '#64748b' }}>
            Gradients
          </span>
          <div className="grid grid-cols-4 gap-1 mb-3">
            {QUICK_GRADIENTS.map(g => {
              const active = currentColor === g;
              return (
                <button
                  key={g}
                  onClick={() => { onColorChange(g); setShowBuilder(false); }}
                  className="w-full h-5 rounded transition-all hover:scale-110"
                  style={{
                    background: g,
                    border: active ? '2px solid #009ACE' : '1px solid rgba(0,0,0,0.08)',
                    boxShadow: active ? '0 0 0 2px rgba(0,154,206,0.3)' : 'none',
                  }}
                />
              );
            })}
          </div>

          {/* Native color picker + hex (for solid) */}
          <div className="flex items-center gap-2 mb-2">
            <label
              className="w-8 h-8 rounded-md shrink-0 cursor-pointer overflow-hidden relative"
              style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
              title="Pick any color"
            >
              <input
                type="color"
                value={gradient ? '#E0EDF4' : currentColor}
                onChange={e => { onColorChange(e.target.value); setShowBuilder(false); }}
                className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
              />
              <div className="w-full h-full" style={bgStyle(currentColor)} />
            </label>
            <span className="text-[11px] font-mono truncate" style={{ color: light ? '#64748b' : '#94a3b8', maxWidth: 140 }}>
              {gradient ? 'Gradient' : currentColor}
            </span>
          </div>

          {/* Divider */}
          <div className="my-2" style={{ height: 1, backgroundColor: light ? '#e2e8f0' : 'rgba(255,255,255,0.08)' }} />

          {/* Custom Gradient Builder toggle */}
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="w-full flex items-center justify-between py-1.5 px-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors"
            style={{ color: light ? '#64748b' : '#94a3b8' }}
          >
            Custom Gradient
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: showBuilder ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showBuilder && (
            <div className="mt-2">
              {/* Live preview */}
              <div
                className="w-full h-8 rounded-lg mb-2"
                style={{
                  background: buildGradient(gradType, stop1, stop2, angle),
                  border: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
                }}
              />

              {/* Linear / Radial toggle */}
              <div className="flex rounded-lg mb-2 overflow-hidden" style={{ border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}` }}>
                {(['linear', 'radial'] as GradType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setGradType(t); onColorChange(buildGradient(t, stop1, stop2, angle)); }}
                    className="flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: gradType === t ? '#009ACE' : 'transparent',
                      color: gradType === t ? '#fff' : (light ? '#64748b' : '#94a3b8'),
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Color 1 */}
              <div className="flex items-center gap-1.5 mb-1.5">
                <label
                  className="w-6 h-6 rounded shrink-0 cursor-pointer overflow-hidden relative"
                  style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
                >
                  <input
                    type="color"
                    value={stop1}
                    onChange={e => { setStop1(e.target.value); setHex1(e.target.value); onColorChange(buildGradient(gradType, e.target.value, stop2, angle)); }}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: stop1 }} />
                </label>
                <input
                  type="text"
                  value={hex1}
                  onChange={e => setHex1(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleHex1Submit(); }}
                  onBlur={handleHex1Submit}
                  maxLength={7}
                  className="flex-1 px-2 py-1 rounded text-[11px] font-mono outline-none"
                  style={inputSt}
                />

                {/* Swap button */}
                <button
                  onClick={handleSwap}
                  className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors"
                  style={{ color: light ? '#64748b' : '#94a3b8' }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = light ? '#f1f5f9' : 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  title="Swap colors"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="7 16 3 12 7 8" />
                    <polyline points="17 8 21 12 17 16" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                  </svg>
                </button>
              </div>

              {/* Color 2 */}
              <div className="flex items-center gap-1.5 mb-2">
                <label
                  className="w-6 h-6 rounded shrink-0 cursor-pointer overflow-hidden relative"
                  style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
                >
                  <input
                    type="color"
                    value={stop2}
                    onChange={e => { setStop2(e.target.value); setHex2(e.target.value); onColorChange(buildGradient(gradType, stop1, e.target.value, angle)); }}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: stop2 }} />
                </label>
                <input
                  type="text"
                  value={hex2}
                  onChange={e => setHex2(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleHex2Submit(); }}
                  onBlur={handleHex2Submit}
                  maxLength={7}
                  className="flex-1 px-2 py-1 rounded text-[11px] font-mono outline-none"
                  style={inputSt}
                />
              </div>

              {/* Angle (only for linear) */}
              {gradType === 'linear' && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-semibold shrink-0" style={{ color: light ? '#64748b' : '#94a3b8' }}>Angle</span>
                  <input
                    type="range"
                    min={0} max={360} step={1}
                    value={angle}
                    onChange={e => { setAngle(Number(e.target.value)); onColorChange(buildGradient(gradType, stop1, stop2, Number(e.target.value))); }}
                    className="flex-1 accent-[#009ACE]"
                  />
                  <input
                    type="number"
                    min={0} max={360}
                    value={angle}
                    onChange={e => { setAngle(Number(e.target.value)); onColorChange(buildGradient(gradType, stop1, stop2, Number(e.target.value))); }}
                    className="w-12 px-1 py-1 rounded text-[11px] font-mono outline-none text-center"
                    style={inputSt}
                  />
                  <span className="text-[9px]" style={{ color: light ? '#94a3b8' : '#64748b' }}>&deg;</span>
                </div>
              )}

              {/* Apply button */}
              <button
                onClick={applyBuilderGradient}
                className="w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all hover:opacity-90"
                style={{ backgroundColor: '#009ACE', color: '#fff' }}
              >
                Apply Gradient
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
