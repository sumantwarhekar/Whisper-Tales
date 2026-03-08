"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import StoryArchive from "@/components/StoryArchive";
import { getArchivedSession } from "@/lib/api";
import type { GameSession } from "@/lib/types";

export default function ArchivePage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const load = async () => {
      try {
        const data = await getArchivedSession(sessionId);
        setSession(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={32} className="animate-spin text-amber-400/60" />
          <p className="font-mono text-sm text-zinc-500">Loading tale from the archive...</p>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <AlertTriangle size={32} className="text-amber-400/60" />
          <p className="font-mono text-sm text-zinc-300">Tale not found in the archive.</p>
          <p className="text-zinc-600 text-xs font-mono">{error}</p>
          <a
            href="/"
            className="mt-4 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-mono text-sm rounded-lg transition-colors"
          >
            Begin a new tale
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <StoryArchive session={session} />
    </div>
  );
}
