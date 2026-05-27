import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface UndoToastProps {
  message: string;
  visible: boolean;
}

interface UndoApplyBadgeProps {
  hasHistory: boolean;
  onApply: () => void;
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Animated toast notification shown after each undo/redo action. Auto-dismisses after 3s. */
export function UndoToast({ message, visible }: UndoToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={message}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          className="bg-[#1a1a1a] text-white text-[13px] px-4 py-2.5 rounded-[8px] shadow-lg pointer-events-none select-none whitespace-nowrap"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Persistent Apply badge — always visible while undo history is non-empty. */
export function UndoApplyBadge({ hasHistory, onApply }: UndoApplyBadgeProps) {
  return (
    <AnimatePresence>
      {hasHistory && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
          onClick={onApply}
          className="flex items-center gap-1.5 px-4 py-2 rounded-[20px] bg-[#009ACE] text-white text-[13px] font-medium shadow-md hover:bg-[#007aaa] active:bg-[#006590] active:scale-95 transition-all"
          style={{ fontFamily: 'Roboto, sans-serif' }}
        >
          <CheckIcon />
          Accept changes
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** Hook: manages a self-dismissing toast with a 3-second TTL. */
export function useUndoToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  const show = (msg: string) => {
    setMessage(msg);
    setVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(id);
  }, [visible, message]);

  return { message, visible, show };
}
