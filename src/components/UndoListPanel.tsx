import { motion } from "motion/react";
import type { ScanSnapshot } from "../hooks/useUndoHistory";

interface UndoListPanelProps {
  past: ScanSnapshot[];
  future: ScanSnapshot[];
  onJumpTo: (index: number) => void;
  onAccept: () => void;
  onClose: () => void;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function TabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 10V5a1 1 0 011-1h4l2 2h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 5h10M6 5V3.5h4V5M5.5 5l.5 7.5h4l.5-7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UndoArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M3.5 5C3.5 5 5 3 7.5 3C10.2 3 12.5 5.3 12.5 8C12.5 10.7 10.2 13 7.5 13C5.2 13 3.3 11.4 2.8 9.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M2 3L3.5 5L5 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function getIconForLabel(label: string) {
  const l = label.toLowerCase();
  if (l.includes("scan") && !l.includes("tab")) return <ScanIcon />;
  if (l.includes("deleted")) return <TrashIcon />;
  if (l.includes("added") || l.includes("tab")) return <TabIcon />;
  return <UndoArrowIcon />;
}

export default function UndoListPanel({ past, future, onJumpTo, onAccept, onClose }: UndoListPanelProps) {
  // Build full history with original indices, then filter to scan-only entries
  const currentOriginalIndex = past.length;
  const allRaw: Array<{ snap: ScanSnapshot; originalIndex: number; isCurrent: boolean }> = [
    ...past.map((s, i) => ({ snap: s, originalIndex: i, isCurrent: false })),
    { snap: { label: "Current state", tabJawStates: {}, scannedTabs: [], activeTabId: "", tabs: [], currentJaw: null } as ScanSnapshot, originalIndex: currentOriginalIndex, isCurrent: true },
    ...future.map((s, i) => ({ snap: s, originalIndex: currentOriginalIndex + 1 + i, isCurrent: false })),
  ];

  const isScanEntry = (label: string) => {
    const l = label.toLowerCase();
    return l.includes("scanned") || l === "current state";
  };

  const filteredEntries = allRaw.filter(e => isScanEntry(e.snap.label));
  const currentFilteredIndex = filteredEntries.findIndex(e => e.isCurrent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col rounded-[4px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
      style={{ width: 300 }}
    >
      {/* Header */}
      <div className="bg-[#00adef] flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white text-[18px] font-normal" style={{ fontFamily: 'Roboto, sans-serif' }}>
          History
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

      {/* List — scan entries only */}
      <div className="bg-white overflow-y-auto" style={{ maxHeight: 320 }}>
        {filteredEntries.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-[#a0a0a0]">
            No history yet. Start scanning to record steps.
          </div>
        ) : (
          <ul>
            {filteredEntries.map((entry, displayIdx) => {
              const isCurrent = entry.isCurrent;
              const isPast = entry.originalIndex < currentOriginalIndex;

              return (
                <li key={displayIdx}>
                  <button
                    onClick={() => !isCurrent && onJumpTo(entry.originalIndex)}
                    disabled={isCurrent}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-[#f0f0f0] last:border-0 ${
                      isCurrent
                        ? 'bg-[#f0faff] cursor-default'
                        : 'hover:bg-gray-50 cursor-pointer'
                    }`}
                  >
                    {/* Step number */}
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold ${
                        isCurrent
                          ? 'bg-[#009ACE] text-white'
                          : isPast
                          ? 'bg-[#e8f6fd] text-[#009ACE]'
                          : 'bg-[#f0f0f0] text-[#b0b0b0]'
                      }`}
                    >
                      {displayIdx + 1}
                    </span>

                    {/* Icon */}
                    <span
                      className={`shrink-0 ${
                        isCurrent ? 'text-[#009ACE]' : isPast ? 'text-[#3E3D40]' : 'text-[#c0c0c0]'
                      }`}
                    >
                      {getIconForLabel(entry.snap.label)}
                    </span>

                    {/* Label */}
                    <span
                      className={`flex-1 text-[13px] leading-snug ${
                        isCurrent
                          ? 'text-[#009ACE] font-semibold'
                          : isPast
                          ? 'text-[#3E3D40]'
                          : 'text-[#b0b0b0] line-through'
                      }`}
                    >
                      {entry.snap.label}
                    </span>

                    {/* Active indicator */}
                    {isCurrent && (
                      <span className="shrink-0 text-[10px] font-semibold text-[#009ACE] uppercase tracking-wide">
                        Now
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t border-[#e0e0e0] px-4 py-3 flex items-center justify-between shrink-0">
        <span className="text-[12px] text-[#a0a0a0]">
          {future.length > 0
            ? `${future.length} step${future.length !== 1 ? 's' : ''} will be discarded`
            : past.length === 0
            ? 'No changes yet'
            : 'Up to date'}
        </span>
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] bg-[#009ACE] text-white text-[13px] font-medium hover:bg-[#007aaa] active:bg-[#006590] transition-colors"
        >
          <CheckIcon />
          Accept
        </button>
      </div>
    </motion.div>
  );
}
