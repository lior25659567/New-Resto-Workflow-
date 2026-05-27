import { motion } from "motion/react";

interface UndoActionBarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAccept: () => void;
  onClose: () => void;
}

function UndoArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <path d="M20 10H7.8149L11.4023 6.4141L10 5L4 11L10 17L11.4023 15.5854L7.8179 12H20C21.5913 12 23.1174 12.6321 24.2426 13.7574C25.3679 14.8826 26 16.4087 26 18C26 19.5913 25.3679 21.1174 24.2426 22.2426C23.1174 23.3679 21.5913 24 20 24H12V26H20C22.1217 26 24.1566 25.1571 25.6569 23.6569C27.1571 22.1566 28 20.1217 28 18C28 15.8783 27.1571 13.8434 25.6569 12.3431C24.1566 10.8429 22.1217 10 20 10Z" fill="currentColor"/>
    </svg>
  );
}

function RedoArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
      <path d="M12 10H24.1851L20.5977 6.4141L22 5L28 11L22 17L20.5977 15.5854L24.1821 12H12C10.4087 12 8.88258 12.6321 7.75736 13.7574C6.63214 14.8826 6 16.4087 6 18C6 19.5913 6.63214 21.1174 7.75736 22.2426C8.88258 23.3679 10.4087 24 12 24H20V26H12C9.87827 26 7.84344 25.1571 6.34315 23.6569C4.84285 22.1566 4 20.1217 4 18C4 15.8783 4.84285 13.8434 6.34315 12.3431C7.84344 10.8429 9.87827 10 12 10Z" fill="currentColor"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M4 10L8.5 14.5L16 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function UndoActionBar({ canUndo, canRedo, onUndo, onRedo, onAccept, onClose }: UndoActionBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex flex-col items-start rounded-[4px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.18)]"
      style={{ width: 300 }}
    >
      {/* Header */}
      <div className="bg-[#00adef] w-full flex items-center justify-between px-4 py-3">
        <span className="text-white text-[18px] font-normal leading-snug" style={{ fontFamily: 'Roboto, sans-serif' }}>
          Undo tool
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

      {/* Controls */}
      <div className="bg-white w-full flex items-center gap-0 divide-x divide-[#e0e0e0]">
        {/* Undo */}
        <button
          onClick={canUndo ? onUndo : undefined}
          disabled={!canUndo}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="text-[#3E3D40]"><UndoArrowIcon /></span>
          <span className="text-[13px] text-[#3E3D40] font-normal">Undo</span>
        </button>

        {/* Redo */}
        <button
          onClick={canRedo ? onRedo : undefined}
          disabled={!canRedo}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-4 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="text-[#3E3D40]"><RedoArrowIcon /></span>
          <span className="text-[13px] text-[#3E3D40] font-normal">Redo</span>
        </button>
      </div>

      {/* Accept */}
      <div className="bg-white w-full border-t border-[#e0e0e0]">
        <button
          onClick={onAccept}
          className="w-full flex items-center justify-center gap-2 py-3.5 text-[#009ACE] font-medium text-[15px] hover:bg-[#f0faff] active:bg-[#e0f4ff] transition-colors rounded-b-[4px]"
        >
          <CheckIcon />
          Accept changes
        </button>
      </div>
    </motion.div>
  );
}
