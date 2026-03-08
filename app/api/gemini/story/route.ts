import { NextRequest, NextResponse } from "next/server";
import { getVertexToken, vertexUrl } from "@/lib/vertex-auth";

interface HeroProfile {
  name: string;
  world: string;
  desire: string;
  flaw: string;
  genre?: string;
  artStyle?: string;
}

interface PreviousRound {
  roundNumber: number;
  scene: string;
  userChoice: string;
}

interface StoryRequestBody {
  hero: HeroProfile;
  previousRounds: PreviousRound[];
  roundNumber: number;
  totalRounds: number;
  isFinale?: boolean;
}

export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ error: "Vertex AI credentials not configured" }, { status: 500 });
  }

  try {
    const body: StoryRequestBody = await req.json();
    const { hero, previousRounds, roundNumber, totalRounds, isFinale } = body;

    const heroContext = `Hero: ${hero.name}
World: ${hero.world}
Desires: ${hero.desire}
Greatest flaw: ${hero.flaw}
Story genre: ${hero.genre ?? "gothic dark fantasy"}
Visual art style: ${hero.artStyle ?? "stark black and white woodcut engraving"}`;

    const historyContext =
      previousRounds.length > 0
        ? `\nPrevious chapters:\n${previousRounds
            .map(
              (r) =>
                `Chapter ${r.roundNumber}: ${r.scene.substring(0, 120)}...\n  → Chose: ${r.userChoice}`
            )
            .join("\n")}`
        : "";

    if (isFinale) {
      const finalePrompt = `You are the narrator of a dark moral tale in the ${hero.genre ?? "gothic dark fantasy"} genre.

${heroContext}${historyContext}

Write the GRAND FINALE of this ${totalRounds}-chapter story.

Craft a compelling concluding narrative (3-4 sentences) that:
- Ties together the moral weight of ALL their choices
- Reveals the ultimate consequence that befits their character arc
- Is poetic, literary, and stylistically consistent with the ${hero.genre ?? "gothic dark fantasy"} genre
- References their greatest flaw (${hero.flaw}) and desire (${hero.desire}) 
- Ends with a haunting philosophical sentence about fate and identity

Write in second person ("you"). Output only the finale text — no JSON, no headings.`;

      const finaleRes = await fetch(vertexUrl("gemini-2.0-flash"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: finalePrompt }] }] }),
      });
      if (!finaleRes.ok) throw new Error(`Vertex AI ${finaleRes.status}`);
      const finaleData = await finaleRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const finaleText = (finaleData.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
      return NextResponse.json({ finaleText });
    }

    const storyPrompt = `You are the narrator of a dark interactive ${hero.genre ?? "gothic fantasy"} tale.

${heroContext}${historyContext}

Generate Chapter ${roundNumber} of ${totalRounds}.

Rules:
- Create a scene with a clear moral dilemma that directly relates to the hero's desire (${hero.desire}) and exploits their flaw (${hero.flaw})
- The scene must feel authentic to the ${hero.genre ?? "gothic fantasy"} genre — use its tropes, atmosphere, and vocabulary
- The scene must be unique — different from any previous chapters
- If this is a later chapter, the stakes should feel higher and build on prior choices
- Keep angel/devil advice as completely opposite perspectives

Respond ONLY with raw valid JSON (no markdown, no code fences, no extra text):
{
  "scene": "2-3 sentences of vivid, atmospheric scene description with a clear dilemma. Second person (you). Cinematic, genre-authentic.",
  "angelAdvice": "1 sentence of wise, noble, moral counsel from the Guardian. Thoughtful and earnest.",
  "devilAdvice": "1 sentence of cunning, tempting, witty counsel from the Chaos Demon. Amusing and morally questionable.",
  "imagePrompt": "Under 25 words — a visual scene description for a ${hero.artStyle ?? "stark black and white"} illustration matching this scene. Focus on mood and key visual elements only. No text."
}`;

    const storyRes = await fetch(vertexUrl("gemini-2.0-flash"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: storyPrompt }] }] }),
    });
    if (!storyRes.ok) {
      const errText = await storyRes.text();
      const is429 = storyRes.status === 429 || errText.includes("RESOURCE_EXHAUSTED");
      throw new Error(is429 ? "QUOTA_EXCEEDED" : `Vertex AI ${storyRes.status}`);
    }
    const storyData = await storyRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    let text = (storyData.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    // Strip markdown code fences if the model wraps it anyway
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    const data = JSON.parse(text);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const is429 = msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED");
    console.error("[/api/gemini/story] Error:", err);
    return NextResponse.json(
      { error: is429 ? "QUOTA_EXCEEDED" : "Gemini request failed" },
      { status: is429 ? 429 : 500 }
    );
  }
}
