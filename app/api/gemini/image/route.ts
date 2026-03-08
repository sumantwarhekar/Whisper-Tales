import { NextRequest, NextResponse } from "next/server";
import { uploadImageToGcs } from "@/lib/gcs";
import { getVertexToken, vertexUrl } from "@/lib/vertex-auth";

// Uses Vertex AI REST API for image generation (billing-enabled, no quota limits).
export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ imageUrl: null });
  }

  try {
    const { prompt, sessionId, roundNumber, artStyle } = (await req.json()) as {
      prompt: string;
      sessionId?: string;
      roundNumber?: number;
      artStyle?: string;
    };

    const styleDesc = artStyle ? artStyle : "dramatic black and white gothic fantasy illustration";
    const endpoint = vertexUrl("gemini-2.0-flash-preview-image-generation");

    const body = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a ${styleDesc}: ${prompt}. No text or words anywhere in the image.`,
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[/api/gemini/image] API error:", res.status, errText);
      return NextResponse.json({ imageUrl: null });
    }

    const data = await res.json();
    const parts: Array<{ inlineData?: { mimeType: string; data: string } }> =
      data?.candidates?.[0]?.content?.parts ?? [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith("image/")) {
        const { mimeType, data } = part.inlineData;

        // Prefer GCS URL — fall back to base64 data URL if GCS not configured
        let imageUrl: string | null = null;
        if (sessionId && roundNumber !== undefined) {
          imageUrl = await uploadImageToGcs(sessionId, roundNumber, data, mimeType);
        }
        if (!imageUrl) {
          imageUrl = `data:${mimeType};base64,${data}`;
        }

        return NextResponse.json({ imageUrl });
      }
    }

    return NextResponse.json({ imageUrl: null });
  } catch (err) {
    console.error("[/api/gemini/image] Error:", err);
    return NextResponse.json({ imageUrl: null });
  }
}
