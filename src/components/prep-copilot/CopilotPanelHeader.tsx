import type { MaterialType, CaseType } from './types';
import { CASE_TYPE_LABELS } from './constants';

interface CopilotPanelHeaderProps {
  onClose: () => void;
  selectedMaterial: MaterialType;
  onMaterialChange: (material: MaterialType) => void;
  statusText?: string;
  caseType?: CaseType;
  prepToothAda?: number | null;
  linkedTeeth?: number[];
}

export default function CopilotPanelHeader({
  onClose,
  statusText,
  caseType,
  prepToothAda,
  linkedTeeth,
}: CopilotPanelHeaderProps) {
  const caseLabel = caseType ? CASE_TYPE_LABELS[caseType] : null;

  const contextLine = (() => {
    if (!caseType || !prepToothAda) return statusText || '1 prep detected';
    if (caseType === 'bridge' && linkedTeeth && linkedTeeth.length >= 2) {
      return `Bridge — Teeth ${linkedTeeth.map(a => `#${a}`).join(', ')}`;
    }
    return `Crown — Tooth #${prepToothAda}`;
  })();

  return (
    <div className="shrink-0">
      <div
        className="flex items-center justify-between px-4 py-3.5 border-b border-[#e5e7eb]"
        style={{
          background: 'linear-gradient(90deg, rgba(0,154,206,0.08) 0%, rgba(139,92,246,0.08) 100%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <svg width="20" height="20" viewBox="0 0 36 36" fill="none">
            <defs>
              <linearGradient id="hdr-sparkle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#009ACE" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path
              d="M18 3 L20.5 13.5 L31 18 L20.5 22.5 L18 33 L15.5 22.5 L5 18 L15.5 13.5 Z"
              fill="url(#hdr-sparkle)"
            />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight text-[#1e293b]">Prep Copilot</span>
          <span className="text-[11px] font-semibold text-[#8B5CF6] bg-[#8B5CF6]/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            AI
          </span>
        </div>
        <div className="flex items-center gap-2">
          {caseLabel && (
            <span
              className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: caseType === 'bridge' ? 'rgba(139,92,246,0.10)' : 'rgba(0,154,206,0.10)',
                color: caseType === 'bridge' ? '#7c3aed' : '#0077a3',
              }}
            >
              {caseLabel}
            </span>
          )}
          {!caseLabel && contextLine && (
            <span className="text-[12px] text-[#64748b]">{contextLine}</span>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-black/5 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
