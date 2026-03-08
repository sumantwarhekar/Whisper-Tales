/**
 * scripts/init-firestore.mjs
 *
 * Bootstraps the Firestore database for Whisper Tales:
 *   1. Validates credentials and connection
 *   2. Creates _meta/schema — living documentation of the data model
 *   3. Creates _meta/indexes — documents all query patterns
 *   4. Writes + immediately deletes a canary session to confirm write access
 *
 * Run with:
 *   node scripts/init-firestore.mjs
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// ── Load .env.local ───────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");

function loadEnvLocal(filePath) {
  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`\n❌  Could not read ${filePath}`);
    console.error("    Make sure you are running this from the project root.\n");
    process.exit(1);
  }

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    // Strip surrounding double-quotes if present (handles multi-line private keys)
    const val = line.slice(eqIdx + 1).trim().replace(/^"([\s\S]*)"$/, "$1");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal(envPath);

const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env;

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  console.error("\n❌  Missing Firebase credentials in .env.local");
  console.error("    Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY\n");
  process.exit(1);
}

// ── Init Firebase Admin ───────────────────────────────────────────────────────

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    projectId: FIREBASE_PROJECT_ID,
  });
}

const db = getFirestore();

// ── Schema definition ─────────────────────────────────────────────────────────

/**
 * sessions/{sessionId}
 *
 *  sessionId   — random UUID generated server-side on session creation
 *  status      — lifecycle stage of the game
 *  hero        — the 4-field character the user defined in the terminal
 *  rounds      — array of completed story chapters (max 5)
 *  currentRound — how many rounds have been completed (0-based)
 *  totalRounds — always 5
 *  finaleText  — AI-written epilogue, set after round 5
 *  videoUrl    — GCS URL of the Veo 2 generated video, if complete
 *  createdAt   — ISO 8601 timestamp
 *  shareUrl    — public URL for sharing, set on archive
 */
const SESSION_SCHEMA = {
  _description: "One document per game session. Document ID = UUID (sessionId).",
  _collection: "sessions",
  fields: {
    status: {
      type: "string",
      enum: ["onboarding", "story", "finale", "archive"],
      description: "Lifecycle stage. Set to 'onboarding' on creation, advanced by API routes.",
    },
    hero: {
      type: "object | null",
      nullable: true,
      description: "Null until the user completes the terminal onboarding.",
      shape: {
        name: "string — hero name and trade (e.g. 'Aldric the Chronicler')",
        world: "string — the setting / era (e.g. 'A gothic empire at twilight')",
        desire: "string — what the hero wants above all else",
        flaw: "string — the hero's greatest weakness",
      },
    },
    rounds: {
      type: "array",
      description: "Ordered list of completed story rounds. Grows from 0 to 5.",
      itemShape: {
        roundNumber: "number — 1-indexed (1 through 5)",
        scene: "string — AI-generated scene narrative (2-3 sentences)",
        angelAdvice: "string — Guardian / moral counsel for this round",
        devilAdvice: "string — Chaos Demon / temptation counsel for this round",
        userChoice: "string — The user's typed decision, recorded after the scene",
        imageUrl: "string | null — GCS URL or base64 data URI of the scene illustration",
        audioUrl: "string | null — GCS URL or base64 WAV URI of the TTS narration",
      },
    },
    currentRound: {
      type: "number",
      description: "Number of rounds completed. Increments atomically on each round save.",
    },
    totalRounds: {
      type: "number",
      description: "Always 5. Stored so queries can compute progress without knowing constants.",
    },
    finaleText: {
      type: "string | null",
      description: "Grand finale epilogue written by Gemini after all 5 rounds complete.",
    },
    videoUrl: {
      type: "string | null",
      description: "GCS public URL of the Veo 2 generated short film. Null until video completes.",
    },
    createdAt: {
      type: "string",
      description: "ISO 8601 creation timestamp (e.g. '2026-03-08T12:00:00.000Z').",
    },
    shareUrl: {
      type: "string | null",
      description: "Full public URL for sharing the story. Set when status advances to 'archive'.",
    },
  },
  exampleDocument: {
    status: "story",
    hero: {
      name: "Aldric the Chronicler",
      world: "A crumbling gothic empire at the edge of a forgotten age",
      desire: "To find the lost library of the forgotten gods",
      flaw: "An obsessive need to record everything, even when action is required",
    },
    rounds: [
      {
        roundNumber: 1,
        scene:
          "Aldric stands at the iron threshold of the Vault of Whispers, where dust motes drift like the souls of archivists long dead. The desire to catalogue what lies beyond burns in his chest. A lock seals the gate — its mechanism unlike any he has studied.",
        angelAdvice:
          "Knowledge earned through patience endures. The lock has a solution — seek it before forcing your way through.",
        devilAdvice:
          "Every library that mattered was broken into first and admired second. Break it open.",
        userChoice: "I study the lock's mechanism methodically, recording each detail.",
        imageUrl: null,
        audioUrl: null,
      },
    ],
    currentRound: 1,
    totalRounds: 5,
    finaleText: null,
    videoUrl: null,
    createdAt: new Date().toISOString(),
    shareUrl: null,
  },
};

