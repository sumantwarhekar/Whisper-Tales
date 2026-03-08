"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Volume2, VolumeX } from "lucide-react";

interface StorySceneProps {
  roundNumber: number;
  totalRounds: number;
  scene: string;
  imageUrl: string | null;
  imageLoading?: boolean;
  audioUrl?: string | null;
  audioLoading?: boolean;
}

function useNarration(audioUrl?: string | null) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  // Create / swap audio element whenever the URL changes — auto-play
  useEffect(() => {
    setReady(false);
    if (!audioUrl) return;

    const el = new Audio(audioUrl);
    el.oncanplaythrough = () => {
      setReady(true);
      el.play().catch(() => {
        // browsers may block autoplay without prior interaction — silently ignore
      });
    };
    el.onended = () => setReady(false);
    audioRef.current = el;

    return () => {
      el.pause();
      el.src = "";
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Keep audio element in sync with muted state
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  const toggleMute = () => setMuted((m) => !m);

  return { muted, ready, toggleMute };
}

export default function StoryScene({
  roundNumber,
  totalRounds,
  scene,
  imageUrl,
  imageLoading = false,
  audioUrl,
  audioLoading = false,
}: StorySceneProps) {
  const { muted, ready, toggleMute } = useNarration(audioUrl);

  return (
    <div className="flex flex-col gap-8">
      {/* Chapter progress */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: i < roundNumber ? 1 : 0.4 }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="block h-px w-10 origin-left"
              style={{
                background: i < roundNumber
                  ? "rgba(0,0,0,0.7)"
                  : "rgba(0,0,0,0.12)",
              }}
            />
          ))}
        </div>
        <motion.span
          key={roundNumber}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em]"
        >
          Chapter {roundNumber} of {totalRounds}
        </motion.span>
      </div>

      {/* Scene image / artwork */}
      <motion.div
        key={imageUrl ?? `art-${roundNumber}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="relative w-full aspect-video overflow-hidden border border-zinc-200 bg-white"
      >
        {imageLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
            <p className="text-zinc-400 font-mono text-[11px] tracking-widest uppercase">
              Rendering scene...
            </p>
          </div>
        ) : imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Scene ${roundNumber}`}
            className="absolute inset-0 w-full h-full object-cover grayscale contrast-110"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-100 to-zinc-200" />
        )}

        {/* Cinematic bars */}
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        {/* Chapter label */}
        <div className="absolute bottom-3 right-4 font-mono text-[10px] text-zinc-300 uppercase tracking-[0.3em]">
          Chapter {roundNumber}
        </div>
        {/* Speaker / mute button */}
        <button
          onClick={toggleMute}
          aria-label={muted ? "Unmute music" : "Mute music"}
          className="absolute bottom-3 left-4 flex items-center justify-center w-7 h-7 border border-white/30 bg-black/40 hover:bg-black/70 transition-colors"
        >
          {audioLoading && !ready ? (
            <Loader2 size={13} className="text-white/60 animate-spin" />
          ) : muted ? (
            <VolumeX size={13} className="text-white/70" />
          ) : (
            <Volume2 size={13} className="text-white" />
          )}
        </button>
      </motion.div>

      {/* Scene narration */}
      <motion.div
        key={scene}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="relative pl-5"
      >
        <div className="absolute left-0 top-1 bottom-1 w-px bg-gradient-to-b from-black/40 via-black/20 to-transparent" />
        <p className="text-zinc-700 leading-[1.85] text-base" style={{ fontFamily: "var(--font-playfair, serif)" }}>
          {scene}
        </p>
      </motion.div>
    </div>
  );
}

