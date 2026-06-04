import type { ViewId, AnalysisStatus } from './types';

const VIEWS: { id: ViewId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'reduction',
    label: 'Reduction',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3h7v7H3z"/><path d="M14 3h7v7h-7z"/><path d="M3 14h7v7H3z"/><path d="M14 14h7v7h-7z"/>
      </svg>
    ),
  },
  {
    id: 'undercuts',
    label: 'Undercuts',
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V12"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 2a10 10 0 0 0-10 10"/>
      </svg>
    ),
  },
];

interface CopilotViewSwitcherProps {
  activeView: ViewId | null;
  analysisProgress: Record<ViewId, AnalysisStatus>;
  onViewChange: (view: ViewId) => void;
}

export default function CopilotViewSwitcher({ activeView, analysisProgress, onViewChange }: CopilotViewSwitcherProps) {
  return (
    <div className="px-4 pt-3 pb-3 shrink-0">
      <div
        className="flex gap-2 rounded-xl p-1"
        style={{ background: '#f1f5f9', border: '1px solid #e2e8f0' }}
      >
        {VIEWS.map(({ id, label, icon }) => {
          const status = analysisProgress[id];
          const isActive = activeView === id;
          const isAvailable = status === 'complete';
          const isRunning = status === 'running';

          return (
            <button
              key={id}
              onClick={() => isAvailable && onViewChange(id)}
              disabled={!isAvailable}
              className="relative flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[10px] text-[13px] font-semibold transition-all duration-200"
              style={{
                background: isActive
                  ? '#fff'
                  : 'transparent',
                color: isActive ? '#009ACE' : isAvailable ? '#64748b' : '#b0b8c4',
                cursor: isAvailable ? 'pointer' : 'default',
                boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,154,206,0.12)' : 'none',
              }}
            >
              <span style={{ opacity: isAvailable || isActive ? 1 : 0.45 }}>{icon}</span>
              <span style={{ opacity: isAvailable || isActive ? 1 : 0.45 }}>{label}</span>

              {/* Running spinner dot */}
              {isRunning && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#009ACE] animate-pulse" />
              )}

              {/* Ready indicator — only when not active */}
              {isAvailable && !isActive && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
