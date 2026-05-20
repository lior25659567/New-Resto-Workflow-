import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CollapseButton from "../imports/CollapseButton";
import IconsMonochrome from "../imports/IconsMonochrome";
import IconsLiveFeedback from "../imports/IconsLiveFeedback";
import IconsPrepEdit from "../imports/IconsPrepEdit";
import IconsSwapScans from "../imports/IconsSwapScans";
import IconsUndo from "../imports/IconsUndo";
import PrepCopilotButton from "./prep-copilot/PrepCopilotButton";
import { UndoToast, useUndoToast } from "./UndoToast";
import type { ScanSnapshot } from "../hooks/useUndoHistory";

interface ToolbarScanProps {
  onPrepEditChange?: (isOpen: boolean) => void;
  onCopilotChange?: (isActive: boolean) => void;
  onCollapseChange?: (isCollapsed: boolean) => void;
  onAnyToolActiveChange?: (isActive: boolean) => void;
  onMonochromeChange?: (isMonochrome: boolean) => void;
  onUndoPanelOpenChange?: (isOpen: boolean, closeHandler?: () => void) => void;
  /** Undo state passed from ScanPageMultiLayer */
  undoState?: {
    canUndo: boolean;
    canRedo: boolean;
    stepInfo: string;
    lastLabel: string;
    past: ScanSnapshot[];
    future: ScanSnapshot[];
  };
  onUndo?: (action: "undo" | "redo" | "accept") => void;
  /** Which UI variant to use: 1=Bordered, 2=Borderless, 3=Compact, 4=Labeled, 5=Pill, 6=Icons, 7=Stacked, 8=H-Stack */
  undoVariant?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

export function ToolbarScan({
  onPrepEditChange,
  onCopilotChange,
  onCollapseChange,
  onAnyToolActiveChange,
  onMonochromeChange,
  onUndoPanelOpenChange,
  undoState,
  onUndo,
  undoVariant = 1,
}: ToolbarScanProps = {}) {
  const [selectedTool, setSelectedTool] = useState<number | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isPrepEditPanelOpen, setIsPrepEditPanelOpen] = useState(false);
  const [isCopilotActive, setIsCopilotActive] = useState(false);
  const [isUndoPanelOpen, setIsUndoPanelOpen] = useState(false);

  // Option 3 toast state
  const toast = useUndoToast();

  const tools: Array<{ id: number; component: React.ComponentType<any>; label: string; isAI?: boolean }> = [
    { id: 0, component: IconsMonochrome, label: "Monochrome" },
    { id: 1, component: IconsLiveFeedback, label: "Feedback" },
    { id: 2, component: IconsPrepEdit, label: "Prep edit" },
    { id: 3, component: IconsSwapScans, label: "Swap arches" },
    { id: 4, component: PrepCopilotButton, label: "Prep Copilot", isAI: true },
    { id: 5, component: IconsUndo, label: "Undo" },
  ];

  const handleToolClick = (toolId: number) => {
    const isCurrentlyActive =
      (toolId === 2 && isPrepEditPanelOpen) ||
      (toolId === 4 && isCopilotActive) ||
      (toolId === 5 && isUndoPanelOpen) ||
      (toolId !== 2 && toolId !== 4 && toolId !== 5 && selectedTool === toolId);

    // Close all panels first
    setIsPrepEditPanelOpen(false);
    onPrepEditChange?.(false);
    setIsCopilotActive(false);
    onCopilotChange?.(false);
    setIsUndoPanelOpen(false);
    onUndoPanelOpenChange?.(false);

    if (isCurrentlyActive) {
      setSelectedTool(null);
      onAnyToolActiveChange?.(false);
      onMonochromeChange?.(false);
    } else {
      setSelectedTool(toolId);
      onAnyToolActiveChange?.(true);
      onMonochromeChange?.(toolId === 0 || toolId === 5);
      if (toolId === 2) {
        setIsPrepEditPanelOpen(true);
        onPrepEditChange?.(true);
      } else if (toolId === 4) {
        setIsCopilotActive(true);
        onCopilotChange?.(true);
      } else if (toolId === 5) {
        setIsUndoPanelOpen(true);
        onUndoPanelOpenChange?.(true, handleUndoPanelClose);
      }
    }
  };

