import { useCallback, useEffect, useReducer, useRef } from "react";
import type {
  GameSession,
  HeroProfile,
  OnboardingState,
  SessionStatus,
  StoryRound,
  TerminalMessage,
} from "@/lib/types";
import {
  createSession,
  sendTerminalMessage,
  archiveSession,
} from "@/lib/api";

// ─── State ────────────────────────────────────────────────────────────────────

interface StoryState {
  loading: boolean;
  error: string | null;
  session: GameSession | null;
  onboarding: OnboardingState;
  currentScene: string | null;
  angelAdvice: string | null;
  devilAdvice: string | null;
  currentImageUrl: string | null;
  videoPolling: boolean;
}

const initialOnboarding: OnboardingState = {
  currentQuestion: "name",
  answers: {},
  messages: [
    {
      id: "boot",
      role: "system",
      content:
        "DESTINY TERMINAL v1.0 — Initialising soul-binding sequence...\n\n> Connection established.\n> Welcome, traveller. I am the Destiny Terminal.\n> Before your story can begin, I must know you.",
      timestamp: new Date(),
    },
    {
      id: "q1",
      role: "assistant",
      content: "First — tell me your name, and the trade by which you are known.",
      timestamp: new Date(),
    },
  ],
};

const initialState: StoryState = {
  loading: false,
  error: null,
  session: null,
  onboarding: initialOnboarding,
  currentScene: null,
  angelAdvice: null,
  devilAdvice: null,
  currentImageUrl: null,
  videoPolling: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_SESSION"; payload: GameSession }
  | { type: "ADD_TERMINAL_MESSAGE"; payload: TerminalMessage }
  | { type: "SET_HERO_PROFILE"; payload: HeroProfile }
  | { type: "SET_SCENE"; payload: { scene: string; imageUrl: string | null } }
  | { type: "SET_ANGEL_ADVICE"; payload: string }
  | { type: "SET_DEVIL_ADVICE"; payload: string }
  | { type: "ADD_ROUND"; payload: StoryRound }
  | { type: "SET_FINALE"; payload: { text: string; videoUrl?: string } }
  | { type: "SET_VIDEO_POLLING"; payload: boolean }
  | { type: "SET_VIDEO_URL"; payload: string }
  | { type: "SET_ARCHIVE_URL"; payload: string };

function reducer(state: StoryState, action: Action): StoryState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_SESSION":
      return { ...state, session: action.payload };
    case "ADD_TERMINAL_MESSAGE":
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          messages: [...state.onboarding.messages, action.payload],
        },
      };
    case "SET_HERO_PROFILE":
      return {
        ...state,
        onboarding: {
          ...state.onboarding,
          answers: action.payload,
          currentQuestion: "complete",
        },
        session: state.session
          ? { ...state.session, hero: action.payload, status: "story" as SessionStatus }
          : state.session,
      };
    case "SET_SCENE":
      return {
        ...state,
        currentScene: action.payload.scene,
        currentImageUrl: action.payload.imageUrl,
        angelAdvice: null,
        devilAdvice: null,
      };
    case "SET_ANGEL_ADVICE":
      return { ...state, angelAdvice: action.payload };
    case "SET_DEVIL_ADVICE":
      return { ...state, devilAdvice: action.payload };
    case "ADD_ROUND":
      return {
        ...state,
        session: state.session
          ? {
              ...state.session,
              rounds: [...state.session.rounds, action.payload],
              currentRound: state.session.currentRound + 1,
            }
          : state.session,
      };
    case "SET_FINALE":
      return {
        ...state,
        session: state.session
          ? {
              ...state.session,
              finaleText: action.payload.text,
              videoUrl: action.payload.videoUrl ?? null,
              status: "finale" as SessionStatus,
            }
          : state.session,
      };
    case "SET_VIDEO_POLLING":
      return { ...state, videoPolling: action.payload };
    case "SET_VIDEO_URL":
      return {
        ...state,
        videoPolling: false,
        session: state.session
          ? { ...state.session, videoUrl: action.payload }
          : state.session,
      };
    case "SET_ARCHIVE_URL":
      return {
        ...state,
        session: state.session
          ? {
              ...state.session,
              shareUrl: action.payload,
              status: "archive" as SessionStatus,
            }
          : state.session,
      };
    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStorySession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Init Session ────────────────────────────────────────────────────────────
  const initSession = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { sessionId, status } = await createSession();
      dispatch({
        type: "SET_SESSION",
        payload: {
          sessionId,
          status,
          hero: null,
          rounds: [],
          currentRound: 0,
          totalRounds: 5,
          finaleText: null,
          videoUrl: null,
          createdAt: new Date().toISOString(),
          shareUrl: null,
        },
      });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: String(err) });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, []);

  // ── Send Terminal Message (Phase 1) ─────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!state.session?.sessionId) return;

      const userMsg: TerminalMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      dispatch({ type: "ADD_TERMINAL_MESSAGE", payload: userMsg });
      dispatch({ type: "SET_LOADING", payload: true });

      try {
        const { reply, heroProfile } = await sendTerminalMessage(
          0,
          text,
          state.onboarding.answers
        );

        const replyMsg: TerminalMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: reply,
          timestamp: new Date(),
        };
        dispatch({ type: "ADD_TERMINAL_MESSAGE", payload: replyMsg });

        if (heroProfile) {
          dispatch({ type: "SET_HERO_PROFILE", payload: heroProfile });
        }
      } catch (err) {
        dispatch({ type: "SET_ERROR", payload: String(err) });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [state.session?.sessionId]
  );

  // ── Submit Choice (Phase 2) — deprecated, use story page directly ───────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const makeChoice = useCallback(async (_choice: string) => {
    // Story loop is now handled directly in app/story/[sessionId]/page.tsx
  }, []);

  // Video polling removed — video generation is handled client-side in FinalVideo.tsx

  // ── Archive Session (Phase 4) ────────────────────────────────────────────────
  const archive = useCallback(async () => {
    if (!state.session?.sessionId) return;
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const { shareUrl } = await archiveSession(state.session.sessionId);
      dispatch({ type: "SET_ARCHIVE_URL", payload: shareUrl });
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: String(err) });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.session?.sessionId]);

  return {
    ...state,
    initSession,
    sendMessage,
    makeChoice,
    archive,
  };
}
