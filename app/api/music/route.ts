import { NextRequest, NextResponse } from "next/server";
import { uploadAudioToGcs } from "@/lib/gcs";
import { getVertexToken, vertexUrl } from "@/lib/vertex-auth";

export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ audioUrl: null }, { status: 200 });
  }

  let prompt: string;
  let sessionId: string | undefined;
  let roundNumber: number | undefined;

  try {
    const body = await req.json() as { prompt: string; sessionId?: string; roundNumber?: number };
    prompt = body.prompt;
    sessionId = body.sessionId;
    roundNumber = body.roundNumber;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const url = vertexUrl("lyria-002", "predict");

    const musicRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        instances: [{ prompt: prompt.substring(0, 500) }],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!musicRes.ok) {
      const errBody = await musicRes.text();
      console.error("[Music] Lyria API error:", musicRes.status, errBody);
      return NextResponse.json({ audioUrl: null }, { status: 200 });
    }

    const musicJson = await musicRes.json() as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    };

    const prediction = musicJson.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      console.error("[Music] No audio data in response");
      return NextResponse.json({ audioUrl: null }, { status: 200 });
    }

    const audioBase64 = prediction.bytesBase64Encoded;
    const mimeType = prediction.mimeType ?? "audio/wav";

    if (sessionId && roundNumber != null) {
      const gcsUrl = await uploadAudioToGcs(sessionId, roundNumber, audioBase64, mimeType);
      if (gcsUrl) {
        return NextResponse.json({ audioUrl: gcsUrl });
      }
    }

    const dataUri = `data:${mimeType};base64,${audioBase64}`;
    return NextResponse.json({ audioUrl: dataUri });
  } catch (err) {
    console.error("[Music] Unexpected error:", err);
    return NextResponse.json({ audioUrl: null }, { status: 200 });
  }
}
