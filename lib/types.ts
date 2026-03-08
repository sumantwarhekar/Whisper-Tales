// ─── Hero Profile ────────────────────────────────────────────────────────────
export interface HeroProfile {
  name: string;
  world: string;
  desire: string;
  flaw: string;
  genre?: string;
  artStyle?: string;
}

// ─── Story Round ─────────────────────────────────────────────────────────────
export interface StoryRound {
  roundNumber: number;
  scene: string;
  imageUrl: string | null;
  audioUrl?: string | null;
  imagePrompt: string;
  angelAdvice: string;
  devilAdvice: string;
  userChoice: string;
  outcome: string;
}

// ─── Session Status ───────────────────────────────────────────────────────────
export type SessionStatus =
  | "onboarding"   // Phase 1 – Destiny Terminal
  | "story"        // Phase 2 – Core Loop
  | "finale"       // Phase 3 – Grand Finale + Veo video
  | "archive";     // Phase 4 – Saved & Shareable

// ─── Game Session ─────────────────────────────────────────────────────────────
export interface GameSession {
  sessionId: string;
  status: SessionStatus;
  hero: HeroProfile | null;
  rounds: StoryRound[];
  currentRound: number;
  totalRounds: number;
  finaleText: string | null;
  videoUrl: string | null;
  createdAt: string;
  shareUrl: string | null;
}

// ─── Terminal Message ────────────────────────────────────────────────────────
export type MessageRole = "system" | "user" | "assistant";

export interface TerminalMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}

// ─── Agent Advice ─────────────────────────────────────────────────────────────
export interface AgentAdvice {
  angel: string;
  devil: string;
}

// ─── WebSocket Events ────────────────────────────────────────────────────────
export type WSEventType =
  | "session_start"
  | "terminal_message"
  | "hero_profile_complete"
  | "scene_generated"
  | "image_generated"
  | "angel_advice"
  | "devil_advice"
  | "choice_submitted"
  | "round_complete"
  | "finale_start"
  | "video_generating"
  | "video_ready"
  | "session_archived"
  | "error";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
}

// ─── API Responses ────────────────────────────────────────────────────────────
export interface CreateSessionResponse {
  sessionId: string;
  status: SessionStatus;
}

export interface SubmitChoiceResponse {
  round: StoryRound;
  nextScene: string | null;
  isFinale: boolean;
}

export interface ArchiveResponse {
  sessionId: string;
  shareUrl: string;
}

// ─── Q&A Phase State ─────────────────────────────────────────────────────────
export type OnboardingQuestion =
  | "name"
  | "world"
  | "desire"
  | "flaw"
  | "genre"
  | "artStyle"
  | "complete";

export interface OnboardingState {
  currentQuestion: OnboardingQuestion;
  answers: Partial<HeroProfile>;
  messages: TerminalMessage[];
}
