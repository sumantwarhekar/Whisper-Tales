"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Share2, Volume2, VolumeX } from "lucide-react";
import type { StoryRound } from "@/lib/types";

interface FinalVideoProps {
  finaleText: string | null;
  rounds: StoryRound[];
  shareUrl: string | null;
  onArchive: () => void;
  archiving: boolean;
  audioUrl?: string | null;
  audioLoading?: boolean;
}

// Auto-play hook — same pattern as StoryScene
function useNarration(audioUrl?: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    if (!audioUrl) return;
    const el = new Audio(audioUrl);
    el.oncanplaythrough = () => {
      setReady(true);
      el.play().catch(() => {});
    };
    el.onended = () => setReady(false);
    audioRef.current = el;
    return () => {
      el.pause();
      el.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  return { muted, ready, toggleMute: () => setMuted((m) => !m) };
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FinalVideo({
  finaleText,
  rounds,
  shareUrl,
  onArchive,
  archiving,
  audioUrl,
  audioLoading = false,
}: FinalVideoProps) {
  const { muted, ready, toggleMute } = useNarration(audioUrl);
  const images = rounds.filter((r) => r.imageUrl);
  const [slide, setSlide] = useState(0);

  // Auto-advance slideshow every 4 seconds
  useEffect(() => {
    if (images.length < 2) return;
    const timer = setInterval(() => {
      setSlide((s) => (s + 1) % images.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [images.length]);

  const prev = () => setSlide((s) => (s - 1 + images.length) % images.length);
  const next = () => setSlide((s) => (s + 1) % images.length);

  const handleShareCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch { /* clipboard access denied */ }
  };

  return (
    <div className="flex flex-col gap-10 items-center max-w-2xl mx-auto text-center">

      {/* Finale heading */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="space-y-3"
      >
        <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.4em]">
          Your Fate is Sealed
        </p>
        <div className="flex items-center justify-center gap-3">
          <h2 className="text-3xl font-serif font-bold text-zinc-900">
            The Grand Finale
          </h2>
          {/* TTS mute button */}
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute narration" : "Mute narration"}
            className="flex items-center justify-center w-7 h-7 border border-zinc-300 bg-zinc-100 hover:bg-zinc-200 transition-colors"
          >
            {audioLoading && !ready ? (
              <Loader2 size={13} className="text-zinc-400 animate-spin" />
            ) : muted ? (
              <VolumeX size={13} className="text-zinc-400" />
            ) : (
              <Volume2 size={13} className="text-zinc-600" />
            )}
          </button>
        </div>
        <div className="h-px w-16 bg-zinc-200 mx-auto" />
      </motion.div>

      {/* Finale narrative */}
      {finaleText && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative px-6 py-5 border border-zinc-200 bg-zinc-50 text-left w-full"
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-black/20 to-transparent" />
          <p className="text-zinc-700 leading-[1.9] font-serif text-base italic">
            {finaleText}
          </p>
        </motion.div>
      )}

      {/* ─ Scene Slideshow ──────────────────────────────────────────────── */}
      {images.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="w-full space-y-2"
        >
          <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em] text-left">
            Scenes from Your Journey
          </p>

          <div className="relative border border-zinc-200 bg-zinc-900 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.img
                key={slide}
                src={images[slide].imageUrl!}
                alt={`Chapter ${images[slide].roundNumber}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full aspect-video object-cover"
              />
            </AnimatePresence>

            {/* Prev / Next */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prev}
                  aria-label="Previous scene"
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 border border-white/30 bg-black/40 flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft size={14} className="text-white" />
                </button>
                <button
                  onClick={next}
                  aria-label="Next scene"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 border border-white/30 bg-black/40 flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronRight size={14} className="text-white" />
                </button>
              </>
            )}

            {/* Dot indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    aria-label={`Go to chapter ${images[i].roundNumber}`}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === slide ? "bg-white" : "bg-white/35 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest text-right">
            Chapter {images[slide].roundNumber} · {slide + 1} of {images.length}
          </p>
        </motion.div>
      )}

      {/* ─ Choices Made ─────────────────────────────────────────────────── */}
      {rounds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full text-left space-y-3"
        >
          <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em]">
            The Choices You Made
          </p>

          <div className="border border-zinc-200 divide-y divide-zinc-100">
            {rounds.map((r) => (
              <div key={r.roundNumber} className="px-4 py-3 space-y-1.5">
                <p className="font-mono text-[9px] text-zinc-400 uppercase tracking-widest">
                  Chapter {r.roundNumber}
                </p>
                <p className="text-zinc-400 text-xs font-serif leading-relaxed line-clamp-2">
                  {r.scene.split(".")[0]}.
                </p>
                <p className="text-zinc-800 text-xs font-mono leading-snug border-l-2 border-zinc-300 pl-2.5">
                  &ldquo;{r.userChoice}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Archive / Share */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="flex flex-wrap gap-3 justify-center w-full"
      >
        {!shareUrl ? (
          <button
            onClick={onArchive}
            disabled={archiving}
            className="flex items-center gap-2 px-6 py-2.5 border border-zinc-300 text-zinc-500 font-mono text-xs uppercase tracking-widest hover:border-zinc-500 hover:text-zinc-700 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {archiving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Share2 size={13} />
            )}
            {archiving ? "Saving..." : "Get Share Link"}
          </button>
        ) : (
          <button
            onClick={handleShareCopy}
            className="flex items-center gap-2 px-6 py-2.5 border border-zinc-300 text-zinc-500 font-mono text-xs uppercase tracking-widest hover:border-zinc-500 hover:text-zinc-700 transition-all duration-200"
          >
            <Share2 size={13} />
            Copy Link
          </button>
        )}
      </motion.div>
    </div>
  );
}
