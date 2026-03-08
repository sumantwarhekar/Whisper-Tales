"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import StoryScene from "@/components/StoryScene";
import AgentAdvice from "@/components/AgentAdvice";
import UserInput from "@/components/UserInput";
import FinalVideo from "@/components/FinalVideo";
import { generateStoryScene, generateSceneImage, generateFinale, generateNarration, generateMusic, archiveSession, saveRound, saveFinale } from "@/lib/api";
import type { StoryRound, HeroProfile, GameSession } from "@/lib/types";

const TOTAL_ROUNDS = 5;

// ── Local scene generator — used when Gemini quota is exceeded ────────────────
function buildLocalScene(hero: HeroProfile, round: number, prevRounds: { userChoice: string }[]) {
  const lastChoice = prevRounds.length > 0 ? prevRounds[prevRounds.length - 1].userChoice : null;
  const choiceNote = lastChoice ? ` Your choice — "${lastChoice.substring(0, 60)}" — has led you here.` : "";
  const genre = hero.genre ?? "gothic dark fantasy";
  const scenes: { scene: string; angelAdvice: string; devilAdvice: string }[] = [
    {
      scene: `${hero.name} stands at the threshold of ${hero.world}. The desire for ${hero.desire} burns behind your eyes, but already the shadow of ${hero.flaw} stirs within. A door stands before you — sealed with a lock that recognises only truth.${choiceNote}`,
      angelAdvice: `Speak truthfully, ${hero.name}. The door knows falsehood. Your ${hero.desire} is attainable only through honest reckoning.`,
      devilAdvice: `Locks were made to be picked, not obeyed. Your ${hero.flaw} is not a confession — it is a tool. Use it.`,
    },
    {
      scene: `Deep in ${hero.world}, a figure emerges from shadows and offers you exactly what you seek — ${hero.desire} — but the price is your silence about something you know. Your ${hero.flaw} whispers that this is acceptable.${choiceNote}`,
      angelAdvice: `Every bargain with darkness exacts more than the stated price. Walk away — ${hero.desire} earned cleanly is worth ten times this.`,
      devilAdvice: `Silence is merely the absence of noise. You can always speak later — once ${hero.desire} is yours and no one can take it back.`,
    },
    {
      scene: `In the heart of ${hero.world} you discover a letter addressed to you, written in a hand you should not recognise but do. It reveals that your pursuit of ${hero.desire} has collateral consequences — ones your ${hero.flaw} may have blinded you to.${choiceNote}`,
      angelAdvice: `This letter is a gift. Rarest of things: a warning before the fall. Heed it — adjust your course before ${hero.flaw} costs you everything.`,
      devilAdvice: `Warnings are written by the weak for the uncertain. You are neither. Burn the letter and move on. ${hero.desire} does not wait.`,
    },
    {
      scene: `A guardian blocks the only passage deeper into ${hero.world}. They have witnessed every soul driven by ${hero.desire} and found most wanting. They look at you and name your ${hero.flaw} before you utter a word.${choiceNote}`,
      angelAdvice: `This guardian is not your enemy. They are your mirror. Face what they show you — it is the only currency they respect.`,
      devilAdvice: `Guardians respect power, not virtue. Show them why ${hero.name} is different from every broken pilgrim who came before.`,
    },
    {
      scene: `The final chamber in ${hero.world} holds exactly what you sought — ${hero.desire} — materialised and waiting. But so does the truest consequence of your ${hero.flaw}. Both cannot leave with you. The cosmos demands a reckoning.${choiceNote}`,
      angelAdvice: `You already know what you must choose. You have known since the first door. Let ${hero.flaw} go — or let it define you forever.`,
      devilAdvice: `Take everything. Legacy is written by survivors, not saints. ${hero.name} will be remembered — make sure it is for the boldest choice.`,
    },
  ];
  const _ = genre; // used for typing; genre will be embedded in AI prompts when available
  return scenes[Math.min(round - 1, scenes.length - 1)];
}

