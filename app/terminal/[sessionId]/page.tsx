"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TerminalChat from "@/components/TerminalChat";
import type { HeroProfile, TerminalMessage } from "@/lib/types";
import { sendTerminalMessage } from "@/lib/api";

const QUESTION_ORDER: (keyof HeroProfile)[] = ["name", "world", "desire", "flaw", "genre", "artStyle"];
const QUESTION_DISPLAY = ["Name & Trade", "World & Era", "Desire", "Fatal Flaw", "Genre", "Art Style"];

function clsx(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// Fallback responses when Vertex AI is unreachable or credentials are not configured
const FALLBACK_PROMPTS: Record<keyof HeroProfile, string> = {
  name: "The echoes of your name shall resound through this tale.\n\nNow — describe the world you inhabit. What era? What land?",
  world: "A vivid world takes shape around you.\n\nNow tell me — what is the one thing you desire above all else?",
  desire: "Hunger… I can taste it.\n\nFinally — confess to me your greatest flaw, or your deepest fear.",
  flaw: "The crack in your armour is noted.\n\nNow — what genre shall your tale inhabit? Gothic fantasy, dark sci-fi, horror, mystery, western\u2026 or something of your own devising?",
  genre: "Your story\u2019s nature is set.\n\nOne last thing — how shall your world be rendered visually? Stark woodcut, watercolour, noir photography, anime brushwork, or another style entirely?",
  artStyle: "The Terminal has recorded your soul\u2019s blueprint. The story begins\u2026 now.",
};

export default function TerminalPage() {
  const router = useRouter();
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [messages, setMessages] = useState<TerminalMessage[]>(() => [
    {
      id: "boot-1",
      role: "system" as const,
      content:
        "DESTINY TERMINAL v1.0\n─────────────────────\nInitialising soul-binding sequence...\nConnection established.",
      timestamp: new Date(),
    },
    {
      id: "greeting",
      role: "assistant" as const,
      content:
        "Welcome, traveller. I am the Destiny Terminal.\n\nBefore your story can begin, I must know six things about you.\n\nFirst — tell me your name, and the trade by which you are known.",
      timestamp: new Date(),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState<Partial<HeroProfile>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [done, setDone] = useState(false);
  const heroRef = useRef<HeroProfile | null>(null);

  const addMessage = (msg: Omit<TerminalMessage, "id" | "timestamp">) => {
    const newMsg: TerminalMessage = {
      ...msg,
      id: `${msg.role}-${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  const handleSend = async (text: string) => {
    addMessage({ role: "user", content: text });
    setLoading(true);

    const currentKey = QUESTION_ORDER[questionIndex];
    const newAnswers = { ...answers, [currentKey]: text };
    setAnswers(newAnswers);

    try {
      const { reply, heroProfile } = await sendTerminalMessage(
        questionIndex,
        text,
        newAnswers,
        sessionId
      );

      addMessage({ role: "assistant", content: reply });

      if (heroProfile) {
        // Save hero profile to localStorage for the story page
        try {
          localStorage.setItem(`wt:hero:${sessionId}`, JSON.stringify(heroProfile));
        } catch {
          // localStorage may be unavailable in some environments
        }
        heroRef.current = heroProfile as HeroProfile;
        setDone(true);
      } else {
        setQuestionIndex((i) => i + 1);
      }
    } catch {
      // Fallback to local prompts when API key isn't configured / network error
      const nextIndex = questionIndex + 1;
      const isComplete = nextIndex >= QUESTION_ORDER.length;

      if (isComplete) {
        addMessage({
          role: "assistant",
          content: FALLBACK_PROMPTS[currentKey],
        });
        const hero = newAnswers as HeroProfile;
        try {
          localStorage.setItem(`wt:hero:${sessionId}`, JSON.stringify(hero));
        } catch { /* ignore */ }
        heroRef.current = hero;
        setDone(true);
      } else {
        addMessage({ role: "assistant", content: FALLBACK_PROMPTS[currentKey] });
        setQuestionIndex(nextIndex);
      }
    } finally {
      setLoading(false);
    }
  };

  // Redirect to story page after short delay once onboarding is done
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => {
      router.push(`/story/${sessionId}`);
    }, 2200);
    return () => clearTimeout(t);
  }, [done, sessionId, router]);

  const answeredCount = Object.keys(answers).length;

  return (
    <div className="relative min-h-screen bg-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-zinc-200"
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-zinc-600 animate-pulse" />
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-[0.35em]">
            Destiny Terminal — Soul Intake
          </span>
        </div>
        {/* Progress pills */}
        <div className="flex items-center gap-1.5">
          {QUESTION_DISPLAY.map((label, i) => (
            <motion.div
              key={label}
              className={clsx(
                "h-1 rounded-full transition-all duration-500",
                i < answeredCount
                  ? "bg-white/70 w-6"
                  : i === questionIndex && !done
                  ? "bg-zinc-400 w-4 animate-pulse"
                  : "bg-zinc-100 w-3"
              )}
            />
          ))}
          <span className="ml-2 font-mono text-[10px] text-zinc-300 uppercase tracking-widest hidden sm:block">
            {done ? "COMPLETE" : QUESTION_DISPLAY[questionIndex]}
          </span>
        </div>
      </motion.header>

      {/* Two-pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — question checklist */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="hidden lg:flex flex-col justify-center w-64 shrink-0 border-r border-zinc-100 px-8 py-10 gap-6"
        >
          <p className="font-mono text-[10px] text-zinc-300 uppercase tracking-[0.3em] mb-2">
            The Six Questions
          </p>
          {QUESTION_DISPLAY.map((label, i) => (
            <motion.div
              key={label}
              animate={{ opacity: i <= answeredCount ? 1 : i === questionIndex ? 0.7 : 0.18 }}
              transition={{ duration: 0.4 }}
              className="flex items-start gap-3"
            >
              <span
                className={clsx(
                  "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center border text-[9px] font-mono shrink-0 transition-all duration-500",
                  i < answeredCount
                    ? "border-zinc-600 bg-zinc-100 text-zinc-600"
                    : i === questionIndex
                    ? "border-zinc-500 text-zinc-400"
                    : "border-zinc-200 text-zinc-300"
                )}
              >
                {i < answeredCount ? "✓" : i + 1}
              </span>
              <div>
                <p
                  className={clsx(
                    "font-mono text-xs transition-colors duration-300",
                    i < answeredCount
                      ? "text-zinc-400 line-through decoration-zinc-300"
                      : i === questionIndex
                      ? "text-zinc-700"
                      : "text-zinc-300"
                  )}
                >
                  {label}
                </p>
                {i === questionIndex && !done && (
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    className="h-px bg-black/30 mt-1 origin-left"
                  />
                )}
              </div>
            </motion.div>
          ))}
        </motion.aside>

        {/* Terminal pane */}
        <div className="flex-1 overflow-hidden">
          <TerminalChat
            messages={messages}
            loading={loading}
            onSend={handleSend}
            disabled={done}
            placeholder={done ? "Entering the story..." : "Type your answer — or use the mic ↗"}
          />
        </div>
      </div>

      {/* Transition overlay */}
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white flex flex-col items-center justify-center gap-6 z-50"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="text-center space-y-4"
            >
              <motion.div
                className="w-20 h-20 border border-zinc-400 mx-auto flex items-center justify-center"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, ease: "linear", repeat: Infinity }}
              >
                <div className="w-12 h-12 border border-zinc-600 flex items-center justify-center">
                  <div className="w-2 h-2 bg-black rounded-full" />
                </div>
              </motion.div>
              <p className="text-zinc-600 font-mono text-sm tracking-[0.2em] uppercase">
                Soul Blueprint Recorded
              </p>
              <p className="text-zinc-400 font-mono text-xs tracking-widest uppercase">
                Entering narrative engine...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