  const isButtonActive = (toolId: number) => {
    if (toolId === 0) return selectedTool === 0 || isUndoPanelOpen;
    if (toolId === 2) return isPrepEditPanelOpen;
    if (toolId === 4) return isCopilotActive;
    if (toolId === 5) return isUndoPanelOpen;
    return selectedTool === toolId;
  };

  const isUndoButtonEnabled = true;

  const handleUndoPanelClose = () => {
    setIsUndoPanelOpen(false);
    setSelectedTool(null);
    onAnyToolActiveChange?.(false);
    onUndoPanelOpenChange?.(false);
  };

  return (
    <div className="flex flex-col gap-4 items-end">
      {/* Toolbar */}
      <motion.div
        className="bg-white rounded-[8px] p-2 w-fit flex gap-2 items-center"
        layout
        transition={{ layout: { duration: 0.25, ease: [0, 0, 1, 1] } }}
      >
        {/* Tool Buttons */}
        <motion.div
          className={`flex ${isCollapsed ? 'gap-2' : 'gap-4'} items-center`}
          layout
          transition={{ duration: 0.25, ease: [0, 0, 1, 1] }}
        >
          {tools.map((tool) => {
            const ToolComponent = tool.component;
            const isSelected = isButtonActive(tool.id);
            const isDisabled = tool.id === 5 && !isUndoButtonEnabled;

            return (
              <motion.div
                key={tool.id}
                className="flex flex-col items-center justify-center relative"
                layout
                initial={false}
                transition={{ duration: 0.25, ease: [0, 0, 1, 1] }}
              >
                <button
                  onClick={() => !isDisabled && handleToolClick(tool.id)}
                  disabled={isDisabled}
                  className={`w-[60px] h-[60px] rounded-[10px] flex items-center justify-center transition-all duration-200 ${
                    isDisabled
                      ? 'bg-white opacity-30 cursor-not-allowed'
                      : tool.isAI
                      ? isSelected
                        ? 'shadow-[0_0_16px_rgba(0,200,220,0.35)]'
                        : 'bg-white hover:shadow-[0_0_12px_rgba(0,200,220,0.25)]'
                      : isSelected
                      ? 'bg-[#dff5fc] border border-[#00adef]'
                      : 'bg-white hover:bg-gray-50'
                  } active:scale-95 active:shadow-inner`}
                  style={
                    tool.isAI && isSelected
                      ? { background: 'linear-gradient(135deg, #A6E2F9 0%, #D4BCFA 100%)' }
                      : undefined
                  }
                >
                  <div className="w-[48px] h-[48px] flex items-center justify-center">
                    <ToolComponent />
                  </div>
                </button>
                <AnimatePresence mode="wait">
                  {!isCollapsed && (
                    <motion.p
                      key="label"
                      className={`text-[16px] leading-[20px] tracking-[-0.1504px] mt-1 transition-colors ${
                        isSelected ? 'text-[#408DC1]' : 'text-black'
                      }`}
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: 0.2, ease: [0, 0, 1, 1] }}
                    >
                      {tool.label}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Collapse/Expand Button */}
        <button
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            onCollapseChange?.(next);
          }}
          className="w-[60px] self-stretch flex items-center justify-center transition-all duration-150 bg-white hover:bg-gray-50 active:scale-95 active:shadow-inner"
          style={{ borderLeft: '1px solid #d1d1d1', borderRadius: 0 }}
        >
          <motion.div
            className="w-8 h-8 flex items-center justify-center"
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.25, ease: [0, 0, 1, 1] }}
          >
            <CollapseButton />
          </motion.div>
        </button>
      </motion.div>

      {/* Toast — shown for ALL variants on undo/redo */}
      <div className="self-end">
        <UndoToast message={toast.message} visible={toast.visible} />
      </div>

      {/* Option 3: Accept badge — only for toast-only variant */}
    </div>
  );
}
