// Server route: live cricket data from CricAPI when CRICAPI_KEY is set.
// Falls back to { source: "demo" } so the client keeps using the built-in
// demo feed (ball-by-ball simulator) — the app is fully functional either way.

import { connection } from "next/server";
import type { Match } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function normalize(d: any): Match | null {
  try {
    const teams: string[] = d.teams ?? [];
    if (teams.length < 2) return null;
    const [teamA, teamB] = teams;
    const ended = Boolean(d.matchEnded);
    const started = Boolean(d.matchStarted);
    const status = ended ? "finished" : started ? "live" : "upcoming";

    const scoreText = Array.isArray(d.score)
      ? d.score.map((s: any) => `${s.inning}: ${s.r}/${s.w} (${s.o} ov)`).join("  •  ")
      : undefined;

    let winner: string | null = null;
    if (ended && typeof d.status === "string") {
      for (const t of teams) {
        if (d.status.toLowerCase().startsWith(t.toLowerCase())) winner = t;
      }
    }

    const fmtRaw = String(d.matchType ?? "").toLowerCase();
    const format = fmtRaw === "odi" ? "ODI" : fmtRaw === "test" ? "Test" : "T20";

    return {
      id: `cricapi-${d.id}`,
      source: "cricapi",
      teamA,
      teamB,
      series: d.venue ? `Live • ${d.venue}` : "CricAPI Fixtures",
      format: format as Match["format"],
      status: status as Match["status"],
      startTime: d.dateTimeGMT ? Date.parse(d.dateTimeGMT) : Date.now(),
      scoreText,
      winner,
      marketsSuspended: false,
      session6Line: 44.5,
      session10Line: 82.5,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  await connection(); // always evaluate at request time (env-dependent)
  const key = process.env.CRICAPI_KEY;
  if (!key) {
    return Response.json({ source: "demo", matches: [] });
  }
  try {
    const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${key}&offset=0`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`CricAPI ${res.status}`);
    const json = await res.json();
    const data: any[] = Array.isArray(json.data) ? json.data : [];
    const matches = data.map(normalize).filter((m): m is Match => m !== null);
    return Response.json({ source: "cricapi", matches });
  } catch {
    return Response.json({ source: "demo", matches: [] });
  }
}
