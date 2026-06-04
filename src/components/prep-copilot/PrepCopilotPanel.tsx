import { motion, AnimatePresence } from 'framer-motion';
import CopilotPanelHeader from './CopilotPanelHeader';
import CopilotViewSwitcher from './CopilotViewSwitcher';
import CopilotMaterialSelector from './CopilotMaterialSelector';
import CopilotUndercutBrush from './CopilotUndercutBrush';
import CopilotActionBar from './CopilotActionBar';
import CopilotChat from './CopilotChat';
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
}

export default function PrepCopilotPanel({
  onClose,
  state,
  statusText,
  onViewChange,
  onMaterialChange,
  toolbarCollapsed = true,
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

      {/* Undercut region selector — only shown in Undercuts view */}
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
