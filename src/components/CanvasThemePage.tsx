import { useState } from 'react';

interface CanvasThemePageProps {
  onBackToHome: () => void;
  onApplyToFlow: (color: string) => void;
}

// ── Dark mode presets ────────────────────────────────────────────────────────

const DARK_PRESETS = [
  { id: 'midnight', label: 'Midnight', color: '#1a1a2e', desc: 'Deep navy-black' },
  { id: 'charcoal', label: 'Charcoal', color: '#2d2d2d', desc: 'Neutral dark gray' },
  { id: 'slate',    label: 'Slate',    color: '#1e293b', desc: 'Blue-tinted dark' },
];

// ── Color palette swatches ───────────────────────────────────────────────────

const PALETTE = [
  { color: '#E0EDF4', label: 'Default' },
  { color: '#BDD8EA', label: 'Sky' },
  { color: '#A3C4D9', label: 'Steel Blue' },
  { color: '#E0F2FE', label: 'Ice' },
  { color: '#C5EAD0', label: 'Mint' },
  { color: '#D1FAE5', label: 'Emerald Light' },
  { color: '#A7F3D0', label: 'Green Tint' },
  { color: '#F1F5F9', label: 'Gray 100' },
  { color: '#E2E8F0', label: 'Gray 200' },
  { color: '#CBD5E1', label: 'Gray 300' },
  { color: '#94A3B8', label: 'Gray 400' },
  { color: '#FEF3C7', label: 'Amber Light' },
  { color: '#FDE68A', label: 'Yellow' },
  { color: '#FECACA', label: 'Rose Light' },
  { color: '#FED7AA', label: 'Orange Light' },
  { color: '#374151', label: 'Gray 700' },
  { color: '#111827', label: 'Gray 900' },
  { color: '#0F172A', label: 'Slate 900' },
];

// ── Gradient presets ─────────────────────────────────────────────────────────

