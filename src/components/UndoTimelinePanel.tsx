import { motion } from "motion/react";
import type { ScanSnapshot } from "../hooks/useUndoHistory";

interface UndoTimelinePanelProps {
  past: ScanSnapshot[];
  future: ScanSnapshot[];
  onJumpTo: (index: number) => void;  // index into combined [past..., ...future] array
  onAccept: () => void;
  onClose: () => void;
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function UndoTimelinePanel({ past, future, onJumpTo, onAccept, onClose }: UndoTimelinePanelProps) {
  // Build timeline nodes: all past entries + "Current" (active) + all future entries
  // Indices map directly to onJumpTo
  const allNodes = [
    ...past,
    { label: "Current", tabJawStates: {}, scannedTabs: [], activeTabId: "", tabs: [] } as ScanSnapshot,
    ...future,
  ];

  // Current position = past.length (0-based)
  const currentIndex = past.length;
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="bg-white rounded-[4px] shadow-[0_4px_20px_rgba(0,0,0,0.18)] overflow-hidden"
      style={{ minWidth: 480, maxWidth: 640 }}
    >
      {/* Header */}
      <div className="bg-[#00adef] flex items-center justify-between px-4 py-3">
        <span className="text-white text-[18px] font-normal" style={{ fontFamily: 'Roboto, sans-serif' }}>
          Undo history
        </span>
        <button
          onClick={onClose}
          className="text-white rounded-[5px] w-8 h-8 flex items-center justify-center hover:bg-[#0099d6] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 3L13 13M13 3L3 13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Timeline body */}
      <div className="px-6 py-5">
        {/* Navigation row */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => canUndo && onJumpTo(currentIndex - 1)}
            disabled={!canUndo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] text-[#3E3D40] hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeftIcon />
            Undo
          </button>
          <span className="text-[12px] text-[#8a8a8a] tabular-nums">
            Step {currentIndex + 1} of {allNodes.length}
          </span>
          <button
            onClick={() => canRedo && onJumpTo(currentIndex + 1)}
            disabled={!canRedo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[13px] text-[#3E3D40] hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Redo
            <ArrowRightIcon />
          </button>
        </div>

        {/* Timeline track */}
        <div className="relative flex items-start overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          {/* Connecting line */}
          <div className="absolute top-[9px] left-0 right-0 h-[2px] bg-[#e0e0e0]" />
          <div
            className="absolute top-[9px] left-0 h-[2px] bg-[#009ACE] transition-all duration-300"
            style={{ width: allNodes.length > 1 ? `${(currentIndex / (allNodes.length - 1)) * 100}%` : '0%' }}
          />

          {/* Nodes */}
          <div className="relative flex items-start justify-between w-full gap-0">
            {allNodes.map((node, i) => {
              const isCurrent = i === currentIndex;
              const isPast = i < currentIndex;
              const isFuture = i > currentIndex;

              return (
                <button
                  key={i}
                  onClick={() => i !== currentIndex && onJumpTo(i)}
                  disabled={i === currentIndex}
                  className="flex flex-col items-center gap-2 group"
                  style={{ minWidth: 64 }}
                >
                  {/* Node dot */}
                  <div
                    className={`relative z-10 rounded-full transition-all duration-200 ${
                      isCurrent
                        ? 'w-5 h-5 bg-[#009ACE] ring-4 ring-[#009ACE]/20'
                        : isPast
                        ? 'w-4 h-4 bg-[#009ACE] group-hover:scale-110'
                        : 'w-4 h-4 bg-[#d0d0d0] group-hover:bg-[#b0b0b0] group-hover:scale-110'
                    }`}
                  />
                  {/* Label */}
                  <span
                    className={`text-center leading-tight text-[11px] max-w-[60px] transition-colors ${
                      isCurrent
                        ? 'text-[#009ACE] font-semibold'
                        : isPast
                        ? 'text-[#3E3D40]'
                        : 'text-[#a0a0a0]'
                    }`}
                  >
                    {isFuture && i === currentIndex + 1
                      ? node.label || "Redo"
                      : node.label || (i === 0 ? "Start" : "Step")}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Apply footer */}
      <div className="border-t border-[#e0e0e0] px-4 py-3 flex items-center justify-end gap-3">
        <span className="text-[13px] text-[#8a8a8a]">
          {future.length > 0 ? `${future.length} redo step${future.length !== 1 ? 's' : ''} will be discarded` : 'At latest state'}
        </span>
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#009ACE] text-white text-[13px] font-medium hover:bg-[#007aaa] active:bg-[#006590] transition-colors"
        >
          <CheckIcon />
          Apply
        </button>
      </div>
    </motion.div>
  );
}
