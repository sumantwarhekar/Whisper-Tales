import { NextRequest, NextResponse } from "next/server";
import {
  getSessionFromFirestore,
  saveFullSessionToFirestore,
  appendRoundToFirestore,
  saveFinaleToFirestore,
} from "@/lib/firestore";
import type { GameSession, StoryRound } from "@/lib/types";

// GET /api/sessions/:sessionId — retrieve session (Firestore only)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const session = await getSessionFromFirestore(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

// POST /api/sessions/:sessionId — persist full session at archive time
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = (await req.json()) as Partial<GameSession>;

  // Remove sessionId from body before storing (it's the doc key)
  const { sessionId: _id, ...sessionData } = body as GameSession;
  void _id;

  await saveFullSessionToFirestore(sessionId, sessionData);

  const shareUrl = `${req.headers.get("origin") ?? ""}/archive/${sessionId}`;
  return NextResponse.json({ sessionId, shareUrl });
}

// PATCH /api/sessions/:sessionId — incremental saves during story loop
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const { round, finaleText } = (await req.json()) as {
    round?: StoryRound;
    finaleText?: string;
  };

  if (round) await appendRoundToFirestore(sessionId, round);
  if (finaleText) await saveFinaleToFirestore(sessionId, finaleText);

  return NextResponse.json({ ok: true });
}
