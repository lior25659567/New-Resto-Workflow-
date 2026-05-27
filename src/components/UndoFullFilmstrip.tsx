import { useRef, useEffect } from "react";
import { motion } from "motion/react";
import type { ScanSnapshot } from "../hooks/useUndoHistory";
import JawThumbnail from "./jaw-viewer/JawThumbnail";

interface UndoFullFilmstripProps {
  past: ScanSnapshot[];
  future: ScanSnapshot[];
  currentJaw: 'upper' | 'lower' | 'bite' | null;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onJumpTo: (index: number) => void;
  onAccept: () => void;
  onClose: () => void;
}

function UndoArrowIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M20 10H7.8149L11.4023 6.4141L10 5L4 11L10 17L11.4023 15.5854L7.8179 12H20C21.5913 12 23.1174 12.6321 24.2426 13.7574C25.3679 14.8826 26 16.4087 26 18C26 19.5913 25.3679 21.1174 24.2426 22.2426C23.1174 23.3679 21.5913 24 20 24H12V26H20C22.1217 26 24.1566 25.1571 25.6569 23.6569C27.1571 22.1566 28 20.1217 28 18C28 15.8783 27.1571 13.8434 25.6569 12.3431C24.1566 10.8429 22.1217 10 20 10Z" fill="#3E3D40"/>
    </svg>
  );
}

function RedoArrowIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M12 10H24.1851L20.5977 6.4141L22 5L28 11L22 17L20.5977 15.5854L24.1821 12H12C10.4087 12 8.88258 12.6321 7.75736 13.7574C6.63214 14.8826 6 16.4087 6 18C6 19.5913 6.63214 21.1174 7.75736 22.2426C8.88258 23.3679 10.4087 24 12 24H20V26H12C9.87827 26 7.84344 25.1571 6.34315 23.6569C4.84285 22.1566 4 20.1217 4 18C4 15.8783 4.84285 13.8434 6.34315 12.3431C7.84344 10.8429 9.87827 10 12 10Z" fill="#3E3D40"/>
    </svg>
  );
}

export default function UndoFullFilmstrip({ past, future, currentJaw, canUndo, canRedo, onUndo, onRedo, onJumpTo, onAccept, onClose }: UndoFullFilmstripProps) {
  const jaw = currentJaw ?? 'upper';
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentIndex = past.length;
  const totalSteps = past.length + 1 + future.length;

  const entries: Array<{ label: string; index: number; type: 'past' | 'current' | 'future' }> = [
    ...past.map((s, i) => ({ label: s.label, index: i, type: 'past' as const })),
    { label: 'Current state', index: currentIndex, type: 'current' as const },
    ...future.map((s, i) => ({ label: s.label, index: currentIndex + 1 + i, type: 'future' as const })),
  ];

  useEffect(() => {
    if (scrollRef.current) {
      const currentEl = scrollRef.current.querySelector('[data-current="true"]');
      if (currentEl) {
        currentEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentIndex]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col rounded-[8px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.2)]"
      style={{ width: 520, maxWidth: '90vw' }}
    >
      {/* Header */}
      <div className="bg-[#00adef] flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-white text-[16px] font-medium" style={{ fontFamily: 'Roboto, sans-serif' }}>
          Undo History
        </span>
        <button
          onClick={onClose}
          className="text-white rounded-[5px] w-8 h-8 flex items-center justify-center hover:bg-[#0099d6] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 2L12 12M12 2L2 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Filmstrip */}
      <div className="bg-white px-3 py-4">
        <div
          ref={scrollRef}
          className="flex items-start gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin' }}
        >
          {entries.map((entry) => {
            const isCurrent = entry.type === 'current';
            const isFuture = entry.type === 'future';
            const rotationY = -0.4 + (entry.index / Math.max(totalSteps - 1, 1)) * 0.8;
            const opacity = isFuture ? 0.4 : 0.5 + (entry.index / Math.max(totalSteps - 1, 1)) * 0.5;

            return (
              <button
                key={entry.index}
                data-current={isCurrent ? 'true' : undefined}
                onClick={() => !isCurrent && onJumpTo(entry.index)}
                disabled={isCurrent}
                className={`flex flex-col items-center gap-1.5 shrink-0 transition-all ${
                  isCurrent ? 'cursor-default' : 'cursor-pointer hover:scale-105'
                }`}
                style={{ width: 80 }}
              >
                {/* 3D Thumbnail */}
                <div
                  className={`rounded-[8px] overflow-hidden transition-all ${
                    isCurrent
                      ? 'ring-2 ring-[#009ACE] ring-offset-1 shadow-[0_0_12px_rgba(0,154,206,0.3)]'
                      : isFuture
                      ? 'border-2 border-dashed border-[#d0d0d0] opacity-60'
                      : 'border-2 border-[#e8e8e8] hover:border-[#009ACE]'
                  }`}
                  style={{ background: '#f4f8fb' }}
                >
                  <JawThumbnail
                    jaw={jaw}
                    rotationY={rotationY}
                    opacity={opacity}
                    size={72}
                  />
                </div>

                {/* Step number */}
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                    isCurrent
                      ? 'bg-[#009ACE] text-white'
                      : isFuture
                      ? 'bg-[#f0f0f0] text-[#b0b0b0]'
                      : 'bg-[#e8f6fd] text-[#009ACE]'
                  }`}
                >
                  {entry.index + 1}
                </span>

                {/* Label */}
                <span
                  className={`text-[10px] leading-tight text-center line-clamp-2 ${
                    isCurrent
                      ? 'text-[#009ACE] font-semibold'
                      : isFuture
                      ? 'text-[#b0b0b0] line-through'
                      : 'text-[#555]'
                  }`}
                  style={{ maxWidth: 76 }}
                >
                  {entry.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer — undo/redo + apply */}
      <div className="bg-white border-t border-[#e8e8e8] px-3 py-2 flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={canUndo ? onUndo : undefined}
            disabled={!canUndo}
            className="w-16 h-16 rounded-[4px] flex items-center justify-center border border-[#939598] bg-[#F9F9F9] hover:bg-[#f0f0f0] active:bg-[#e8e8e8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <UndoArrowIcon />
          </button>
          <button
            onClick={canRedo ? onRedo : undefined}
            disabled={!canRedo}
            className="w-16 h-16 rounded-[4px] flex items-center justify-center border border-[#939598] bg-[#F9F9F9] hover:bg-[#f0f0f0] active:bg-[#e8e8e8] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <RedoArrowIcon />
          </button>
        </div>
        <button
          onClick={onAccept}
          disabled={!canUndo && !canRedo}
          className={`h-16 min-w-[120px] rounded-[4px] flex items-center justify-center px-6 text-[20px] font-medium transition-colors ${
            canUndo || canRedo
              ? 'bg-[#009ACE] text-white border border-[#009ACE] hover:bg-[#007aaa] active:bg-[#006590]'
              : 'bg-[#F0F0F0] text-[#B0B1B3] border border-[#D1D1D1] cursor-not-allowed'
          }`}
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          Accept
        </button>
      </div>
    </motion.div>
  );
}
