import { NextRequest, NextResponse } from "next/server";
import { uploadAudioToGcs } from "@/lib/gcs";
import { getVertexToken, vertexUrl } from "@/lib/vertex-auth";

// Convert raw PCM (s16le, mono) to a valid WAV buffer the browser can decode.
function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitDepth = 16;
  const byteRate = sampleRate * numChannels * (bitDepth / 8);
  const blockAlign = numChannels * (bitDepth / 8);
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);   // ChunkSize
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);               // Subchunk1Size (PCM)
  header.writeUInt16LE(1, 20);                // AudioFormat: PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ audioUrl: null }, { status: 200 });
  }

  let text: string;
  let sessionId: string | undefined;
  let roundNumber: number | undefined;

  try {
    const body = await req.json() as { text: string; sessionId?: string; roundNumber?: number };
    text = body.text;
    sessionId = body.sessionId;
    roundNumber = body.roundNumber;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const url = vertexUrl("gemini-2.5-flash-preview-tts");

    const ttsRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: text.substring(0, 1500) }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: "Charon" },
            },
          },
        },
      }),
    });

    if (!ttsRes.ok) {
      const errBody = await ttsRes.text();
      console.error("[TTS] Gemini API error:", ttsRes.status, errBody);
      return NextResponse.json({ audioUrl: null }, { status: 200 });
    }

    const ttsJson = await ttsRes.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      }>;
    };

    const inlineData = ttsJson.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) {
      console.error("[TTS] No audio data in response");
      return NextResponse.json({ audioUrl: null }, { status: 200 });
    }

    const pcm = Buffer.from(inlineData.data, "base64");
    const wav = pcmToWav(pcm);
    const wavBase64 = wav.toString("base64");

    // Try GCS upload if session context provided; otherwise return data URI
    if (sessionId && roundNumber != null) {
      const gcsUrl = await uploadAudioToGcs(sessionId, roundNumber, wavBase64, "audio/wav");
      if (gcsUrl) {
        return NextResponse.json({ audioUrl: gcsUrl });
      }
    }

    // Fallback: inline data URI
    const dataUri = `data:audio/wav;base64,${wavBase64}`;
    return NextResponse.json({ audioUrl: dataUri });
  } catch (err) {
    console.error("[TTS] Unexpected error:", err);
    return NextResponse.json({ audioUrl: null }, { status: 200 });
  }
}
