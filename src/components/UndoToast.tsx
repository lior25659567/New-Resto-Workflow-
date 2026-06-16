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

interface BiteNavigationBannerProps {
  title: string;
  body: string;
  visible: boolean;
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

/**
 * iTero-style information banner — matches the Banner component in Figma.
 * Blue left accent border, light blue background, bold title + regular body.
 * Slides up from the bottom, auto-dismisses after 5 seconds.
 */
export function BiteNavigationBanner({ title, body, visible }: BiteNavigationBannerProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={title + body}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="pointer-events-auto select-none shadow-lg"
          style={{
            width: 500,
            background: '#F5F5F5',
            borderRadius: 12,
            borderLeft: '6px solid #00ADEF',
            fontFamily: 'Roboto, sans-serif',
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: '22px', color: '#3E3D40' }}>
              {title}
            </p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 400, lineHeight: '20px', color: '#3E3D40' }}>
              {body}
            </p>
          </div>
          <button style={{ padding: '14px 14px 0 0', background: 'none', border: 'none', cursor: 'pointer', color: '#009ACE', fontSize: 20, fontWeight: 700, lineHeight: 1 }}>
            ✕
          </button>
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

interface BiteUnderTabToastProps {
  title: string;
  body: string;
  visible: boolean;
}

/**
 * Compact bite toast that appears directly below the reference bite tab.
 * Matches the inline-rename error style: white bg, blue left accent border.
 */
export function BiteUnderTabToast({ title, body, visible }: BiteUnderTabToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={title + body}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          className="pointer-events-none select-none shadow-md"
          style={{
            background: '#fff',
            borderRadius: 6,
            borderLeft: '4px solid #009ACE',
            fontFamily: 'Roboto, sans-serif',
            minWidth: 200,
            maxWidth: 340,
          }}
        >
          <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, lineHeight: '16px', color: '#3E3D40' }}>
              {title}
            </p>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 400, lineHeight: '15px', color: '#666' }}>
              {body}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Hook: manages a self-dismissing bite navigation banner with title + body. Auto-dismisses after 5s. */
export function useBiteToast() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [visible, setVisible] = useState(false);

  const show = (t: string, b: string) => {
    setTitle(t);
    setBody(b);
    setVisible(true);
  };

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(id);
  }, [visible, title]);

  return { title, body, visible, show };
}
