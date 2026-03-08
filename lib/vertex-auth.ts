/**
 * lib/vertex-auth.ts — Shared Vertex AI auth + endpoint helpers
 *
 * Uses the same Firebase service account credentials already in .env.local:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * All Gemini/Veo calls now go through Vertex AI (billing-enabled) instead of
 * the free AI Studio tier — this uses your $25 Google Cloud credits.
 */

import { GoogleAuth } from "google-auth-library";

const LOCATION = "us-central1";

let _auth: GoogleAuth | null = null;

function getAuth(): GoogleAuth | null {
  if (_auth) return _auth;

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!clientEmail || !privateKey || !projectId) {
    console.warn("[vertex-auth] Service account credentials not configured — Vertex AI unavailable");
    return null;
  }

  _auth = new GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
      type: "service_account",
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  return _auth;
}

/** Returns a short-lived OAuth2 Bearer token for Vertex AI calls. */
export async function getVertexToken(): Promise<string | null> {
  const auth = getAuth();
  if (!auth) return null;
  try {
    const client = await auth.getClient();
    const tokenResp = await client.getAccessToken();
    return tokenResp.token ?? null;
  } catch (err) {
    console.error("[vertex-auth] Token fetch failed:", err);
    return null;
  }
}

/** Build the Vertex AI Gemini endpoint URL for a given model + method. */
export function vertexUrl(model: string, method = "generateContent"): string {
  const project = process.env.FIREBASE_PROJECT_ID!;
  return `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${project}/locations/${LOCATION}/publishers/google/models/${model}:${method}`;
}

/** The project ID shorthand for Veo/other Vertex operations. */
export const VERTEX_PROJECT = () => process.env.FIREBASE_PROJECT_ID ?? "";
export const VERTEX_LOCATION = LOCATION;
