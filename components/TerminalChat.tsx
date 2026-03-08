"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { Send, Loader2, Mic, MicOff } from "lucide-react";
import clsx from "clsx";
import type { TerminalMessage } from "@/lib/types";

// ── CRT scanline overlay ──────────────────────────────────────────────────────
function CRTOverlay() {
  return (
    <>
      {/* Scanlines */}
      <div
        className="pointer-events-none absolute inset-0 z-20 opacity-[0.06]"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.8) 2px, rgba(0,0,0,0.8) 4px)",
          backgroundSize: "100% 4px",
        }}
      />
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.7) 100%)",
        }}
      />
    </>
  );
}

// ── Typewriter message (for assistant messages) ───────────────────────────────
function TypewriterMessage({ content, onDone }: { content: string; onDone?: () => void }) {
  const [done, setDone] = useState(false);

  return (
    <div className="relative">
      {!done ? (
        <TypeAnimation
          sequence={[
            content,
            () => { setDone(true); onDone?.(); },
          ]}
          wrapper="p"
          speed={80}
          cursor={true}
          className="text-zinc-800 font-mono text-sm leading-relaxed whitespace-pre-wrap"
          style={{ fontFamily: "var(--font-geist-mono)" }}
        />
      ) : (
        <p className="text-zinc-800 font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
      )}
    </div>
  );
}

interface TerminalChatProps {
  messages: TerminalMessage[];
  loading: boolean;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function TerminalChat({
  messages,
  loading,
  onSend,
  disabled = false,
  placeholder = "Type your answer...",
}: TerminalChatProps) {
  const [input, setInput] = useState("");
  const [typingDone, setTypingDone] = useState<Set<string>>(new Set());
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => inputRef.current?.focus(), 400);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const toggleListening = () => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI: (new () => any) | undefined =
      win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = new SpeechRecognitionAPI();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setInput(transcript);
    };

    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
  };

  const markDone = (id: string) => {
    setTypingDone((prev) => new Set([...prev, id]));
  };

  return (
    <div className="relative flex flex-col h-full bg-white overflow-hidden">
      <CRTOverlay />

      {/* Message log */}
      <div className="relative flex-1 overflow-y-auto px-6 py-8 space-y-6 z-30">

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className={clsx(
                "max-w-2xl",
                msg.role === "user" && "ml-auto",
                msg.role === "system" && "mx-auto text-center"
              )}
            >
              {/* ── System message ── */}
              {msg.role === "system" && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="origin-left"
                >
                  <div className="border border-zinc-200 p-4 space-y-1">
                    <pre className="text-zinc-400 font-mono text-[11px] leading-relaxed whitespace-pre-wrap tracking-wide">
                      {msg.content}
                    </pre>
                  </div>
                </motion.div>
              )}

              {/* ── Assistant message ── */}
              {msg.role === "assistant" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.25em]">
                      DESTINY_TERMINAL
                    </span>
                    <div className="flex-1 h-px bg-zinc-100" />
                  </div>
                  <div className="pl-0">
                    {/* Only typewrite the latest assistant message */}
                    {idx === messages.length - 1 && !typingDone.has(msg.id) ? (
                      <TypewriterMessage
                        content={msg.content}
                        onDone={() => markDone(msg.id)}
                      />
                    ) : (
                      <p className="text-zinc-800 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── User message ── */}
              {msg.role === "user" && (
                <motion.div
                  initial={{ x: 20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  className="flex items-start gap-3 justify-end"
                >
                  <div className="max-w-sm">
                    <div className="flex items-center justify-end gap-2 mb-1">
                      <div className="flex-1 h-px bg-zinc-100" />
                      <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.25em]">YOU</span>
                    </div>
                    <p className="text-zinc-600 font-mono text-sm leading-relaxed text-right">
                      {msg.content}
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.25em]">
              PROCESSING
            </span>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <motion.span
                  key={i}
                  className="w-1 h-1 rounded-full bg-zinc-400"
                  animate={{ opacity: [0.2, 1, 0.2], scaleY: [0.5, 1.5, 0.5] }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.15,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="relative z-30 flex items-center gap-4 px-6 py-4 border-t border-zinc-200 bg-white/80 backdrop-blur-sm"
      >
        {/* Prompt symbol */}
        <span className="font-mono text-zinc-400 text-sm shrink-0 select-none">$_</span>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading || disabled}
          placeholder={placeholder}
          className={clsx(
            "flex-1 bg-transparent font-mono text-sm text-zinc-700 placeholder-zinc-400",
            "focus:outline-none caret-black",
            (loading || disabled) && "opacity-30 cursor-not-allowed"
          )}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Mic button */}
        <motion.button
          type="button"
          onClick={toggleListening}
          disabled={loading || disabled}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title={isListening ? "Stop listening" : "Speak your answer"}
          className={clsx(
            "shrink-0 p-2 border transition-all duration-200",
            isListening
              ? "border-zinc-700 text-zinc-900 bg-zinc-100 animate-pulse"
              : (loading || disabled)
              ? "border-zinc-200 text-zinc-300 cursor-not-allowed"
              : "border-zinc-300 text-zinc-400 hover:border-zinc-500 hover:text-zinc-600"
          )}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
        </motion.button>

        {/* Send button */}
        <motion.button
          type="submit"
          disabled={!input.trim() || loading || disabled}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className={clsx(
            "shrink-0 p-2 border transition-all duration-200",
            input.trim() && !loading && !disabled
              ? "border-zinc-500 text-zinc-700 hover:bg-black hover:text-white"
              : "border-zinc-200 text-zinc-300 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </motion.button>
      </form>

      {/* Bottom glow line */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-px z-40"
        style={{
          background: "linear-gradient(to right, transparent, rgba(0,0,0,0.3), transparent)",
        }}
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
