import { motion } from "motion/react";

interface UndoLabeledChipProps {
  onUndo: () => void;
  onRedo: () => void;
  onAccept: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function UndoIcon({ disabled }: { disabled?: boolean }) {
  const color = disabled ? "#B0B1B3" : "#3E3D40";
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M20 10H7.8149L11.4023 6.4141L10 5L4 11L10 17L11.4023 15.5854L7.8179 12H20C21.5913 12 23.1174 12.6321 24.2426 13.7574C25.3679 14.8826 26 16.4087 26 18C26 19.5913 25.3679 21.1174 24.2426 22.2426C23.1174 23.3679 21.5913 24 20 24H12V26H20C22.1217 26 24.1566 25.1571 25.6569 23.6569C27.1571 22.1566 28 20.1217 28 18C28 15.8783 27.1571 13.8434 25.6569 12.3431C24.1566 10.8429 22.1217 10 20 10Z" fill={color}/>
    </svg>
  );
}

function RedoIcon({ disabled }: { disabled?: boolean }) {
  const color = disabled ? "#B0B1B3" : "#3E3D40";
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M12 10H24.1851L20.5977 6.4141L22 5L28 11L22 17L20.5977 15.5854L24.1821 12H12C10.4087 12 8.88258 12.6321 7.75736 13.7574C6.63214 14.8826 6 16.4087 6 18C6 19.5913 6.63214 21.1174 7.75736 22.2426C8.88258 23.3679 10.4087 24 12 24H20V26H12C9.87827 26 7.84344 25.1571 6.34315 23.6569C4.84285 22.1566 4 20.1217 4 18C4 15.8783 4.84285 13.8434 6.34315 12.3431C7.84344 10.8429 9.87827 10 12 10Z" fill={color}/>
    </svg>
  );
}

function AcceptIcon({ disabled }: { disabled?: boolean }) {
  const color = disabled ? "#B0B1B3" : "#3E3D40";
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="11" stroke={color} strokeWidth="2.5" />
      <path
        d="M10 16L14 20L22 12"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function UndoLabeledChip({
  onUndo,
  onRedo,
  onAccept,
  canUndo,
  canRedo,
}: UndoLabeledChipProps) {
  const hasHistory = canUndo || canRedo;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
      className="flex items-start gap-0 bg-white border-b border-[#E0E0E0] rounded-b-[4px] p-2"
    >
      <div className="flex items-center gap-2">
        {/* Undo */}
        <button
          onClick={canUndo ? onUndo : undefined}
          disabled={!canUndo}
          className="h-16 min-w-[120px] rounded-[4px] flex items-center justify-center gap-4 px-6 border border-[#939598] bg-[#F9F9F9] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:border-[#D1D1D1] disabled:cursor-not-allowed"
        >
          <UndoIcon disabled={!canUndo} />
          <span
            className="text-[20px] font-medium leading-[32px] whitespace-nowrap"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: canUndo ? "#3E3D40" : "#B0B1B3",
            }}
          >
            Undo
          </span>
        </button>

        {/* Redo */}
        <button
          onClick={canRedo ? onRedo : undefined}
          disabled={!canRedo}
          className="h-16 min-w-[120px] rounded-[4px] flex items-center justify-center gap-4 px-6 border border-[#939598] bg-[#F9F9F9] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:border-[#D1D1D1] disabled:cursor-not-allowed"
        >
          <RedoIcon disabled={!canRedo} />
          <span
            className="text-[20px] font-medium leading-[32px] whitespace-nowrap"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: canRedo ? "#3E3D40" : "#B0B1B3",
            }}
          >
            Redo
          </span>
        </button>

        {/* Apply */}
        <button
          onClick={hasHistory ? onAccept : undefined}
          disabled={!hasHistory}
          className="h-16 min-w-[120px] rounded-[4px] flex items-center justify-center gap-4 px-6 border border-[#939598] bg-[#F9F9F9] hover:bg-[#DFF5FC] active:bg-[#BFEAFB] transition-colors disabled:border-[#D1D1D1] disabled:cursor-not-allowed"
        >
          <AcceptIcon disabled={!hasHistory} />
          <span
            className="text-[20px] font-medium leading-[32px] whitespace-nowrap"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: hasHistory ? "#3E3D40" : "#B0B1B3",
            }}
          >
            Accept
          </span>
        </button>
      </div>
    </motion.div>
  );
}
