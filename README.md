# Whisper Tales

Team LMNT:
Team Members:
1. Sumant Warhekar
2. Aashutosh Kumar

> *An AI-powered interactive gothic fiction engine — where your choices, flaws, and desires shape a unique dark narrative, illustrated and scored in real time.*

---

## Overview

Whisper Tales is a full-stack generative AI storytelling app built with Next.js 16 and React 19. Players begin by answering six questions in a dramatic **Destiny Terminal** — establishing their character's name, world, desire, fatal flaw, story genre, and preferred visual art style. The app then generates a personalised five-chapter interactive story where every scene, illustration, and musical score is created on-demand by large AI models hosted on Google Vertex AI.

Each chapter presents a moral dilemma guided by an **Angel** and a **Devil** — two opposing AI advisors. The story adapts to every choice made, culminating in a **Grand Finale** with a bespoke epilogue narrated aloud via text-to-speech. The full session can be archived and shared via a permanent link.

---

## Features

### Onboarding — The Destiny Terminal
- Gothic-styled conversational terminal powered by Gemini (`gemini-2.0-flash-lite`)
- Six sequentially asked questions:
  1. **Name & Trade** — who you are
  2. **World & Era** — where you exist
  3. **Desire** — what drives you
  4. **Fatal Flaw** — your greatest weakness
  5. **Story Genre** — gothic fantasy, dark sci-fi, cosmic horror, Victorian mystery, apocalyptic western, etc.
  6. **Art Style** — woodcut engravings, watercolour, noir photography, anime brushwork, etc.
- Dramatic AI-generated responses after each answer
- Progress sidebar with completion checklist
- Graceful fallback replies when Vertex AI is unavailable

### Story Loop — Five Chapters
- **AI scene generation** per chapter: vivid atmospheric prose tailored to your hero, genre, and previous choices (`gemini-2.0-flash`)
- **Angel & Devil advisors**: two competing AI characters offering morally opposed choices
- **Scene illustration**: AI-generated image matching the scene and the user's chosen art style (`gemini-2.0-flash-preview-image-generation`)
- **Background music**: genre-aware ambient score generated per chapter (`lyria-002`)
  - Auto-plays on page load
  - Mute/unmute button overlaid on scene image
- Choice cards — click either advisor's card to commit your decision
- Escalating stakes: each chapter references prior choices and raises the tension

### Grand Finale
- **Epilogue narrative** tying together all five chapters, morally consistent with choices made
- **Image slideshow** of all five chapter scenes with auto-advance, prev/next arrows, and dot navigation
- **Choices Made** summary — every chapter's opening line and the user's quoted decision
- **TTS narration**: the finale text is read aloud via Gemini TTS (`gemini-2.5-flash-preview-tts`)
  - Auto-plays when ready
  - Mute/unmute speaker button beside the "Grand Finale" heading
- **Archive & Share**: session saved to Firestore and a permanent share link generated

### Archive
- Shareable read-only page at `/archive/[sessionId]`
- Displays full hero profile, all five scenes with images, choices, and finale text

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16 (App Router) | Full-stack React framework |
| React | 19 | UI rendering |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 4 | Utility-first styling |
| Framer Motion | latest | Animations & transitions |
| Lucide React | latest | Icon library |

### Backend — API Routes (Next.js)

| Route | Model / Service | Purpose |
|---|---|---|
| `POST /api/gemini/terminal` | `gemini-2.0-flash-lite` | Destiny Terminal conversation |
| `POST /api/gemini/story` | `gemini-2.0-flash` | Scene + finale generation |
| `POST /api/gemini/image` | `gemini-2.0-flash-preview-image-generation` | Per-chapter scene illustration |
| `POST /api/tts` | `gemini-2.5-flash-preview-tts` via Vertex AI | Finale TTS narration (WAV) |
| `POST /api/music` | `lyria-002` via Vertex AI | Per-chapter background music |
| `POST /api/sessions` | Firestore | Create session |
| `PATCH /api/sessions/[id]` | Firestore | Save rounds & finale |
| `POST /api/sessions/[id]` | Firestore | Archive full session |

### Google Cloud Services

| Service | Usage |
|---|---|
| **Vertex AI** | All Gemini & Lyria model inference (billing-enabled, replaces AI Studio) |
| **Google Cloud Storage (GCS)** | Stores generated images, audio (WAV), and narration files permanently |
| **Firestore** | Persists hero profiles, story rounds, finale text, and share links |
| **Google Auth Library** | Service-account OAuth2 token generation for all Vertex AI calls |

### Authentication
All Vertex AI calls are authenticated with a **Google Cloud service account** via JWT-signed OAuth2 Bearer tokens (`google-auth-library`). Credentials are stored in environment variables — no API key files on disk.

---

## Architecture

