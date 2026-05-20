import { useState } from "react";
import { motion } from "motion/react";

interface UndoFilmstripChipProps {
  onUndo: () => void;
  onRedo: () => void;
  onAccept: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

function AcceptButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const bg = disabled ? '#F9F9F9' : isPressed ? '#BFEAFB' : isHovered ? '#DFF5FC' : '#F9F9F9';
  const borderColor = disabled ? '#D1D1D1' : '#939598';
  const textColor = disabled ? '#B0B1B3' : '#3E3D40';

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className="h-16 min-w-[120px] rounded-[4px] flex items-center justify-center px-6 text-[20px] font-medium transition-colors disabled:cursor-not-allowed"
      style={{
        backgroundColor: bg,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor,
        color: textColor,
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      Apply
    </button>
  );
}

export default function UndoFilmstripChip({
  onUndo,
  onRedo,
  onAccept,
  canUndo,
  canRedo,
}: UndoFilmstripChipProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex items-center gap-4 bg-white rounded-[8px] p-2"
    >
      <div className="flex items-center gap-2">
        {/* Undo */}
        <button
          onClick={canUndo ? onUndo : undefined}
          disabled={!canUndo}
          className="w-16 h-16 rounded-[4px] flex items-center justify-center border border-[#939598] bg-[#F9F9F9] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:border-[#D1D1D1] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <UndoArrowIcon />
        </button>

        {/* Redo */}
        <button
          onClick={canRedo ? onRedo : undefined}
          disabled={!canRedo}
          className="w-16 h-16 rounded-[4px] flex items-center justify-center border border-[#939598] bg-[#F9F9F9] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:border-[#D1D1D1] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RedoArrowIcon />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-12 bg-[#E0E0E0]" />

      {/* Apply */}
      <AcceptButton onClick={onAccept} disabled={!canUndo && !canRedo} />
    </motion.div>
  );
}
