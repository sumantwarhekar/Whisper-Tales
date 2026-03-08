"use client";

import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, AnimatePresence, type Variants } from "framer-motion";
import { TypeAnimation } from "react-type-animation";
import { createSession } from "@/lib/api";
import { useState, useEffect, useRef } from "react";

// ── Animated noise grain overlay ──────────────────────────────────────────────
function GrainOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 opacity-[0.035]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: "repeat",
        backgroundSize: "128px 128px",
        mixBlendMode: "overlay",
      }}
    />
  );
}

// ── Animated grid lines ───────────────────────────────────────────────────────
function GridLines() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Horizontal lines */}
      {[15, 30, 50, 70, 85].map((pct) => (
        <motion.div
          key={pct}
          className="absolute left-0 right-0 h-px bg-black/[0.04]"
          style={{ top: `${pct}%` }}
          initial={{ scaleX: 0, originX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.8, delay: pct / 100, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {/* Vertical lines */}
      {[10, 25, 50, 75, 90].map((pct) => (
        <motion.div
          key={pct}
          className="absolute top-0 bottom-0 w-px bg-black/[0.03]"
          style={{ left: `${pct}%` }}
          initial={{ scaleY: 0, originY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 2, delay: pct / 120, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  );
}

// ── Magnetic button ───────────────────────────────────────────────────────────
function MagneticButton({ children, onClick, disabled }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouse = (e: React.MouseEvent) => {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.35);
    y.set((e.clientY - cy) * 0.35);
  };

  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      onClick={onClick}
      disabled={disabled}
      className="group relative px-9 py-4 bg-black text-white font-mono font-bold text-sm tracking-[0.15em] uppercase rounded-none overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {/* Hover fill sweep */}
      <motion.span
        className="absolute inset-0 bg-white origin-left"
        initial={{ scaleX: 0 }}
        whileHover={{ scaleX: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Text — mix-blend-mode:difference so it auto-inverts over the white sweep */}
      <motion.span
        className="relative z-10 flex items-center gap-3"
        style={{ mixBlendMode: "difference", color: "white" }}
      >
        {children}
      </motion.span>
      {/* Corner accents — same blend trick */}
      <span className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-white" style={{ mixBlendMode: "difference" }} />
      <span className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-white" style={{ mixBlendMode: "difference" }} />
      <span className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-white" style={{ mixBlendMode: "difference" }} />
      <span className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-white" style={{ mixBlendMode: "difference" }} />
    </motion.button>
  );
}

// ── Floating orb ──────────────────────────────────────────────────────────────
function FloatingOrb({ delay = 0, size = 400, x = "50%", y = "50%" }: {
  delay?: number; size?: number; x?: string; y?: string;
}) {
  return (
    <motion.div
      className="pointer-events-none absolute rounded-full"
      style={{
        width: size,
        height: size,
        left: x,
        top: y,
        translateX: "-50%",
        translateY: "-50%",
        background: "radial-gradient(circle, rgba(0,0,0,0.04) 0%, transparent 70%)",
      }}
      animate={{
        scale: [1, 1.15, 1],
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.4 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

const STATS = [
  { value: "4", label: "Questions" },
  { value: "5", label: "Chapters" },
  { value: "∞", label: "Fates" },
];

export default function HomePage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [bootDone, setBootDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBootDone(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleStart = async () => {
    setStarting(true);
    try {
      const { sessionId } = await createSession();
      router.push(`/terminal/${sessionId}`);
    } catch {
      router.push("/terminal/demo");
    }
  };

  return (
    <main className="relative min-h-screen bg-white flex flex-col items-center justify-center overflow-hidden select-none">
      <GrainOverlay />
      <GridLines />
      <FloatingOrb size={700} x="50%" y="40%" delay={0} />
      <FloatingOrb size={400} x="15%" y="70%" delay={2} />
      <FloatingOrb size={300} x="85%" y="25%" delay={4} />

      {/* Top status bar */}
      <motion.div
        className="absolute top-0 left-0 right-0 flex items-center justify-between px-8 py-4 border-b border-zinc-100"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.3em]">
          WHISPER_TALES.EXE
        </span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-widest">v1.0.0</span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
            <span className="font-mono text-[10px] text-zinc-400 uppercase tracking-widest">LIVE</span>
          </span>
        </div>
      </motion.div>

      <AnimatePresence>
        {bootDone && (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="relative z-10 flex flex-col items-center gap-7 px-6 text-center max-w-4xl"
          >
            {/* Eyebrow */}
            <motion.div variants={fadeUp} className="flex items-center gap-3">
              <div className="h-px w-12 bg-black/30" />
              <span className="font-mono text-[11px] text-zinc-400 uppercase tracking-[0.4em]">
                AI Interactive Fiction
              </span>
              <div className="h-px w-12 bg-black/30" />
            </motion.div>

            {/* Hero title */}
            <motion.div variants={fadeUp} className="space-y-2">
              <h1 className="text-[clamp(3rem,10vw,7rem)] font-serif font-black text-zinc-900 leading-[0.9] tracking-tighter">
                Whisper
              </h1>
              <h1 className="text-[clamp(3rem,10vw,7rem)] font-serif font-black leading-[0.9] tracking-tighter"
                style={{
                  WebkitTextStroke: "2px rgba(0,0,0,0.8)",
                  color: "transparent",
                }}
              >
                Tales
              </h1>
            </motion.div>

            {/* Typewriter subtitle */}
            <motion.div variants={fadeUp} className="h-8">
              <TypeAnimation
                sequence={[
                  800,
                  "Enter the Destiny Terminal.",
                  1200,
                  "Answer four questions.",
                  1000,
                  "Then live — or die — by your choices.",
                  3000,
                  "",
                  500,
                ]}
                wrapper="p"
                speed={55}
                repeat={Infinity}
                className="text-zinc-400 font-mono text-sm tracking-wide"
              />
            </motion.div>

            {/* CTA */}
            <motion.div variants={fadeUp}>
              <MagneticButton onClick={handleStart} disabled={starting}>
                {starting ? (
                  <>
                    <span className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                    Opening Portal
                  </>
                ) : (
                  <>
                    <span>Begin Your Tale</span>
                    <motion.span
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      →
                    </motion.span>
                  </>
                )}
              </MagneticButton>
            </motion.div>

            {/* Stats row */}
            <motion.div variants={fadeUp} className="flex items-center gap-8">
              {STATS.map((s, i) => (
                <div key={s.label} className="flex items-center gap-8">
                  <div className="text-center">
                    <p className="text-2xl font-serif font-black text-zinc-900">{s.value}</p>
                    <p className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.25em] mt-1">{s.label}</p>
                  </div>
                  {i < STATS.length - 1 && <div className="h-6 w-px bg-zinc-100" />}
                </div>
              ))}
            </motion.div>

            {/* Feature row */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-zinc-100 border border-zinc-100 w-full">
              {[
                { n: "01", title: "The Terminal", desc: "Four questions bind your soul to the story's world, era, hunger and flaw." },
                { n: "02", title: "Angel & Devil", desc: "One guardian, one chaos agent — both want you. Neither is fully honest." },
                { n: "03", title: "Your Fate", desc: "Five chapters. Real AI images. Your ending rendered as cinematic video." },
              ].map((f) => (
                <motion.div
                  key={f.n}
                  whileHover={{ backgroundColor: "rgba(0,0,0,0.033)" }}
                  className="p-4 space-y-2 transition-colors duration-300"
                >
                  <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-[0.3em]">{f.n}</span>
                  <p className="font-mono text-xs font-semibold text-zinc-700">{f.title}</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 py-4 border-t border-zinc-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2, duration: 0.8 }}
      >
        <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-[0.25em]">
          Gemini · Vertex AI · Veo · Firestore
        </span>
        <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-[0.25em]">
          © 2026 Whisper Tales
        </span>
      </motion.div>
    </main>
  );
}
