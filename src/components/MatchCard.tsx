"use client";

import Link from "next/link";
import type { Match } from "@/lib/types";
import { matchWinProb, toBackLay } from "@/lib/odds";

function MiniPrice({ kind, price }: { kind: "back" | "lay"; price: number }) {
  return (
    <span
      className={`inline-block w-[62px] rounded px-1 py-1 text-center text-[13px] font-extrabold ${
        kind === "back" ? "bg-[#a9d7f8] text-[#0b3556]" : "bg-[#f6c3d5] text-[#571231]"
      }`}
    >
      {price.toFixed(2)}
    </span>
  );
}

export default function MatchCard({ match }: { match: Match }) {
  const pA = matchWinProb(match);
  const blA = toBackLay(pA);
  const blB = toBackLay(1 - pA);
  const start = new Date(match.startTime);

  return (
    <Link
      href={`/match/${match.id}`}
      className="block rounded-xl border border-white/10 bg-[#10141b] hover:border-amber-400/50 transition overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 text-[11px] text-zinc-400">
        <span className="font-semibold uppercase tracking-wide">{match.series}</span>
        <span>• {match.format}</span>
        {match.source === "sim" && (
          <span className="ml-1 rounded bg-sky-500/15 text-sky-300 border border-sky-400/30 px-1.5 py-px text-[9px] font-bold">
            DEMO FEED
          </span>
        )}
        <span className="ml-auto">
          {match.status === "live" && (
            <span className="inline-flex items-center gap-1.5 font-bold text-red-400">
              <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" /> LIVE
            </span>
          )}
          {match.status === "upcoming" && (
            <span className="text-zinc-400">
              {start.toLocaleDateString(undefined, { day: "numeric", month: "short" })},{" "}
              {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </span>
          )}
          {match.status === "finished" && <span className="font-bold text-zinc-300">RESULT</span>}
        </span>
      </div>

      <div className="px-3 py-2 space-y-1.5">
        {[
          { team: match.teamA, bl: blA },
          { team: match.teamB, bl: blB },
        ].map(({ team, bl }) => (
          <div key={team} className="flex items-center gap-2">
            <span className={`flex-1 truncate font-semibold text-[15px] ${match.winner === team ? "text-amber-300" : ""}`}>
              {team}
              {match.winner === team && " 🏆"}
            </span>
            <MiniPrice kind="back" price={bl.back} />
            <MiniPrice kind="lay" price={bl.lay} />
          </div>
        ))}
      </div>

      {(match.scoreText || match.status === "finished") && (
        <div className="px-3 pb-2.5 text-xs text-zinc-400 truncate">
          {match.scoreText}
          {match.status === "finished" && match.winner ? ` — ${match.winner} won` : ""}
          {match.status === "finished" && match.winner === null ? " — Match tied" : ""}
        </div>
      )}
    </Link>
  );
}