const GRADIENT_PRESETS = [
  { id: 'dark-ui',     label: 'Dark UI',      value: 'linear-gradient(135deg, #1a1a2e, #16213e)', desc: 'Deep navy app feel' },
  { id: 'charcoal-g',  label: 'Charcoal',     value: 'linear-gradient(135deg, #2d2d2d, #1a1a1a)', desc: 'Neutral dark' },
  { id: 'slate-g',     label: 'Slate',        value: 'linear-gradient(180deg, #1e293b, #0f172a)', desc: 'Blue-tinted dark' },
  { id: 'dark-gray',   label: 'Dark Gray',    value: 'linear-gradient(180deg, #374151, #1f2937)', desc: 'Professional dark' },
  { id: 'silver',      label: 'Silver',       value: 'linear-gradient(180deg, #e2e8f0, #cbd5e1)', desc: 'Soft gray' },
  { id: 'light-mist',  label: 'Light Mist',   value: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)', desc: 'Barely-there gray' },
  { id: 'ocean',       label: 'Ocean',        value: 'linear-gradient(135deg, #E0EDF4, #a3c4d9)', desc: 'Cool blue blend' },
  { id: 'mint-fresh',  label: 'Mint Fresh',   value: 'linear-gradient(135deg, #C5EAD0, #a7f3d0)', desc: 'Soft green' },
  { id: 'warm-sand',   label: 'Warm Sand',    value: 'linear-gradient(135deg, #fef3c7, #fed7aa)', desc: 'Warm amber tone' },
  { id: 'rose-glow',   label: 'Rose Glow',    value: 'linear-gradient(135deg, #fecaca, #fda4af)', desc: 'Soft pink warmth' },
  { id: 'twilight',    label: 'Twilight',     value: 'linear-gradient(135deg, #1e293b, #312e81)', desc: 'Night sky indigo' },
  { id: 'aurora',      label: 'Aurora',       value: 'linear-gradient(135deg, #065f46, #1e3a5f)', desc: 'Deep teal to navy' },
  { id: 'spotlight',   label: 'Spotlight',    value: 'radial-gradient(circle, #e2e8f0, #94a3b8)', desc: 'Radial gray glow' },
  { id: 'deep-well',   label: 'Deep Well',    value: 'radial-gradient(circle, #1e293b, #0f172a)', desc: 'Radial dark vignette' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace('#', '').match(/^([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

function isLight(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 140;
}

function isLightBg(bg: string): boolean {
  if (bg.startsWith('linear-gradient') || bg.startsWith('radial-gradient')) {
    const colors = bg.match(/#[0-9a-fA-F]{6}/g);
    if (colors && colors.length > 0) return isLight(colors[0]);
    return true;
  }
  return isLight(bg);
}

function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

const DEFAULT_COLOR = '#E0EDF4';

type Mode = 'solid' | 'gradient';
type GradType = 'linear' | 'radial';

// ── Component ────────────────────────────────────────────────────────────────

export default function CanvasThemePage({ onBackToHome, onApplyToFlow }: CanvasThemePageProps) {
  const [mode, setMode] = useState<Mode>('solid');
  const [previewBg, setPreviewBg] = useState<string>(DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState(DEFAULT_COLOR);

  // Gradient custom builder state
  const [gradType, setGradType] = useState<GradType>('linear');
  const [gradStop1, setGradStop1] = useState('#E0EDF4');
  const [gradStop2, setGradStop2] = useState('#a3c4d9');
  const [gradAngle, setGradAngle] = useState(135);
  const [hexStop1Input, setHexStop1Input] = useState('#E0EDF4');
  const [hexStop2Input, setHexStop2Input] = useState('#a3c4d9');

  // RGB inputs for solid mode
  const [rgbR, setRgbR] = useState(214);
  const [rgbG, setRgbG] = useState(231);
  const [rgbB, setRgbB] = useState(241);

  const light = isLightBg(previewBg);

  const pickSolid = (c: string) => {
    setPreviewBg(c);
    setHexInput(c);
    const rgb = hexToRgb(c);
    if (rgb) { setRgbR(rgb.r); setRgbG(rgb.g); setRgbB(rgb.b); }
  };

  const pickGradient = (g: string) => {
    setPreviewBg(g);
  };

  const handleHexSubmit = () => {
    if (isValidHex(hexInput)) pickSolid(hexInput.trim());
  };

  const handleRgbSubmit = () => {
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const hex = rgbToHex(clamp(rgbR), clamp(rgbG), clamp(rgbB));
    pickSolid(hex);
  };

  const buildGrad = (type: GradType, s1: string, s2: string, a: number) =>
    type === 'linear'
      ? `linear-gradient(${a}deg, ${s1}, ${s2})`
      : `radial-gradient(circle, ${s1}, ${s2})`;

  const applyCustomGradient = () => {
    pickGradient(buildGrad(gradType, gradStop1, gradStop2, gradAngle));
  };

  const handleSwapStops = () => {
    const old1 = gradStop1;
    const old2 = gradStop2;
    setGradStop1(old2);
    setGradStop2(old1);
    setHexStop1Input(old2);
    setHexStop2Input(old1);
    pickGradient(buildGrad(gradType, old2, old1, gradAngle));
  };

  const handleStop1HexSubmit = () => {
    if (isValidHex(hexStop1Input)) {
      setGradStop1(hexStop1Input.trim());
      pickGradient(buildGrad(gradType, hexStop1Input.trim(), gradStop2, gradAngle));
    }
  };

  const handleStop2HexSubmit = () => {
    if (isValidHex(hexStop2Input)) {
      setGradStop2(hexStop2Input.trim());
      pickGradient(buildGrad(gradType, gradStop1, hexStop2Input.trim(), gradAngle));
    }
  };

  // Shared styles
  const sectionTitle = (text: string) => (
    <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: light ? '#64748b' : '#94a3b8' }}>
      {text}
    </h2>
  );

  const inputStyle: React.CSSProperties = {
    backgroundColor: light ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
    color: light ? '#0f172a' : '#f1f5f9',
    border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.12)'}`,
  };

  return (
    <div className="flex flex-col h-screen w-full" style={{ background: previewBg, transition: 'background 0.3s' }}>
      {/* Top bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 border-b shrink-0"
        style={{
          backgroundColor: light ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.45)',
          borderColor: light ? '#e2e8f0' : 'rgba(255,255,255,0.1)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <button
          onClick={onBackToHome}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{ color: light ? '#64748b' : '#94a3b8' }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = light ? '#f1f5f9' : 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Home
        </button>
        <div style={{ width: 1, height: 20, backgroundColor: light ? '#e2e8f0' : 'rgba(255,255,255,0.15)' }} />
        <span className="text-sm font-semibold" style={{ color: light ? '#0f172a' : '#f1f5f9' }}>
          Canvas Theme
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center overflow-auto py-10 px-6">
        <div
          className="w-full max-w-2xl rounded-2xl p-8 shadow-xl"
          style={{
            backgroundColor: light ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(16px)',
            border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.08)'}`,
          }}
        >
          {/* ── Mode Toggle: Solid / Gradient ── */}
          <div className="flex items-center justify-center mb-8">
            <div
              className="flex rounded-xl p-1"
              style={{
                backgroundColor: light ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {(['solid', 'gradient'] as Mode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="px-6 py-2 rounded-lg text-sm font-semibold transition-all capitalize"
                  style={{
                    backgroundColor: mode === m ? '#009ACE' : 'transparent',
                    color: mode === m ? '#fff' : (light ? '#64748b' : '#94a3b8'),
                    boxShadow: mode === m ? '0 2px 8px rgba(0,154,206,0.3)' : 'none',
                  }}
                >
                  {m === 'solid' ? 'Solid Color' : 'Gradient'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'solid' ? (
            <>
              {/* ── Dark Mode Presets ── */}
              {sectionTitle('Dark Mode Presets')}
              <div className="grid grid-cols-3 gap-3 mb-8">
                {DARK_PRESETS.map(p => {
                  const active = previewBg.toLowerCase() === p.color.toLowerCase();
                  return (
                    <button
                      key={p.id}
                      onClick={() => pickSolid(p.color)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl transition-all"
                      style={{
                        backgroundColor: p.color,
                        border: active ? '2.5px solid #009ACE' : '2.5px solid transparent',
                        boxShadow: active ? '0 0 0 3px rgba(0,154,206,0.25)' : 'none',
                      }}
                    >
                      <span className="text-sm font-semibold text-white">{p.label}</span>
                      <span className="text-[11px] text-gray-400">{p.desc}</span>
                      <span className="text-[10px] font-mono text-gray-500">{p.color}</span>
                    </button>
                  );
                })}
              </div>

              {/* ── Color Palette ── */}
              {sectionTitle('Color Palette')}
              <div className="grid grid-cols-6 gap-2 mb-6">
                {PALETTE.map(s => {
                  const active = previewBg.toLowerCase() === s.color.toLowerCase();
                  const swatchLight = isLight(s.color);
                  return (
                    <button
                      key={s.color}
                      onClick={() => pickSolid(s.color)}
                      title={`${s.label} (${s.color})`}
                      className="relative group aspect-square rounded-lg transition-all hover:scale-110"
                      style={{
                        backgroundColor: s.color,
                        border: active ? '2.5px solid #009ACE' : `1px solid ${swatchLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)'}`,
                        boxShadow: active ? '0 0 0 3px rgba(0,154,206,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
                      }}
                    >
                      {active && (
                        <svg className="absolute inset-0 m-auto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={swatchLight ? '#009ACE' : '#fff'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      <span
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: light ? '#1e293b' : '#f1f5f9', color: light ? '#fff' : '#0f172a' }}
                      >
                        {s.color}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Custom Color: Hex + RGB ── */}
              {sectionTitle('Custom Color')}

              {/* Hex row */}
              <div className="flex items-center gap-3 mb-3">
                <label
                  className="w-10 h-10 rounded-lg shrink-0 cursor-pointer overflow-hidden relative"
                  style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
                  title="Open color picker"
                >
                  <input
                    type="color"
                    value={isValidHex(hexInput) ? hexInput : previewBg.startsWith('#') ? previewBg : '#E0EDF4'}
                    onChange={e => pickSolid(e.target.value)}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: isValidHex(hexInput) ? hexInput : DEFAULT_COLOR }} />
                </label>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: light ? '#64748b' : '#94a3b8' }}>HEX</span>
                <input
                  type="text"
                  value={hexInput}
                  onChange={e => setHexInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleHexSubmit(); }}
                  onBlur={handleHexSubmit}
                  placeholder="#E0EDF4"
                  maxLength={7}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none transition-colors"
                  style={inputStyle}
                />
                <button
                  onClick={handleHexSubmit}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#009ACE', color: '#fff' }}
                >
                  Set
                </button>
              </div>

              {/* RGB row */}
              <div className="flex items-center gap-2 mb-8">
                <span className="text-[11px] font-semibold shrink-0 w-10 text-center" style={{ color: light ? '#64748b' : '#94a3b8' }}>RGB</span>
                <span className="text-[11px] font-semibold shrink-0" style={{ color: light ? '#64748b' : '#94a3b8' }}>R</span>
                <input
                  type="number" min={0} max={255}
                  value={rgbR}
                  onChange={e => setRgbR(Number(e.target.value))}
                  onBlur={handleRgbSubmit}
                  onKeyDown={e => { if (e.key === 'Enter') handleRgbSubmit(); }}
                  className="w-16 px-2 py-2 rounded-lg text-sm font-mono outline-none text-center"
                  style={inputStyle}
                />
                <span className="text-[11px] font-semibold shrink-0" style={{ color: light ? '#64748b' : '#94a3b8' }}>G</span>
                <input
                  type="number" min={0} max={255}
                  value={rgbG}
                  onChange={e => setRgbG(Number(e.target.value))}
                  onBlur={handleRgbSubmit}
                  onKeyDown={e => { if (e.key === 'Enter') handleRgbSubmit(); }}
                  className="w-16 px-2 py-2 rounded-lg text-sm font-mono outline-none text-center"
                  style={inputStyle}
                />
                <span className="text-[11px] font-semibold shrink-0" style={{ color: light ? '#64748b' : '#94a3b8' }}>B</span>
                <input
                  type="number" min={0} max={255}
                  value={rgbB}
                  onChange={e => setRgbB(Number(e.target.value))}
                  onBlur={handleRgbSubmit}
                  onKeyDown={e => { if (e.key === 'Enter') handleRgbSubmit(); }}
                  className="w-16 px-2 py-2 rounded-lg text-sm font-mono outline-none text-center"
                  style={inputStyle}
                />
                <button
                  onClick={handleRgbSubmit}
                  className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#009ACE', color: '#fff' }}
                >
                  Set
                </button>
              </div>
            </>
          ) : (
            <>
              {/* ── Gradient Presets ── */}
              {sectionTitle('Gradient Presets')}
              <div className="grid grid-cols-3 gap-3 mb-8">
                {GRADIENT_PRESETS.map(g => {
                  const active = previewBg === g.value;
                  return (
                    <button
                      key={g.id}
                      onClick={() => pickGradient(g.value)}
                      className="flex flex-col items-center gap-2 rounded-xl transition-all overflow-hidden"
                      style={{
                        border: active ? '2.5px solid #009ACE' : '2.5px solid transparent',
                        boxShadow: active ? '0 0 0 3px rgba(0,154,206,0.25)' : '0 1px 4px rgba(0,0,0,0.1)',
                      }}
                    >
                      <div
                        className="w-full h-16 rounded-t-lg"
                        style={{ background: g.value }}
                      />
                      <div className="pb-3 px-2 text-center">
                        <span className="text-[12px] font-semibold block" style={{ color: light ? '#1e293b' : '#f1f5f9' }}>{g.label}</span>
                        <span className="text-[10px]" style={{ color: light ? '#94a3b8' : '#64748b' }}>{g.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Custom Gradient Builder ── */}
              {sectionTitle('Custom Gradient')}

              {/* Live gradient preview bar */}
              <div
                className="w-full h-12 rounded-xl mb-4"
                style={{
                  background: buildGrad(gradType, gradStop1, gradStop2, gradAngle),
                  border: `1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}`,
                }}
              />

              {/* Linear / Radial toggle */}
              <div className="flex rounded-xl mb-4 overflow-hidden" style={{ border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}` }}>
                {(['linear', 'radial'] as GradType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => { setGradType(t); }}
                    className="flex-1 py-2 text-[11px] font-semibold uppercase tracking-wider transition-all capitalize"
                    style={{
                      backgroundColor: gradType === t ? '#009ACE' : 'transparent',
                      color: gradType === t ? '#fff' : (light ? '#64748b' : '#94a3b8'),
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Stop 1 */}
              <div className="flex items-center gap-2 mb-3">
                <label
                  className="w-8 h-8 rounded-md shrink-0 cursor-pointer overflow-hidden relative"
                  style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
                >
                  <input
                    type="color"
                    value={gradStop1}
                    onChange={e => { setGradStop1(e.target.value); setHexStop1Input(e.target.value); }}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: gradStop1 }} />
                </label>
                <span className="text-[11px] font-semibold shrink-0 w-12" style={{ color: light ? '#64748b' : '#94a3b8' }}>Start</span>
                <input
                  type="text"
                  value={hexStop1Input}
                  onChange={e => setHexStop1Input(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStop1HexSubmit(); }}
                  onBlur={handleStop1HexSubmit}
                  placeholder="#E0EDF4"
                  maxLength={7}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none"
                  style={inputStyle}
                />

                {/* Swap button */}
                <button
                  onClick={handleSwapStops}
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all hover:scale-110"
                  style={{
                    backgroundColor: light ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
                    color: light ? '#64748b' : '#94a3b8',
                  }}
                  title="Swap colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 014-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 01-4 4H3" />
                  </svg>
                </button>
              </div>

              {/* Stop 2 */}
              <div className="flex items-center gap-2 mb-3">
                <label
                  className="w-8 h-8 rounded-md shrink-0 cursor-pointer overflow-hidden relative"
                  style={{ border: `1.5px solid ${light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.2)'}` }}
                >
                  <input
                    type="color"
                    value={gradStop2}
                    onChange={e => { setGradStop2(e.target.value); setHexStop2Input(e.target.value); }}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="w-full h-full" style={{ backgroundColor: gradStop2 }} />
                </label>
                <span className="text-[11px] font-semibold shrink-0 w-12" style={{ color: light ? '#64748b' : '#94a3b8' }}>End</span>
                <input
                  type="text"
                  value={hexStop2Input}
                  onChange={e => setHexStop2Input(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleStop2HexSubmit(); }}
                  onBlur={handleStop2HexSubmit}
                  placeholder="#a3c4d9"
                  maxLength={7}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none"
                  style={inputStyle}
                />
              </div>

              {/* Angle (only for linear) */}
              {gradType === 'linear' && (
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[11px] font-semibold shrink-0 w-12" style={{ color: light ? '#64748b' : '#94a3b8' }}>Angle</span>
                <input
                  type="range"
                  min={0} max={360} step={1}
                  value={gradAngle}
                  onChange={e => setGradAngle(Number(e.target.value))}
                  className="flex-1 accent-[#009ACE]"
                />
                <input
                  type="number"
                  min={0} max={360}
                  value={gradAngle}
                  onChange={e => setGradAngle(Number(e.target.value))}
                  className="w-16 px-2 py-2 rounded-lg text-sm font-mono outline-none text-center"
                  style={inputStyle}
                />
                <span className="text-[11px]" style={{ color: light ? '#94a3b8' : '#64748b' }}>deg</span>
              </div>
              )}

              {/* Apply custom gradient button */}
              <button
                onClick={applyCustomGradient}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 mb-8"
                style={{
                  backgroundColor: light ? '#f1f5f9' : 'rgba(255,255,255,0.08)',
                  color: light ? '#1e293b' : '#f1f5f9',
                  border: `1px solid ${light ? '#e2e8f0' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                Apply Custom Gradient
              </button>
            </>
          )}

          {/* ── Apply & Go to Test Flow ── */}
          <button
            onClick={() => onApplyToFlow(previewBg)}
            className="w-full py-3.5 rounded-xl text-base font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#009ACE',
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,154,206,0.35)',
            }}
          >
            Apply & Open Test Flow
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