const INDEX_DOCS = {
  _description: "Query patterns used by the application. All current queries are single-doc lookups by sessionId — no composite indexes required today.",
  queries: {
    "Get session by ID": "db.collection('sessions').doc(sessionId) — O(1), no index needed",
    "List sessions by status (future admin use)": "db.collection('sessions').where('status', '==', 'archive').orderBy('createdAt', 'desc') — requires composite index if added",
  },
  firestoreIndexesFile: "firestore.indexes.json (see project root — currently empty, add indexes there if you add list-by-status queries)",
};

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔥 Whisper Tales — Firestore Initialisation`);
  console.log(`   Project: ${FIREBASE_PROJECT_ID}\n`);

  // 1. Write schema documentation
  await db.collection("_meta").doc("schema").set(SESSION_SCHEMA);
  console.log("✓  _meta/schema written");

  // 2. Write index documentation
  await db.collection("_meta").doc("indexes").set(INDEX_DOCS);
  console.log("✓  _meta/indexes written");

  // 3. Canary session — write then delete to confirm full read/write access
  const canaryId = `_canary_${Date.now()}`;
  const canaryRef = db.collection("sessions").doc(canaryId);

  await canaryRef.set({
    status: "onboarding",
    hero: null,
    rounds: [],
    currentRound: 0,
    totalRounds: 5,
    finaleText: null,
    videoUrl: null,
    createdAt: new Date().toISOString(),
    shareUrl: null,
  });
  console.log(`✓  Canary session written  (sessions/${canaryId})`);

  // Verify we can read it back
  const snap = await canaryRef.get();
  if (!snap.exists) throw new Error("Canary read-back failed — document not found");
  console.log("✓  Canary session read back successfully");

  // Delete it
  await canaryRef.delete();
  console.log("✓  Canary session deleted\n");

  console.log("✅  Firestore is ready. Collections initialised:");
  console.log("     sessions/   — game sessions (empty, populated at runtime)");
  console.log("     _meta/      — schema + index documentation\n");
  console.log("   Next steps:");
  console.log("   1. Enable Vertex AI API at console.cloud.google.com/apis/library");
  console.log("   2. Run: npm run dev");
  console.log("   3. Open http://localhost:3000\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌  Init failed:", err.message ?? err);
  if (err.code === 5) {
    console.error("    → Firestore database does not exist yet.");
    console.error("      Go to: https://console.firebase.google.com/project/" + FIREBASE_PROJECT_ID + "/firestore");
    console.error("      Click 'Create database', choose 'Native mode', region 'us-central1'\n");
  } else if (err.code === 7 || (err.message ?? "").includes("PERMISSION_DENIED")) {
    console.error("    → Service account lacks Firestore write permission.");
    console.error("      Go to: https://console.cloud.google.com/iam-admin/iam?project=" + FIREBASE_PROJECT_ID);
    console.error("      Grant role 'Cloud Datastore User' to: " + (FIREBASE_CLIENT_EMAIL ?? "your service account") + "\n");
  }
  process.exit(1);
});