```
Browser (Next.js 16 App Router)
│
├── /                          → Home page (start session)
├── /terminal/[sessionId]      → Destiny Terminal onboarding (6 questions)
├── /story/[sessionId]         → 5-chapter interactive story loop
└── /archive/[sessionId]       → Read-only shareable session view
         │
         ▼
Next.js API Routes (server-side, Node.js)
│
├── /api/gemini/terminal  ──► Vertex AI  gemini-2.0-flash-lite
├── /api/gemini/story     ──► Vertex AI  gemini-2.0-flash
├── /api/gemini/image     ──► Vertex AI  gemini-2.0-flash-preview-image-generation
│                                             └─► GCS  (permanent image URL)
├── /api/tts              ──► Vertex AI  gemini-2.5-flash-preview-tts
│                                             └─► GCS  (permanent WAV URL)
├── /api/music            ──► Vertex AI  lyria-002
│                                             └─► GCS  (permanent audio URL)
└── /api/sessions/*       ──► Firestore  (CRUD for sessions & rounds)
```

### Data Flow per Chapter
1. User submits a choice → `POST /api/gemini/story` → scene + imagePrompt + advisors JSON
2. Scene renders immediately (no blocking)
3. In parallel (fire-and-forget):
   - `generateSceneImage(imagePrompt, artStyle)` → GCS URL → image fades in
   - `generateMusic(genre + imagePrompt)` → GCS URL → audio auto-plays
4. On final chapter → `generateFinale()` → epilogue text → `generateNarration(finaleText)` → TTS WAV auto-plays

---

## Getting Started

### Prerequisites
- Node.js 20+
- A Google Cloud project with billing enabled
- The following APIs enabled on your GCP project:
  - Vertex AI API
  - Cloud Firestore API
  - Cloud Storage API

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Google Cloud / Firebase
FIREBASE_PROJECT_ID=your-gcp-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Google Cloud Storage
GCS_BUCKET_NAME=your-gcs-bucket-name
```

> The service account needs the following IAM roles:
> - `roles/aiplatform.user` (Vertex AI User)
> - `roles/datastore.user` (Firestore User)
> - `roles/storage.objectAdmin` (GCS Object Admin)

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Initialise Firestore Collections

```bash
node scripts/init-firestore.mjs
```

---

## Project Structure

```
whisper_tales/
├── app/
│   ├── page.tsx                        # Home / landing page
│   ├── layout.tsx
│   ├── globals.css
│   ├── api/
│   │   ├── gemini/
│   │   │   ├── terminal/route.ts       # Onboarding conversation
│   │   │   ├── story/route.ts          # Scene & finale generation
│   │   │   └── image/route.ts          # Scene illustration
│   │   ├── tts/route.ts                # Text-to-speech (WAV)
│   │   ├── music/route.ts              # Background music (Lyria)
│   │   └── sessions/
│   │       ├── route.ts                # Create session
│   │       └── [sessionId]/route.ts    # Update / archive
│   ├── terminal/[sessionId]/page.tsx   # Destiny Terminal UI
│   ├── story/[sessionId]/page.tsx      # Story loop UI
│   └── archive/[sessionId]/page.tsx    # Shareable archive view
├── components/
│   ├── TerminalChat.tsx                # Terminal message feed + input
│   ├── StoryScene.tsx                  # Chapter display + music player
│   ├── AgentAdvice.tsx                 # Angel / Devil choice cards
│   ├── UserInput.tsx                   # Free-text choice input
│   ├── FinalVideo.tsx                  # Finale: slideshow + TTS + choices
│   └── StoryArchive.tsx                # Archive page layout
├── lib/
│   ├── types.ts                        # Shared TypeScript interfaces
│   ├── api.ts                          # Client-side API helper functions
│   ├── vertex-auth.ts                  # Vertex AI auth & endpoint helpers
│   ├── gcs.ts                          # GCS upload utilities
│   └── firestore.ts                    # Firestore read/write helpers
├── hooks/
│   ├── useStorySession.ts
│   └── useWebSocket.ts
├── scripts/
│   └── init-firestore.mjs              # One-time Firestore seed script
├── firestore.rules
├── firestore.indexes.json
└── next.config.ts
```

---

## Key Design Decisions

- **Vertex AI over AI Studio** — all inference goes through the billing-enabled Vertex AI endpoint, avoiding free-tier quota limits and enabling production-grade reliability.
- **Fire-and-forget for media** — image and music generation run in parallel after the scene text renders, so the user never waits for media before reading the story.
- **`role: "user"` in all Gemini requests** — Vertex AI silently rejects `contents` arrays without an explicit role; all API routes include this.
- **PCM → WAV conversion** — Gemini TTS returns raw PCM audio; the TTS route constructs a valid 44-byte WAV header before uploading to GCS.
- **Optional `genre` / `artStyle`** — backward-compatible optional fields on `HeroProfile` so existing sessions in localStorage continue to work without a migration.
- **Graceful degradation** — every AI call has a local fallback (hardcoded scene/reply text) so the story remains playable even when Vertex AI is unavailable.

---

## License

MIT

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
