"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Shield, Zap } from "lucide-react";

interface AgentAdviceProps {
  angelAdvice: string | null;
  devilAdvice: string | null;
  onChoose?: (text: string) => void;
  disabled?: boolean;
}

export default function AgentAdvice({ angelAdvice, devilAdvice, onChoose, disabled }: AgentAdviceProps) {
  const canClick = !!onChoose && !disabled;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border border-zinc-200 overflow-hidden">
      {/* Guardian — light panel */}
      <AnimatePresence>
        {angelAdvice ? (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.5 }}
            onClick={() => canClick && onChoose(angelAdvice)}
            className={`relative bg-zinc-100 p-5 border-r border-zinc-200 overflow-hidden transition-colors duration-200 ${
              canClick ? "cursor-pointer hover:bg-zinc-200 active:bg-zinc-300 group" : ""
            }`}
          >
            {/* Subtle top accent line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="absolute top-0 left-0 right-0 h-px bg-zinc-400 origin-left"
            />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield size={12} className="text-zinc-500" />
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em]">
                  Guardian
                </span>
              </div>
              {canClick && (
                <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Choose ›
                </span>
              )}
            </div>

            <p className="text-zinc-700 text-sm leading-relaxed italic">
              &ldquo;{angelAdvice}&rdquo;
            </p>
          </motion.div>
        ) : (
          <div className="p-5 bg-zinc-50" />
        )}
      </AnimatePresence>

      {/* Chaos Agent — dark panel */}
      <AnimatePresence>
        {devilAdvice ? (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onClick={() => canClick && onChoose(devilAdvice!)}
            className={`relative bg-white p-5 overflow-hidden transition-colors duration-200 ${
              canClick ? "cursor-pointer hover:bg-zinc-50 active:bg-zinc-100 group" : ""
            }`}
          >
            {/* Subtle bottom accent line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="absolute bottom-0 left-0 right-0 h-px bg-zinc-200 origin-right"
            />

            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-zinc-400" />
                <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em]">
                  Chaos Agent
                </span>
              </div>
              {canClick && (
                <span className="font-mono text-[9px] text-zinc-400 uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Choose ›
                </span>
              )}
            </div>

            <p className="text-zinc-600 text-sm leading-relaxed italic">
              &ldquo;{devilAdvice}&rdquo;
            </p>
          </motion.div>
        ) : (
          <div className="p-5 bg-white" />
        )}
      </AnimatePresence>
    </div>
  );
}
