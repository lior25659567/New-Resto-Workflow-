import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ViewId, MaterialType } from './types';
import { MATERIAL_LABELS } from './constants';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const SUGGESTIONS_BY_VIEW: Record<string, string[]> = {
  margin: [
    'Is my margin depth adequate?',
    'What margin type should I use?',
    'How do I improve margin continuity?',
    'Is the cervical area ready?',
  ],
  reduction: [
    'Is my reduction adequate?',
    'Where do I need more reduction?',
    'How much occlusal clearance do I have?',
    'Which zone needs the most work?',
  ],
  insertion: [
    'What is the optimal insertion path?',
    'How do I reduce undercut risk?',
    'What taper angle should I use?',
    'Can I adjust the path for this case?',
  ],
  undercuts: [
    'Which undercuts are critical to fix?',
    'How do I resolve the distal undercut?',
    'Will this seat properly?',
    'What wall adjustment is recommended?',
  ],
  default: [
    'Is my reduction adequate for this material?',
    'Where do I need more reduction?',
    'What margin type should I use?',
    'Can I proceed to final scanning?',
    'What are the undercut risks here?',
    'How much occlusal clearance do I have?',
  ],
};

function generateResponse(question: string, view: string | null, material: MaterialType): string {
  const q = question.toLowerCase();

  if (q.includes('adequate') || q.includes('enough') || q.includes('sufficient')) {
    return `Based on the ${view ?? 'current'} analysis, reduction is adequate in the lingual and distal zones (1.5–1.8 mm). The occlusal surface shows 0.9 mm at the central fossa — below the minimum for ${MATERIAL_LABELS[material]}. Focus additional reduction on the buccal cusp and occlusal table before proceeding.`;
  }
  if (q.includes('where') || q.includes('more reduction') || q.includes('zone') || q.includes('most work')) {
    return 'Priority zones:\n1. Central fossa — 0.9 mm, needs 0.6 mm more.\n2. Buccal cusp — 1.1 mm, needs 0.4 mm more.\n\nThe mesial and distal walls are within target. Start occlusal, then address the buccal cusp tip.';
  }
  if (q.includes('margin') || q.includes('chamfer') || q.includes('shoulder') || q.includes('cervical') || q.includes('depth')) {
    return `For ${MATERIAL_LABELS[material]} at this position, a 1.0–1.2 mm rounded shoulder margin is recommended. The lingual margin depth looks good — verify the buccal margin is at or just below the gingival crest. Avoid knife-edge margins; they fracture under load.`;
  }
  if (q.includes('proceed') || q.includes('scan') || q.includes('ready') || q.includes('final')) {
    return "Not quite yet. Two issues to resolve:\n1. Occlusal reduction is 0.6 mm short at the central fossa.\n2. The buccal margin has a minor undercut at mid-buccal.\n\nCorrect these and you're clear to proceed. Estimated 5–8 minutes of additional prep.";
  }
  if (q.includes('undercut') || q.includes('path') || q.includes('insertion') || q.includes('seat') || q.includes('wall')) {
    return "There's a moderate undercut on the distal wall at 7.2° from optimal insertion. You can adjust the path slightly mesially or reduce the distal wall taper. The buccal undercut is minor and won't affect seating. Use the Insertion Path view to simulate corrections.";
  }
  if (q.includes('occlusal') || q.includes('clearance') || q.includes('how much')) {
    return `Occlusal clearance: 0.9 mm at the central fossa, 1.4 mm at the cusp tips. ${MATERIAL_LABELS[material]} requires at least 1.5 mm uniform clearance. Cusp reduction is sufficient — focus the remaining work on the central fossa.`;
  }
  if (q.includes('taper') || q.includes('angle') || q.includes('converge')) {
    return 'Ideal axial taper is 6–8° per wall (12–16° total convergence). The buccal wall appears over-tapered at ~11°, which reduces retention. Maintain parallel walls while preserving 1.0 mm axial reduction.';
  }
  if (q.includes('continuity') || q.includes('uninterrupted') || q.includes('finish line')) {
    return 'The margin line shows good continuity on the lingual and mesial. There is a small interruption on the mid-buccal — blend that area to create a single, uninterrupted finish line before scanning.';
  }
  if (q.includes('material') || q.includes('switch') || q.includes('bruxzir') || q.includes('emax')) {
    return `${MATERIAL_LABELS[material]} is selected. It requires 1.5 mm occlusal and 1.0 mm axial reduction. If pulp proximity is a concern, consider switching to Bruxzir Full Strength — it tolerates 1.0 mm occlusal clearance with similar esthetics.`;
  }

  return "I've reviewed the scan data for this prep. For specific questions about reduction depth, margin placement, or insertion path — ask me directly or tap a suggestion below. What would you like to check?";
}

interface CopilotChatProps {
  activeView: ViewId | null;
  selectedMaterial: MaterialType;
}

export default function CopilotChat({ activeView, selectedMaterial }: CopilotChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const suggestions = SUGGESTIONS_BY_VIEW[activeView ?? 'default'] ?? SUGGESTIONS_BY_VIEW.default;
  const showSuggestions = !isThinking && (messages.length === 0 || messages[messages.length - 1].role === 'assistant');

  const sendMessage = (text: string) => {
    if (!text.trim() || isThinking) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    const delay = 800 + Math.random() * 600;
    setTimeout(() => {
      const reply: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: generateResponse(text, activeView, selectedMaterial),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, reply]);
      setIsThinking(false);
    }, delay);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-[#009ACE] flex items-center justify-center shrink-0 mb-0.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
            )}
            <div
              className="rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-[19px] max-w-[82%] whitespace-pre-line"
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #009ACE 0%, #0077a8 100%)'
                  : '#f1f5f9',
                color: msg.role === 'user' ? '#fff' : '#1e293b',
                borderBottomRightRadius: msg.role === 'user' ? 4 : undefined,
                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : undefined,
                boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        <AnimatePresence>
          {isThinking && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-end gap-2 justify-start"
            >
              <div className="w-6 h-6 rounded-full bg-[#009ACE] flex items-center justify-center shrink-0">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div
                className="rounded-2xl rounded-bl-[4px] px-4 py-3 flex items-center gap-1.5"
                style={{ background: '#f1f5f9' }}
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-[#009ACE]"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSuggestions && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pt-1"
            >
              <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide mb-2 px-1">Suggested questions</div>
              <div className="flex flex-col gap-1.5">
                {suggestions.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="flex items-center gap-2.5 text-left w-full px-3 py-2 rounded-xl border transition-all group"
                    style={{
                      background: '#fff',
                      borderColor: '#e2e8f0',
                      color: '#334155',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#009ACE';
                      (e.currentTarget as HTMLElement).style.background = '#f0f9ff';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
                      (e.currentTarget as HTMLElement).style.background = '#fff';
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: '#e0f2fe' }}
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#009ACE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                    </span>
                    <span className="text-[12px] leading-5">{q}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-3 pb-3 pt-2 shrink-0 border-t border-[#f1f5f9]"
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3.5 py-2.5 transition-all"
          style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
          }}
          onFocusCapture={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#009ACE';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(0,154,206,0.1)';
          }}
          onBlurCapture={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0';
            (e.currentTarget as HTMLElement).style.boxShadow = 'none';
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about this prep…"
            disabled={isThinking}
            className="flex-1 bg-transparent text-[13px] text-[#334155] placeholder-[#94a3b8] outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: input.trim() && !isThinking ? '#009ACE' : '#e2e8f0',
              color: input.trim() && !isThinking ? '#fff' : '#94a3b8',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
