import { NextRequest, NextResponse } from "next/server";
import { uploadVideoToGcs } from "@/lib/gcs";
import { saveVideoUrlToFirestore } from "@/lib/firestore";
import { getVertexToken, VERTEX_PROJECT, VERTEX_LOCATION } from "@/lib/vertex-auth";

// Allow up to 5 minutes — Veo 2 generation typically takes 1–3 min
export const maxDuration = 300;

const VEO_MODEL = "veo-2.0-generate-001";
const POLL_INTERVAL_MS = 8_000;
const MAX_POLLS = 35; // ~4.7 minutes total

function veoBaseUrl() {
  return `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT()}/locations/${VERTEX_LOCATION}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Veo response types ────────────────────────────────────────────────────────

interface VeoVideoSample {
  video?: { uri?: string; encoding?: string };
}

interface VeoOperationResult {
  done?: boolean;
  name?: string;
  error?: { message?: string; code?: number };
  response?: {
    generateVideoResponse?: { generatedSamples?: VeoVideoSample[] };
    // Some API versions return generatedSamples at the top level of response
    generatedSamples?: VeoVideoSample[];
  };
}

function extractVideoUri(op: VeoOperationResult): string | null {
  const samples =
    op.response?.generateVideoResponse?.generatedSamples ??
    op.response?.generatedSamples;
  const uri = samples?.[0]?.video?.uri;
  if (!uri) return null;

  // Convert gs:// → public https:// storage URL
  if (uri.startsWith("gs://")) {
    const rest = uri.slice(5);
    const slash = rest.indexOf("/");
    if (slash === -1) return null;
    const bucket = rest.slice(0, slash);
    const path = rest.slice(slash + 1);
    return `https://storage.googleapis.com/${bucket}/${path}`;
  }
  return uri;
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ videoUrl: null });
  }

  let prompt: string;
  let sessionId: string | undefined;

  try {
    const body = (await req.json()) as { prompt?: string; sessionId?: string };
    prompt = (body.prompt ?? "").trim();
    sessionId = body.sessionId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ videoUrl: null });
  }

  // ── Start Veo 2 generation (long-running operation) ────────────────────────
  let startRes: Response;
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  try {
    startRes = await fetch(
      `${veoBaseUrl()}/publishers/google/models/${VEO_MODEL}:predictLongRunning`,
      {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          instances: [{ prompt: prompt.substring(0, 1000) }],
          parameters: {
            aspectRatio: "16:9",
            sampleCount: 1,
            durationSeconds: 8,
            personGeneration: "dont_allow",
          },
        }),
      }
    );
  } catch (err) {
    console.error("[veo] Network error starting job:", err);
    return NextResponse.json({ videoUrl: null });
  }

  if (!startRes.ok) {
    const errText = await startRes.text();
    console.error("[veo] Start failed:", startRes.status, errText.substring(0, 200));
    return NextResponse.json({ videoUrl: null });
  }

  const startOp = (await startRes.json()) as VeoOperationResult;
  if (!startOp.name) {
    console.error("[veo] No operation name in start response");
    return NextResponse.json({ videoUrl: null });
  }

  // ── Poll until operation completes ────────────────────────────────────────
  let finalOp: VeoOperationResult = startOp;

  if (!startOp.done) {
    // Vertex AI operations endpoint — note different base URL
    const pollBase = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1`;
    const pollUrl = `${pollBase}/${startOp.name}`;

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      try {
        const pollRes = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (!pollRes.ok) continue;

        const pollOp = (await pollRes.json()) as VeoOperationResult;

        if (pollOp.error) {
          console.error("[veo] Operation error:", pollOp.error.message);
          return NextResponse.json({ videoUrl: null });
        }

        if (pollOp.done) {
          finalOp = pollOp;
          break;
        }
      } catch (pollErr) {
        console.error("[veo] Poll attempt", i + 1, "failed:", pollErr);
      }
    }
  }

  if (!finalOp.done) {
    console.error("[veo] Generation timed out after", MAX_POLLS * POLL_INTERVAL_MS / 1000, "seconds");
    return NextResponse.json({ videoUrl: null });
  }

  // ── Extract video URI ──────────────────────────────────────────────────────
  const videoUri = extractVideoUri(finalOp);
  if (!videoUri) {
    console.error("[veo] No video URI in completed operation:", JSON.stringify(finalOp).substring(0, 300));
    return NextResponse.json({ videoUrl: null });
  }

  // ── Download video and re-upload to our GCS bucket ────────────────────────
  if (sessionId) {
    try {
      // Veo stores the generated video in Google's private GCS bucket — auth required
      const videoRes = await fetch(videoUri, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (videoRes.ok) {
        const buffer = Buffer.from(await videoRes.arrayBuffer());
        const mimeType = videoRes.headers.get("content-type") ?? "video/mp4";
        const gcsUrl = await uploadVideoToGcs(sessionId, buffer, mimeType);
        if (gcsUrl) {
          await saveVideoUrlToFirestore(sessionId, gcsUrl).catch(() => {});
          return NextResponse.json({ videoUrl: gcsUrl });
        }
      }
    } catch (err) {
      console.error("[veo] GCS upload failed:", err);
    }

    // GCS upload failed — persist the temporary URI as fallback
    await saveVideoUrlToFirestore(sessionId, videoUri).catch(() => {});
  }

  return NextResponse.json({ videoUrl: videoUri });
}
