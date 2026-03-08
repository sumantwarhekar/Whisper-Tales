"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Clock, Loader2, Pause, Video, Volume2 } from "lucide-react";
import type { GameSession } from "@/lib/types";

function ArchiveNarrationPlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [audioUrl]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause narration" : "Play narration"}
        className="flex items-center gap-1.5 font-mono text-[10px] text-zinc-500 uppercase tracking-[0.3em] hover:text-zinc-300 transition-colors"
      >
        {playing ? <Pause size={11} /> : <Volume2 size={11} />}
        {playing ? "Pause" : "Narrate"}
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} className="hidden" />
    </div>
  );
}

interface StoryArchiveProps {
  session: GameSession;
}

export default function StoryArchive({ session }: StoryArchiveProps) {
  const { hero, rounds, finaleText, videoUrl, createdAt } = session;

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="max-w-3xl mx-auto space-y-10 py-10 px-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <p className="font-mono text-xs text-amber-400/70 uppercase tracking-[0.3em]">
          Whisper Tales — The Archive
        </p>
        <h1 className="text-4xl font-serif font-bold text-zinc-100">
          {hero?.name ?? "Unknown Hero"}&apos;s Tale
        </h1>
        <div className="flex items-center justify-center gap-4 text-zinc-500 text-xs font-mono">
          <span className="flex items-center gap-1">
            <BookOpen size={12} />
            {rounds.length} chapters
          </span>
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {formattedDate}
          </span>
        </div>
      </motion.div>

      {/* Hero Profile */}
      {hero && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 gap-3 p-5 bg-zinc-900/50 border border-zinc-700/40 rounded-xl"
        >
          {[
            { label: "Known As", value: hero.name },
            { label: "World", value: hero.world },
            { label: "Desire", value: hero.desire },
            { label: "Fatal Flaw", value: hero.flaw },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest mb-0.5">
                {label}
              </p>
              <p className="text-zinc-200 text-sm">{value}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Story Rounds */}
      <div className="space-y-10">
        {rounds.map((round, idx) => (
          <motion.div
            key={round.roundNumber}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * idx }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                Chapter {round.roundNumber}
              </span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            {/* Scene Image */}
            {round.imageUrl && (
              <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-zinc-700/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={round.imageUrl}
                  alt={`Chapter ${round.roundNumber}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </div>
            )}

            <p className="text-zinc-300 leading-relaxed font-serif">{round.scene}</p>

            {round.audioUrl && <ArchiveNarrationPlayer audioUrl={round.audioUrl} />}

            {/* Advice */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              {round.angelAdvice && (
                <div className="p-3 bg-sky-950/20 border border-sky-700/30 rounded-lg">
                  <p className="text-sky-400/70 font-mono uppercase tracking-wider mb-1 text-[10px]">
                    Guardian advised
                  </p>
                  <p className="text-sky-200/70 italic">&ldquo;{round.angelAdvice}&rdquo;</p>
                </div>
              )}
              {round.devilAdvice && (
                <div className="p-3 bg-red-950/20 border border-red-700/30 rounded-lg">
                  <p className="text-red-400/70 font-mono uppercase tracking-wider mb-1 text-[10px]">
                    Chaos tempted
                  </p>
                  <p className="text-red-200/70 italic">&ldquo;{round.devilAdvice}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="text-sm text-zinc-400 pl-4 border-l-2 border-amber-500/40">
              <span className="text-amber-500/60 font-mono text-[10px] uppercase">
                Your choice:{" "}
              </span>
              {round.userChoice}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Finale */}
      {finaleText && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded">
              The Finale
            </span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>
          <p className="text-zinc-200 font-serif text-base italic leading-relaxed text-center">
            {finaleText}
          </p>
        </motion.div>
      )}

      {/* Final Video */}
      {videoUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="space-y-3"
        >
          <p className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
            <Video size={12} />
            Your fate, rendered in motion
          </p>
          <div className="rounded-xl overflow-hidden border border-zinc-700/40">
            <video
              src={videoUrl}
              controls
              loop
              className="w-full aspect-video bg-black"
              playsInline
            />
          </div>
        </motion.div>
      )}
    </div>
  );
}
