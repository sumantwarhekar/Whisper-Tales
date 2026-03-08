import type {
  CreateSessionResponse,
  ArchiveResponse,
  HeroProfile,
  StoryRound,
  GameSession,
} from "./types";

// ─── Internal helper ───────────────────────────────────────────────────────────

async function localFetch<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ─── Session ──────────────────────────────────────────────────────────────────

/** Create a brand-new game session with a UUID (no backend needed). */
export async function createSession(): Promise<CreateSessionResponse> {
  return localFetch<CreateSessionResponse>("/api/sessions");
}

// ─── Onboarding (Phase 1) ─────────────────────────────────────────────────────

/** Send a terminal message and get a Gemini-generated reply. */
export async function sendTerminalMessage(
  questionIndex: number,
  answer: string,
  previousAnswers: Partial<HeroProfile>,
  sessionId?: string
): Promise<{ reply: string; heroProfile: HeroProfile | null }> {
  return localFetch("/api/gemini/terminal", {
    sessionId,
    questionIndex,
    answer,
    previousAnswers,
  });
}

// ─── Story Loop (Phase 2) ──────────────────────────────────────────────────────

interface StorySceneRequest {
  hero: HeroProfile;
  previousRounds: Pick<StoryRound, "roundNumber" | "scene" | "userChoice">[];
  roundNumber: number;
  totalRounds: number;
  isFinale?: boolean;
}

interface StorySceneResponse {
  scene: string;
  angelAdvice: string;
  devilAdvice: string;
  imagePrompt: string;
}

/** Generate the next story scene + angel/devil advice via Gemini. */
export async function generateStoryScene(
  req: StorySceneRequest
): Promise<StorySceneResponse> {
  return localFetch<StorySceneResponse>("/api/gemini/story", req);
}

/** Generate the final epilogue text via Gemini. */
export async function generateFinale(
  req: Omit<StorySceneRequest, "isFinale">
): Promise<{ finaleText: string }> {
  return localFetch<{ finaleText: string }>("/api/gemini/story", {
    ...req,
    isFinale: true,
  });
}

// ─── Image Generation ─────────────────────────────────────────────────────────

/** Generate a scene illustration via Gemini image generation. Returns null on failure. */
export async function generateSceneImage(
  prompt: string,
  sessionId?: string,
  roundNumber?: number,
  artStyle?: string
): Promise<string | null> {
  try {
    const res = await localFetch<{ imageUrl: string | null }>(
      "/api/gemini/image",
      { prompt, sessionId, roundNumber, artStyle }
    );
    return res.imageUrl;
  } catch {
    return null;
  }
}

// ─── Narration (Phase 3) ───────────────────────────────────────────────────

/** Generate scene narration audio via Gemini TTS. Returns null on failure. */
export async function generateNarration(
  text: string,
  sessionId?: string,
  roundNumber?: number
): Promise<string | null> {
  try {
    const res = await localFetch<{ audioUrl: string | null }>(
      "/api/tts",
      { text, sessionId, roundNumber }
    );
    return res.audioUrl;
  } catch {
    return null;
  }
}

/** Generate background music via Lyria. Returns null on failure. */
export async function generateMusic(
  prompt: string,
  sessionId?: string,
  roundNumber?: number
): Promise<string | null> {
  try {
    const res = await localFetch<{ audioUrl: string | null }>(
      "/api/music",
      { prompt, sessionId, roundNumber }
    );
    return res.audioUrl;
  } catch {
    return null;
  }
}

// ─── Veo 2 AI Video (Phase 4) ─────────────────────────────────────────────────

/** Generate a Veo 2 cinematic video for the session finale. Returns null on failure. */
export async function generateVeoVideo(
  sessionId: string,
  prompt: string
): Promise<string | null> {
  try {
    const res = await localFetch<{ videoUrl: string | null }>(
      "/api/veo",
      { sessionId, prompt }
    );
    return res.videoUrl;
  } catch {
    return null;
  }
}

// ─── Archive ──────────────────────────────────────────────────────────────────

/** Fire-and-forget: persist a completed round to Firestore (non-blocking). */
export function saveRound(sessionId: string, round: StoryRound): void {
  fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ round }),
  }).catch(() => { /* non-critical */ });
}

/** Fire-and-forget: persist the finale text to Firestore (non-blocking). */
export function saveFinale(sessionId: string, finaleText: string): void {
  fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finaleText }),
  }).catch(() => { /* non-critical */ });
}

/**
 * Persist the full session and return a shareable link.
 * Saves to Firestore via the session API; falls back gracefully if unavailable.
 */
export async function archiveSession(
  sessionId: string,
  session?: GameSession
): Promise<ArchiveResponse> {
  const shareUrl = `${window.location.origin}/archive/${sessionId}`;

  if (session) {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...session, shareUrl }),
      });
    } catch {
      // Firestore unavailable — share URL still works via localStorage fallback
    }
  }

  return { sessionId, shareUrl };
}

/**
 * Retrieve an archived session — tries Firestore (server) first,
 * then falls back to localStorage for demo / offline mode.
 */
export async function getArchivedSession(sessionId: string): Promise<GameSession> {
  // Server-side (Firestore)
  try {
    const res = await fetch(`/api/sessions/${sessionId}`);
    if (res.ok) {
      const data = (await res.json()) as GameSession;
      if (data?.sessionId) return data;
    }
  } catch {
    // Fall through to localStorage
  }

  // Client-side localStorage fallback
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(`wt:session:${sessionId}`);
    if (raw) return JSON.parse(raw) as GameSession;
  }

  throw new Error("Session not found in Firestore or local archive");
}
