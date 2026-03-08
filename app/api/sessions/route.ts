import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createSessionDoc } from "@/lib/firestore";

export async function POST() {
  const sessionId = randomUUID();
  // Persist to Firestore — no-op if credentials not configured
  await createSessionDoc(sessionId);
  return NextResponse.json({ sessionId, status: "onboarding" });
}