export default function StoryPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  // ── Hero profile (loaded from localStorage, set by terminal page) ────────────
  const [hero, setHero] = useState<HeroProfile | null>(null);

  // ── Story state ──────────────────────────────────────────────────────────────
  const [currentRound, setCurrentRound] = useState(0);  // 0-indexed
  const [rounds, setRounds] = useState<StoryRound[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [isFinale, setIsFinale] = useState(false);
  const [finaleText, setFinaleText] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);

  // ── Current scene ─────────────────────────────────────────────────────────
  const [scene, setScene] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [finaleAudioUrl, setFinaleAudioUrl] = useState<string | null>(null);
  const [finaleAudioLoading, setFinaleAudioLoading] = useState(false);
  const [angelAdvice, setAngelAdvice] = useState<string>("");
  const [devilAdvice, setDevilAdvice] = useState<string>("");
  const [imagePrompt, setImagePrompt] = useState<string>("");

  const sceneInitialized = useRef(false);

  // ── Load hero from localStorage on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`wt:hero:${sessionId}`);
      if (stored) {
        setHero(JSON.parse(stored));
      } else {
        // Generic fallback so demo mode still works
        setHero({
          name: "A wandering stranger of no fixed allegiance",
          world: "A crumbling gothic empire at the edge of a forgotten age",
          desire: "To uncover a truth that others would kill to hide",
          flaw: "An inability to let go of what should be left behind",
          genre: "gothic dark fantasy",
          artStyle: "dramatic black and white gothic illustration, high contrast chiaroscuro",
        });
      }
    } catch {
      setHero({
        name: "The Nameless One",
        world: "A realm between worlds",
        desire: "Freedom",
        flaw: "Pride",
        genre: "gothic dark fantasy",
        artStyle: "dramatic black and white gothic illustration",
      });
    }
  }, [sessionId]);

  // ── Generate first scene once hero is loaded ─────────────────────────────────
  useEffect(() => {
    if (hero && !sceneInitialized.current) {
      sceneInitialized.current = true;
      loadScene(1, hero, []);
    }
  }, [hero]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load a scene (called on init + after each choice) ─────────────────────
  const loadScene = async (
    roundNum: number,
    heroProfile: HeroProfile,
    prevRounds: StoryRound[]
  ) => {
    setLoading(true);
    setImageUrl(null);
    setAudioUrl(null);
    setAudioLoading(false);
    setStoryError(null);

    try {
      const data = await generateStoryScene({
        hero: heroProfile,
        previousRounds: prevRounds.map((r) => ({
          roundNumber: r.roundNumber,
          scene: r.scene,
          userChoice: r.userChoice,
        })),
        roundNumber: roundNum,
        totalRounds: TOTAL_ROUNDS,
      });

      setScene(data.scene);
      setAngelAdvice(data.angelAdvice);
      setDevilAdvice(data.devilAdvice);
      setImagePrompt(data.imagePrompt ?? "");
      setCurrentRound(roundNum - 1);

      // Generate scene image in the background — doesn't block story display
      if (data.imagePrompt) {
        setImageLoading(true);
        generateSceneImage(data.imagePrompt, sessionId, roundNum, heroProfile.artStyle)
          .then((url) => {
            if (url) setImageUrl(url);
          })
          .catch(() => { /* fall through to SVG artwork */ })
          .finally(() => setImageLoading(false));
      }

      // Generate background music based on the scene in the background
      setAudioLoading(true);
      const musicPrompt = data.imagePrompt
        ? `${heroProfile.genre ?? "dark gothic"} background music for a scene: ${data.imagePrompt.substring(0, 200)}. Cinematic, atmospheric, no vocals.`
        : `${heroProfile.genre ?? "dark gothic"} atmospheric background music for chapter ${roundNum} of ${TOTAL_ROUNDS}, cinematic orchestral, no vocals.`;
      generateMusic(musicPrompt, sessionId, roundNum)
        .then((url) => { if (url) setAudioUrl(url); })
        .catch(() => { /* non-critical */ })
        .finally(() => setAudioLoading(false));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Vertex AI credentials not configured") || msg.includes("credentials not configured")) {
        setStoryError("Vertex AI service account credentials are missing. Check FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env.local.");
      } else if (msg.includes("QUOTA_EXCEEDED") || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) {
        setStoryError("Vertex AI quota exceeded. Check your billing status at console.cloud.google.com.");
      } else {
        setStoryError("Could not generate scene. Check the server logs and verify Vertex AI API is enabled.");
      }
      // Use local hero-aware fallback so the story still reflects the user's character
      const local = buildLocalScene(heroProfile, roundNum, prevRounds);
      setScene(local.scene);
      setAngelAdvice(local.angelAdvice);
      setDevilAdvice(local.devilAdvice);
      setCurrentRound(roundNum - 1);
    } finally {
      setLoading(false);
    }
  };

  // ── Handle user's choice ─────────────────────────────────────────────────
  const handleChoice = async (choice: string) => {
    if (!hero || loading) return;
    setLoading(true);

    const completedRound: StoryRound = {
      roundNumber: currentRound + 1,
      scene,
      imageUrl,
      audioUrl,
      imagePrompt,
      angelAdvice,
      devilAdvice,
      userChoice: choice,
      outcome: "",
    };

    const updatedRounds = [...rounds, completedRound];
    setRounds(updatedRounds);

    // Persist completed round to Firestore (fire-and-forget)
    saveRound(sessionId, completedRound);

    try {
      if (currentRound + 1 >= TOTAL_ROUNDS) {
        // All rounds done — generate finale
        const { finaleText: text } = await generateFinale({
          hero,
          previousRounds: updatedRounds.map((r) => ({
            roundNumber: r.roundNumber,
            scene: r.scene,
            userChoice: r.userChoice,
          })),
          roundNumber: TOTAL_ROUNDS,
          totalRounds: TOTAL_ROUNDS,
        });
        setFinaleText(text);
        setIsFinale(true);
        saveFinale(sessionId, text); // Persist finale to Firestore (fire-and-forget)
        setLoading(false);
        // Generate TTS narration for the finale
        setFinaleAudioLoading(true);
        generateNarration(text, sessionId, 0)
          .then((url) => { if (url) setFinaleAudioUrl(url); })
          .catch(() => { /* non-critical */ })
          .finally(() => setFinaleAudioLoading(false));
      } else {
        // Load next scene (setLoading(false) is called inside loadScene's finally)
        await loadScene(currentRound + 2, hero, updatedRounds);
      }
    } catch {
      if (currentRound + 1 >= TOTAL_ROUNDS) {
        const fallbackText = `Your choices across ${TOTAL_ROUNDS} harrowing chapters have woven a fate unlike any other. The cosmos bends to acknowledge what you have become — whether hero, villain, or something beautifully in between, your tale is now legend.`;
        setFinaleText(fallbackText);
        setIsFinale(true);
        saveFinale(sessionId, fallbackText); // Persist fallback finale too
        setLoading(false);
        // Generate TTS narration for the fallback finale
        setFinaleAudioLoading(true);
        generateNarration(fallbackText, sessionId, 0)
          .then((url) => { if (url) setFinaleAudioUrl(url); })
          .catch(() => { /* non-critical */ })
          .finally(() => setFinaleAudioLoading(false));
      } else {
        await loadScene(currentRound + 2, hero, updatedRounds);
      }
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = async () => {
    setArchiving(true);
    try {
      const fullSession: GameSession = {
        sessionId,
        status: "archive",
        hero,
        rounds,
        currentRound: rounds.length,
        totalRounds: TOTAL_ROUNDS,
        finaleText,
        videoUrl: null,
        createdAt: new Date().toISOString(),
        shareUrl: null,
      };
      const { shareUrl: url } = await archiveSession(sessionId, fullSession);
      setShareUrl(url);
    } catch {
      setShareUrl(`${window.location.origin}/archive/${sessionId}`);
    } finally {
      setArchiving(false);
    }
  };

  const isInitializing = loading && !scene;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="shrink-0 border-b border-zinc-200 px-6 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <a
            href="/"
            className="font-mono text-[10px] text-zinc-400 uppercase tracking-[0.35em] hover:text-zinc-900 transition-colors duration-200 cursor-pointer border-b border-transparent hover:border-zinc-400"
          >
            Whisper Tales
          </a>
        </div>
        {!isFinale && (
          <span className="font-mono text-[10px] text-zinc-300 uppercase tracking-widest">
            Ch. {Math.min(currentRound + 1, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
          </span>
        )}
      </motion.header>

      {/* Initialising skeleton */}
      {isInitializing && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6">
          <motion.div
            className="w-16 h-16 border border-zinc-300 flex items-center justify-center"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, ease: "linear", repeat: Infinity }}
          >
            <div className="w-8 h-8 border border-zinc-500" />
          </motion.div>
          <p className="font-mono text-[11px] text-zinc-400 uppercase tracking-[0.4em]">
            Weaving your story...
          </p>
        </div>
      )}

      {/* API key error banner */}
      {storyError && !isInitializing && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mt-4 px-4 py-3 border border-zinc-300 bg-zinc-50 font-mono text-[11px] text-zinc-500"
        >
          ⚠ {storyError}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {isFinale ? (
          <motion.div
            key="finale"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 overflow-y-auto px-4 py-10"
          >
            <FinalVideo
              finaleText={finaleText}
              rounds={rounds}
              shareUrl={shareUrl}
              onArchive={handleArchive}
              archiving={archiving}
              audioUrl={finaleAudioUrl}
              audioLoading={finaleAudioLoading}
            />
          </motion.div>
        ) : scene ? (
          <motion.div
            key={`round-${currentRound}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 flex flex-col gap-8 max-w-3xl mx-auto w-full px-6 py-10"
          >
            {/* Scene */}
            <StoryScene
              roundNumber={currentRound + 1}
              totalRounds={TOTAL_ROUNDS}
              scene={scene}
              imageUrl={imageUrl}
              imageLoading={imageLoading}
              audioUrl={audioUrl}
              audioLoading={audioLoading}
            />

            {/* Agent Advice — cards are clickable choices */}
            {(angelAdvice || devilAdvice) && (
              <AgentAdvice
                angelAdvice={angelAdvice}
                devilAdvice={devilAdvice}
                onChoose={handleChoice}
                disabled={loading}
              />
            )}

            {/* Divider */}
            <div className="h-px bg-zinc-100" />

            {/* User Input */}
            <div className="mt-auto">
              <UserInput
                onSubmit={handleChoice}
                loading={loading}
                disabled={loading}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
