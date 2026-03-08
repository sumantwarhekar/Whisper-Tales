import { NextRequest, NextResponse } from "next/server";
import { getVertexToken, vertexUrl } from "@/lib/vertex-auth";
import { saveHeroToFirestore } from "@/lib/firestore";

const QUESTIONS = [
  "What is your name, and the trade by which you are known in this world?",
  "Describe the world you inhabit — the era, the realm, the very air you breathe.",
  "What is the one thing you desire above all else — what drives your every waking hour?",
  "Confess to me your greatest flaw — the crack in your armour, the shadow in your soul.",
  "What genre shall your tale inhabit — gothic fantasy, dark sci-fi, cosmic horror, Victorian mystery, apocalyptic western, or something of your own devising?",
  "How shall your world be rendered — as stark woodcut engravings, dark watercolour washes, gritty noir photography, vivid anime brushwork, or a vision entirely your own?",
];

const QUESTION_KEYS = ["name", "world", "desire", "flaw", "genre", "artStyle"] as const;

// Local fallback replies used when Vertex AI is unavailable (e.g. API not yet enabled)
const VERTEX_FALLBACK_REPLIES: Record<string, string> = {
  name: "The echoes of your name shall resound through this tale.\n\nNow — describe the world you inhabit. What era? What land?",
  world: "A vivid world takes shape around you.\n\nNow tell me — what is the one thing you desire above all else?",
  desire: "Hunger\u2026 I can taste it.\n\nFinally — confess to me your greatest flaw, or your deepest fear.",
  flaw: "The crack in your armour is noted.\n\nNow — what genre shall your tale inhabit? Gothic fantasy, dark sci-fi, horror, mystery, western… or something of your own devising?",
  genre: "Your story’s nature is set.\n\nOne last thing — how shall your world be rendered visually? Stark woodcut, watercolour, noir photography, anime brushwork, or another style entirely?",
  artStyle: "The Terminal has recorded your soul’s blueprint. The story begins\u2026 now.",
};

export async function POST(req: NextRequest) {
  const token = await getVertexToken();
  if (!token) {
    return NextResponse.json({ error: "Vertex AI credentials not configured" }, { status: 500 });
  }

  try {
    const { sessionId, questionIndex, answer, previousAnswers } = (await req.json()) as {
      sessionId?: string;
      questionIndex: number;
      answer: string;
      previousAnswers: Record<string, string>;
    };

    const nextIndex = questionIndex + 1;
    const isComplete = nextIndex >= QUESTIONS.length;

    const allAnswers = { ...previousAnswers, [QUESTION_KEYS[questionIndex]]: answer };

    const systemContext = `You are the Destiny Terminal, an ancient mystical oracle in a gothic fantasy universe. You collect six pieces of information to craft a unique story for the traveller.

Your tone: dramatic, literary, gothic-fantasy, slightly ominous, poetic. Never use exclamation marks. Use ellipses for dramatic pauses. Responses must be 2-4 sentences maximum.

The traveller just answered question ${questionIndex + 1} of 6 (about their ${["name and trade", "world and era", "ultimate desire", "greatest flaw", "story genre", "visual art style"][questionIndex]}) with: "${answer}"`;

    let prompt: string;

    if (isComplete) {
      prompt = `${systemContext}

All six answers collected:
1. Name/Trade: ${allAnswers.name ?? "unknown"}
2. World/Era: ${allAnswers.world ?? "unknown"}
3. Desire: ${allAnswers.desire ?? "unknown"}
4. Flaw: ${allAnswers.flaw ?? "unknown"}
5. Genre: ${allAnswers.genre ?? "unknown"}
6. Art Style: ${allAnswers.artStyle ?? answer}

1. Acknowledge their chosen art style with a brief, evocative dramatic sentence.
2. Declare the soul-binding sequence complete.
3. Tell them their tale is about to begin. End with "The story begins... now."
Maximum 3 sentences total. No extra words.`;
    } else {
      prompt = `${systemContext}

1. React to their answer with ONE brief, dramatic sentence (acknowledge what they revealed).
2. Then ask the next question exactly as written: "${QUESTIONS[nextIndex]}"

Two sentences total. Keep it tight and atmospheric.`;
    }

    const vertexRes = await fetch(vertexUrl("gemini-2.0-flash-lite"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });
    if (!vertexRes.ok) {
      const errText = await vertexRes.text();
      console.error("[terminal] Vertex AI error:", vertexRes.status, errText.substring(0, 200));
      // On 403 (API not enabled) or auth errors, use local fallback so UX stays clean
      if (vertexRes.status === 403 || vertexRes.status === 401 || vertexRes.status === 503) {
        const currentKey = QUESTION_KEYS[questionIndex];
        const fallbackReply = VERTEX_FALLBACK_REPLIES[currentKey] ?? "The terminal flickers. Your journey continues.";
        return NextResponse.json({ reply: fallbackReply, heroProfile: null });
      }
      return NextResponse.json({ error: "Vertex AI request failed" }, { status: 500 });
    }
    const vertexData = await vertexRes.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const reply = (vertexData.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();

    const heroProfile = isComplete ? allAnswers : null;
    // Persist hero profile to Firestore as soon as onboarding completes (non-blocking)
    if (heroProfile && sessionId) {
      void saveHeroToFirestore(sessionId, heroProfile as unknown as import("@/lib/types").HeroProfile)
        .catch((e) => console.warn("[terminal] Firestore save non-critical:", e));
    }

    return NextResponse.json({ reply, heroProfile });
  } catch (err) {
    console.error("[/api/gemini/terminal] Error:", err);
    return NextResponse.json({ error: "Gemini request failed" }, { status: 500 });
  }
}
