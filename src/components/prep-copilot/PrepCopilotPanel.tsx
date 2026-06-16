import { motion, AnimatePresence } from 'framer-motion';
import CopilotPanelHeader from './CopilotPanelHeader';
import CopilotViewSwitcher from './CopilotViewSwitcher';
import CopilotMaterialSelector from './CopilotMaterialSelector';
import CopilotUndercutBrush from './CopilotUndercutBrush';
import CopilotActionBar from './CopilotActionBar';
import CopilotChat from './CopilotChat';
import CopilotReductionStats from './CopilotReductionStats';
import CopilotUndercutStats from './CopilotUndercutStats';
import CopilotSectionPanel from './CopilotSectionPanel';
import { PANEL_WIDTH } from './constants';
import type { PrepCopilotState, ViewId, MaterialType } from './types';

interface PrepCopilotPanelProps {
  onClose: () => void;
  state: PrepCopilotState;
  statusText: string;
  onViewChange: (view: ViewId) => void;
  onMaterialChange: (material: MaterialType) => void;
  onZoneSelect: (zone: import('./types').ZoneId) => void;
  onInsertionPathChange: (updates: Partial<import('./types').InsertionPathAngles>) => void;
  onResetInsertionPath: () => void;
  onToggleBridgeMode: () => void;
  toolbarCollapsed?: boolean;
  brushEnabled?: boolean;
  onBrushToggle?: () => void;
  brushSize?: 'S' | 'M' | 'L';
  onBrushSizeChange?: (size: 'S' | 'M' | 'L') => void;
  eraseMode?: boolean;
  onEraseModeChange?: (v: boolean) => void;
  paintedCount?: number;
  onBrushClear?: () => void;
}

export default function PrepCopilotPanel({
  onClose,
  state,
  statusText,
  onViewChange,
  onMaterialChange,
  toolbarCollapsed = true,
  brushEnabled = false,
  onBrushToggle,
  brushSize = 'M',
  onBrushSizeChange,
  eraseMode = false,
  onEraseModeChange,
  paintedCount = 0,
  onBrushClear,
}: PrepCopilotPanelProps) {
  const {
    activeView,
    analysisProgress,
    overallProgress,
    selectedMaterial,
    caseType,
    prepToothAda,
    linkedTeeth,
  } = state;

  const panelTop = toolbarCollapsed ? 16 + 76 + 8 : 16 + 100 + 8;

  return (
    <motion.div
      initial={{ x: PANEL_WIDTH }}
      animate={{ x: 0 }}
      exit={{ x: PANEL_WIDTH }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="absolute z-[45] flex flex-col bg-white shadow-[-8px_0_24px_rgba(15,23,42,0.12)] rounded-[12px] overflow-hidden border border-[#e2e8f0]"
      style={{
        width: PANEL_WIDTH,
        right: 16,
        bottom: 16,
        top: panelTop,
        transition: 'top 0.25s cubic-bezier(0,0,1,1)',
      }}
    >
      <CopilotPanelHeader
        onClose={onClose}
        selectedMaterial={selectedMaterial}
        onMaterialChange={onMaterialChange}
        statusText={statusText || undefined}
        caseType={caseType}
        prepToothAda={prepToothAda}
        linkedTeeth={linkedTeeth}
      />

      <CopilotViewSwitcher
        activeView={activeView}
        analysisProgress={analysisProgress}
        onViewChange={onViewChange}
      />

      {/* Brush toolbar */}
      <div className="px-4 py-2 border-b border-[#f1f5f9] flex items-center gap-2">
        <button
          onClick={onBrushToggle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
          style={{
            background: brushEnabled ? '#009ACE' : '#f1f5f9',
            color: brushEnabled ? '#fff' : '#64748b',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18.37 2.63L14 7l-1.59-1.59a2 2 0 00-2.82 0L8 7l9 9 1.59-1.59a2 2 0 000-2.82L17 10l4.37-4.37a2.12 2.12 0 10-3-3z"/>
            <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7"/>
          </svg>
          {brushEnabled ? 'Painting' : 'Paint Prep'}
        </button>
        {brushEnabled && (
          <>
            {(['S', 'M', 'L'] as const).map((s) => (
              <button
                key={s}
                onClick={() => onBrushSizeChange?.(s)}
                className="w-6 h-6 rounded text-[10px] font-bold"
                style={{
                  background: brushSize === s ? '#e0f2fe' : '#f8fafc',
                  color: brushSize === s ? '#0284c7' : '#94a3b8',
                  border: `1px solid ${brushSize === s ? '#7dd3fc' : '#e2e8f0'}`,
                }}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => onEraseModeChange?.(!eraseMode)}
              className="px-2 py-1 rounded text-[10px] font-semibold"
              style={{
                background: eraseMode ? '#fef2f2' : '#f8fafc',
                color: eraseMode ? '#dc2626' : '#94a3b8',
                border: `1px solid ${eraseMode ? '#fecaca' : '#e2e8f0'}`,
              }}
            >
              {eraseMode ? 'Erasing' : 'Erase'}
            </button>
            {paintedCount > 0 && (
              <button onClick={onBrushClear} className="px-2 py-1 rounded text-[10px] text-[#94a3b8] hover:text-[#64748b]">
                Clear ({paintedCount})
              </button>
            )}
          </>
        )}
      </div>

      {/* Material selector — only shown inside Reduction view */}
      <AnimatePresence initial={false}>
        {activeView === 'reduction' && (
          <motion.div
            key="material-strip"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden shrink-0"
          >
            <div className="px-4 pb-3 pt-1 border-b border-[#f1f5f9]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wide">Material</span>
              </div>
              <CopilotMaterialSelector
                selected={selectedMaterial}
                onChange={onMaterialChange}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reduction stats — only shown in Reduction view */}
      <AnimatePresence initial={false}>
        {activeView === 'reduction' && (
          <motion.div
            key="reduction-stats"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden shrink-0 border-b border-[#f1f5f9]"
          >
            <CopilotReductionStats selectedMaterial={selectedMaterial} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Undercut region selector + stats — only shown in Undercuts view */}
      <AnimatePresence initial={false}>
        {activeView === 'undercuts' && (
          <motion.div
            key="undercut-brush"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden shrink-0"
          >
            <CopilotUndercutBrush />
            <CopilotUndercutStats />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cross-section panel — only shown in Section view */}
      <AnimatePresence initial={false}>
        {activeView === 'section' && (
          <motion.div
            key="section-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden shrink-0 border-b border-[#f1f5f9]"
          >
            <CopilotSectionPanel
              viewMode="clip"
              onViewModeChange={() => {}}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CopilotChat
        activeView={activeView}
        selectedMaterial={selectedMaterial}
      />

      <CopilotActionBar
        activeView={activeView}
        analysisProgress={analysisProgress}
        overallProgress={overallProgress}
        onViewChange={onViewChange}
      />
    </motion.div>
  );
}
