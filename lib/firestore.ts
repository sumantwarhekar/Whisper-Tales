/**
 * lib/firestore.ts — Firebase Admin Firestore singleton
 *
 * Credentials are read from environment variables:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * All exported functions are no-ops (return null / void) if credentials
 * are not configured, so the app works in demo mode without a GCP project.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import type { GameSession, HeroProfile, StoryRound } from "./types";

// ── Singleton initialisation ──────────────────────────────────────────────────

let _db: Firestore | null | undefined; // undefined = not yet attempted

function getDb(): Firestore | null {
  if (_db !== undefined) return _db;

  try {
    const apps = getApps();

    if (apps.length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      // Stored in .env.local with literal \n — replace with real newlines
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) {
        // Credentials not configured — Firestore unavailable, use localStorage fallback
        _db = null;
        return null;
      }

      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
      });
    }

    _db = getFirestore();
    return _db;
  } catch (err) {
    console.warn("[firestore] Initialisation failed:", err);
    _db = null;
    return null;
  }
}

export function isFirestoreAvailable(): boolean {
  return getDb() !== null;
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

/** Create a new empty session document. */
export async function createSessionDoc(sessionId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).set({
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
  } catch (err) {
    console.error("[firestore] createSessionDoc:", err);
  }
}

/** Save the completed hero profile and advance status to 'story'. */
export async function saveHeroToFirestore(
  sessionId: string,
  hero: HeroProfile
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).update({
      hero,
      status: "story",
    });
  } catch (err) {
    console.error("[firestore] saveHeroToFirestore:", err);
  }
}

/** Append a completed story round and increment currentRound. */
export async function appendRoundToFirestore(
  sessionId: string,
  round: StoryRound
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).update({
      rounds: FieldValue.arrayUnion(round),
      currentRound: round.roundNumber,
    });
  } catch (err) {
    console.error("[firestore] appendRoundToFirestore:", err);
  }
}

/** Save the finale text and advance status to 'finale'. */
export async function saveFinaleToFirestore(
  sessionId: string,
  finaleText: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).update({
      finaleText,
      status: "finale",
    });
  } catch (err) {
    console.error("[firestore] saveFinaleToFirestore:", err);
  }
}

/**
 * Persist the full session at archive time.
 * Uses merge:true so partial updates don't wipe existing fields.
 */
export async function saveFullSessionToFirestore(
  sessionId: string,
  session: Omit<GameSession, "sessionId">
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).set(session, { merge: true });
  } catch (err) {
    console.error("[firestore] saveFullSessionToFirestore:", err);
  }
}

/** Persist the AI-generated Veo video URL on a session document. */
export async function saveVideoUrlToFirestore(
  sessionId: string,
  videoUrl: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection("sessions").doc(sessionId).update({ videoUrl });
  } catch (err) {
    console.error("[firestore] saveVideoUrlToFirestore:", err);
  }
}

/** Fetch a session document. Returns null if not found or Firestore unavailable. */
export async function getSessionFromFirestore(
  sessionId: string
): Promise<GameSession | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const snap = await db.collection("sessions").doc(sessionId).get();
    if (!snap.exists) return null;
    return { sessionId, ...snap.data() } as GameSession;
  } catch (err) {
    console.error("[firestore] getSessionFromFirestore:", err);
    return null;
  }
}
