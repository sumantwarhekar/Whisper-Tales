/**
 * lib/gcs.ts — Firebase Storage (GCS) upload helpers
 *
 * Uses firebase-admin/storage, backed by the same credentials as lib/firestore.ts.
 * Requires GCS_BUCKET_NAME env var (e.g. whisper-tales-3556b.appspot.com).
 *
 * All functions return null (never throw) if Storage is not configured.
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

// ── Bucket accessor ───────────────────────────────────────────────────────────

function getBucket(): Bucket | null {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) return null;

  try {
    // Ensure Firebase Admin app is initialised (may already be done by firestore.ts)
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

      if (!projectId || !clientEmail || !privateKey) return null;

      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
        projectId,
        storageBucket: bucketName,
      });
    }

    return getStorage().bucket(bucketName);
  } catch (err) {
    console.warn("[gcs] getBucket failed:", err);
    return null;
  }
}

export function isGcsAvailable(): boolean {
  return getBucket() !== null;
}

/**
 * Upload a base64-encoded image to GCS at sessions/{sessionId}/round-{n}.{ext}.
 * Makes the object publicly readable and returns its permanent HTTPS URL.
 * Returns null if GCS is not configured or the upload fails.
 */
export async function uploadImageToGcs(
  sessionId: string,
  roundNumber: number,
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  const bucket = getBucket();
  if (!bucket) return null;

  try {
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const filePath = `sessions/${sessionId}/round-${roundNumber}.${ext}`;
    const file = bucket.file(filePath);
    const buffer = Buffer.from(base64Data, "base64");

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    // Make the uploaded object publicly readable
    await file.makePublic();

    const bucketName = process.env.GCS_BUCKET_NAME!;
    return `https://storage.googleapis.com/${bucketName}/${filePath}`;
  } catch (err) {
    console.error("[gcs] uploadImageToGcs:", err);
    return null;
  }
}

/**
 * Upload a base64-encoded audio file to GCS at sessions/{sessionId}/round-{n}-narration.{ext}.
 * Makes the object publicly readable and returns its permanent HTTPS URL.
 * Returns null if GCS is not configured or the upload fails.
 */
export async function uploadAudioToGcs(
  sessionId: string,
  roundNumber: number,
  base64Data: string,
  mimeType: string
): Promise<string | null> {
  const bucket = getBucket();
  if (!bucket) return null;

  try {
    const ext = mimeType.includes("wav") ? "wav" : mimeType.includes("mp3") ? "mp3" : "audio";
    const filePath = `sessions/${sessionId}/round-${roundNumber}-narration.${ext}`;
    const file = bucket.file(filePath);
    const buffer = Buffer.from(base64Data, "base64");

    await file.save(buffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    await file.makePublic();

    const bucketName = process.env.GCS_BUCKET_NAME!;
    return `https://storage.googleapis.com/${bucketName}/${filePath}`;
  } catch (err) {
    console.error("[gcs] uploadAudioToGcs:", err);
    return null;
  }
}

/**
 * Upload a video Buffer to GCS at sessions/{sessionId}/finale.{ext}.
 * Makes the object publicly readable and returns its permanent HTTPS URL.
 * Returns null if GCS is not configured or the upload fails.
 */
export async function uploadVideoToGcs(
  sessionId: string,
  videoBuffer: Buffer,
  mimeType: string
): Promise<string | null> {
  const bucket = getBucket();
  if (!bucket) return null;

  try {
    const ext = mimeType.includes("mp4") ? "mp4" : "webm";
    const filePath = `sessions/${sessionId}/finale.${ext}`;
    const file = bucket.file(filePath);

    await file.save(videoBuffer, {
      metadata: {
        contentType: mimeType,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });

    await file.makePublic();

    const bucketName = process.env.GCS_BUCKET_NAME!;
    return `https://storage.googleapis.com/${bucketName}/${filePath}`;
  } catch (err) {
    console.error("[gcs] uploadVideoToGcs:", err);
    return null;
  }
}
