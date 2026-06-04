import type { ViewId, AnalysisStatus } from './types';

interface CopilotActionBarProps {
  activeView: ViewId | null;
  analysisProgress: Record<ViewId, AnalysisStatus>;
  overallProgress: number;
  onViewChange: (view: ViewId) => void;
}

const NEXT_VIEW: Partial<Record<ViewId, ViewId>> = {
  reduction: 'undercuts',
};

export default function CopilotActionBar({ activeView, analysisProgress, overallProgress, onViewChange }: CopilotActionBarProps) {
  const allComplete = ['reduction', 'undercuts'].every(v => analysisProgress[v as ViewId] === 'complete');
  const isAnalyzing = ['reduction', 'undercuts'].some(v => analysisProgress[v as ViewId] === 'running');

  if (isAnalyzing && !activeView) {
    return (
      <div className="px-4 py-3 border-t border-[#f1f5f9] shrink-0">
        <div className="flex items-center gap-2 mb-2">
          <svg className="animate-spin h-3.5 w-3.5 text-[#009ACE]" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
          </svg>
          <span className="text-[12px] font-medium text-[#64748b]">Analyzing prep…</span>
          <span className="ml-auto text-[11px] font-semibold text-[#009ACE]">{overallProgress}%</span>
        </div>
        <div className="w-full h-1 rounded-full bg-[#e5e7eb] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#009ACE] transition-all duration-300"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>
    );
  }

  if (!activeView) return null;

  const nextView = NEXT_VIEW[activeView];
  const nextAvailable = nextView && analysisProgress[nextView] === 'complete';

  return (
    <div className="px-4 py-3 border-t border-[#f1f5f9] shrink-0">
      {nextView && nextAvailable ? (
        <button
          onClick={() => onViewChange(nextView)}
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, #009ACE 0%, #0077a8 100%)',
            color: '#fff',
            boxShadow: '0 2px 8px rgba(0,154,206,0.28)',
          }}
        >
          Check Undercuts →
        </button>
      ) : allComplete ? (
        <div
          className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-center"
          style={{ background: '#dcfce7', color: '#166534' }}
        >
          Analysis complete
        </div>
      ) : null}
    </div>
  );
}
