import { motion } from "motion/react";

interface UndoIconsOnlyProps {
  onUndo: () => void;
  onRedo: () => void;
  onAccept: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function UndoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <path d="M20 10H7.8149L11.4023 6.4141L10 5L4 11L10 17L11.4023 15.5854L7.8179 12H20C21.5913 12 23.1174 12.6321 24.2426 13.7574C25.3679 14.8826 26 16.4087 26 18C26 19.5913 25.3679 21.1174 24.2426 22.2426C23.1174 23.3679 21.5913 24 20 24H12V26H20C22.1217 26 24.1566 25.1571 25.6569 23.6569C27.1571 22.1566 28 20.1217 28 18C28 15.8783 27.1571 13.8434 25.6569 12.3431C24.1566 10.8429 22.1217 10 20 10Z" fill="currentColor"/>
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
      <path d="M12 10H24.1851L20.5977 6.4141L22 5L28 11L22 17L20.5977 15.5854L24.1821 12H12C10.4087 12 8.88258 12.6321 7.75736 13.7574C6.63214 14.8826 6 16.4087 6 18C6 19.5913 6.63214 21.1174 7.75736 22.2426C8.88258 23.3679 10.4087 24 12 24H20V26H12C9.87827 26 7.84344 25.1571 6.34315 23.6569C4.84285 22.1566 4 20.1217 4 18C4 15.8783 4.84285 13.8434 6.34315 12.3431C7.84344 10.8429 9.87827 10 12 10Z" fill="currentColor"/>
    </svg>
  );
}

function AcceptIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
      <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function UndoIconsOnly({
  onUndo,
  onRedo,
  onAccept,
  canUndo,
  canRedo,
}: UndoIconsOnlyProps) {
  const hasHistory = canUndo || canRedo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex items-center gap-1"
    >
      {/* Undo */}
      <button
        onClick={canUndo ? onUndo : undefined}
        disabled={!canUndo}
        className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[#3E3D40] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:text-[#B0B1B3] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UndoIcon />
      </button>

      {/* Redo */}
      <button
        onClick={canRedo ? onRedo : undefined}
        disabled={!canRedo}
        className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[#3E3D40] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:text-[#B0B1B3] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RedoIcon />
      </button>

      {/* Apply */}
      <button
        onClick={hasHistory ? onAccept : undefined}
        disabled={!hasHistory}
        className={`w-[60px] h-[60px] rounded-full flex items-center justify-center transition-colors ${
          hasHistory
            ? 'text-[#3E3D40] hover:bg-[#DFF5FC] active:bg-[#BFEAFB]'
            : 'text-[#B0B1B3] opacity-50 cursor-not-allowed'
        }`}
      >
        <AcceptIcon />
      </button>
    </motion.div>
  );
}
