"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send, Mic, MicOff, Loader2 } from "lucide-react";
import clsx from "clsx";

interface UserInputProps {
  onSubmit: (choice: string) => void;
  loading: boolean;
  disabled?: boolean;
}

export default function UserInput({
  onSubmit,
  loading,
  disabled = false,
}: UserInputProps) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading || disabled) return;
    onSubmit(trimmed);
    setText("");
  };

  // ── Web Speech API ───────────────────────────────────────────────────────────
  const toggleListening = () => {
    if (typeof window === "undefined") return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const win = window as any;
    const SpeechRecognitionAPI = win.SpeechRecognition ?? win.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setText((prev) => (prev + " " + transcript).trim());
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="space-y-3">
      {/* Free-form input */}
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 bg-white border border-zinc-200 px-4 py-3 focus-within:border-zinc-400 transition-colors duration-300"
      >
        <span className="text-zinc-400 font-mono text-sm shrink-0 select-none">▸</span>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading || disabled}
          placeholder="Describe your action..."
          className={clsx(
            "flex-1 bg-transparent font-mono text-sm text-zinc-700 placeholder-zinc-400",
            "focus:outline-none caret-black",
            (loading || disabled) && "opacity-40 cursor-not-allowed"
          )}
        />

        {/* Voice button */}
        <button
          type="button"
          onClick={toggleListening}
          disabled={loading || disabled}
          className={clsx(
            "shrink-0 p-1.5 transition-all duration-200",
            isListening
              ? "text-zinc-700 animate-pulse"
              : "text-zinc-300 hover:text-zinc-500",
            (loading || disabled) && "cursor-not-allowed opacity-30"
          )}
          title={isListening ? "Stop listening" : "Speak your choice"}
        >
          {isListening ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        {/* Send button — outlined square */}
        <motion.button
          type="submit"
          disabled={!text.trim() || loading || disabled}
          whileHover={text.trim() && !loading && !disabled ? { scale: 1.1 } : {}}
          whileTap={text.trim() && !loading && !disabled ? { scale: 0.92 } : {}}
          className={clsx(
            "shrink-0 w-7 h-7 flex items-center justify-center border transition-all duration-200",
            text.trim() && !loading && !disabled
              ? "border-zinc-600 text-zinc-700 hover:bg-black hover:text-white"
              : "border-zinc-200 text-zinc-300 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Send size={12} />
          )}
        </motion.button>
      </motion.form>
    </div>
  );
}
