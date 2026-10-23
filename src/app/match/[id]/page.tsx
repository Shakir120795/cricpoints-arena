"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import type { Match } from "@/lib/types";
import { matchWinProb, sessionOverProb, toBackLay } from "@/lib/odds";
import OddsBox from "@/components/OddsBox";
import BetSlip, { marketLabel, type SlipSelection } from "@/components/BetSlip";

function MatchDetail() {
  const params = useParams<{ id: string }>();
  const { matches, bets, user, ready, isAdmin, cancelBet, adminToggleSuspend, adminStartMatch, adminSettle } =
    useApp();
  const [slip, setSlip] = useState<SlipSelection | null>(null);

  const match = matches.find((m) => m.id === params.id);
  const myBets = useMemo(
    () => (user ? bets.filter((b) => b.matchId === params.id && b.userId === user.id) : []),
    [bets, params.id, user]
  );

  if (!ready) return <div className="py-24 text-center text-zinc-500">Loading…</div>;
  if (!match) {
    return (
      <div className="py-24 text-center">
        <p className="text-zinc-400">Match not found.</p>
        <Link href="/" className="text-amber-300 underline text-sm">
          ← Back to matches
        </Link>
      </div>
    );
  }

  const suspended =
    match.marketsSuspended || (match.sim ? match.sim.suspendedUntil > Date.now() : false);
  const pA = matchWinProb(match);
  const bettingOpen = match.status !== "finished";

  return (
    <div className="mt-4">
      <Link href="/" className="text-sm text-zinc-400 hover:text-amber-300">
        ← All matches
      </Link>

      {/* Score header */}
      <div className="mt-3 rounded-2xl border border-white/10 bg-[#10141b] p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
          <span className="font-semibold uppercase tracking-wide">{match.series}</span>
          <span>• {match.format}</span>
          {match.source === "sim" && (
            <span className="rounded bg-sky-500/15 text-sky-300 border border-sky-400/30 px-1.5 py-px text-[9px] font-bold">
              DEMO FEED — simulated live match
            </span>
          )}
          {match.source === "cricapi" && (
            <span className="rounded bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 px-1.5 py-px text-[9px] font-bold">
              CRICAPI
            </span>
          )}
          <span className="ml-auto">
            {match.status === "live" && (
              <span className="inline-flex items-center gap-1.5 font-bold text-red-400">
                <span className="live-dot inline-block w-2 h-2 rounded-full bg-red-500" /> LIVE
              </span>
            )}
            {match.status === "upcoming" && (
              <span>
                Starts {new Date(match.startTime).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              </span>
            )}
            {match.status === "finished" && <span className="font-bold text-zinc-300">FULL TIME</span>}
          </span>
        </div>

        <h1 className="mt-2 text-xl sm:text-2xl font-extrabold tracking-tight">
          {match.teamA} <span className="text-zinc-500 font-semibold">vs</span> {match.teamB}
        </h1>

        {match.scoreText && <div className="mt-1.5 text-[15px] font-semibold text-zinc-200">{match.scoreText}</div>}

        {match.sim && match.status === "live" && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-amber-300 font-semibold mr-1">{match.sim.lastEvent}</span>
            {match.sim.recentBalls.slice(-8).map((b, i) => (
              <span
                key={i}
                className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-[11px] font-bold ${
                  b === "W"
                    ? "bg-red-500/25 text-red-300"
                    : b === "4" || b === "6"
                      ? "bg-emerald-500/25 text-emerald-300"
                      : "bg-white/10 text-zinc-300"
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {match.status === "finished" && (
          <div className="mt-3 rounded-lg bg-amber-400/10 border border-amber-400/30 px-3 py-2 font-bold text-amber-300">
            {match.winner ? `🏆 ${match.winner} won the match` : "Match tied — predictions refunded"}
          </div>
        )}
        {suspended && match.status === "live" && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-sm font-semibold text-red-300">
            ⛔ Market suspended — odds will reopen in a few seconds.
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] mt-4 items-start">
        <div className="space-y-4 min-w-0">
          {/* Match Odds */}
          <MarketCard title="Match Odds" subtitle="Who wins the match?">
            {[match.teamA, match.teamB].map((team) => {
              const p = team === match.teamA ? pA : 1 - pA;
              const bl = toBackLay(p);
              return (
                <div key={team} className="flex items-center gap-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-semibold text-[15px]">{team}</div>
                    <div className="text-[11px] text-zinc-500">Win probability {(p * 100).toFixed(0)}%</div>
                  </div>
                  <div className="w-[86px]">
                    <OddsBox
                      kind="back"
                      price={bl.back}
                      suspended={suspended || !bettingOpen}
                      selected={slip?.market === "match" && slip.selection === team && slip.side === "back"}
                      onClick={() => setSlip({ market: "match", selection: team, side: "back" })}
                    />
                  </div>
                  <div className="w-[86px]">
                    <OddsBox
                      kind="lay"
                      price={bl.lay}
                      suspended={suspended || !bettingOpen}
                      selected={slip?.market === "match" && slip.selection === team && slip.side === "lay"}
                      onClick={() => setSlip({ market: "match", selection: team, side: "lay" })}
                    />
                  </div>
                </div>
              );
            })}
          </MarketCard>

          {/* Session markets — ball-by-ball matches only */}
          {match.sim && (
            <>
              <SessionMarket
                match={match}
                which={6}
                suspended={suspended || !bettingOpen}
                slip={slip}
                setSlip={setSlip}
              />
              <SessionMarket
                match={match}
                which={10}
                suspended={suspended || !bettingOpen}
                slip={slip}
                setSlip={setSlip}
              />
            </>
          )}

          {/* My bets on this match */}
          {user && myBets.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
              <h3 className="font-extrabold text-sm mb-2">Your predictions on this match</h3>
              <div className="space-y-2">
                {myBets.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${b.side === "back" ? "bg-[#a9d7f8] text-[#0b3556]" : "bg-[#f6c3d5] text-[#571231]"}`}>
                      {b.side.toUpperCase()}
                    </span>
                    <span className="font-semibold">{b.selection}</span>
                    <span className="text-zinc-400">@ {b.odds.toFixed(2)} • {marketLabel(b.market)}</span>
                    <span className="text-zinc-400">Stake {b.stake.toLocaleString()}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <StatusChip status={b.status} pnl={b.pnl} />
                      {b.status === "pending" && match.status !== "finished" && (
                        <button
                          onClick={() => cancelBet(b.id)}
                          className="text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-2.5 py-1"
                        >
                          Cancel
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin-lite controls */}
          {isAdmin && (
            <div className="rounded-xl border border-purple-400/30 bg-purple-500/5 p-4">
              <h3 className="font-extrabold text-sm text-purple-200">Admin controls (content only)</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={() => adminToggleSuspend(match.id)}
                  className="text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
                >
                  {match.marketsSuspended ? "Resume market" : "Suspend market"}
                </button>
                {match.status === "upcoming" && (
                  <button
                    onClick={() => adminStartMatch(match.id)}
                    className="text-xs font-bold bg-emerald-500/20 text-emerald-200 rounded-full px-3 py-1.5"
                  >
                    Start match now
                  </button>
                )}
                {match.status !== "finished" && (
                  <>
                    <button
                      onClick={() => adminSettle(match.id, match.teamA)}
                      className="text-xs font-bold bg-amber-400/20 text-amber-200 rounded-full px-3 py-1.5"
                    >
                      Settle: {match.teamA} wins
                    </button>
                    <button
                      onClick={() => adminSettle(match.id, match.teamB)}
                      className="text-xs font-bold bg-amber-400/20 text-amber-200 rounded-full px-3 py-1.5"
                    >
                      Settle: {match.teamB} wins
                    </button>
                    <button
                      onClick={() => adminSettle(match.id, null)}
                      className="text-xs font-bold bg-white/10 rounded-full px-3 py-1.5"
                    >
                      Settle: Tie / Abandoned
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bet slip column */}
        <div className="lg:sticky lg:top-28">
          {slip ? (
            <BetSlip match={match} sel={slip} onClose={() => setSlip(null)} />
          ) : (
            <div className="rounded-xl border border-dashed border-white/15 bg-[#10141b] p-4 text-sm text-zinc-400">
              <div className="font-bold text-zinc-200 mb-1">Bet slip</div>
              Tap any blue <b className="text-sky-300">Back (Lagai)</b> or pink <b className="text-pink-300">Lay (Khai)</b>{" "}
              price to start a prediction.
              <ul className="mt-2 space-y-1 text-[13px] list-disc list-inside">
                <li><b>Back</b> — risk your stake, win stake × (odds − 1) if it happens.</li>
                <li><b>Lay</b> — bet it won&apos;t happen; your liability is covered from your points balance.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-extrabold">{title}</h3>
        {subtitle && <span className="text-[11px] text-zinc-500">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function SessionMarket({
  match,
  which,
  suspended,
  slip,
  setSlip,
}: {
  match: Match;
  which: 6 | 10;
  suspended: boolean;
  slip: SlipSelection | null;
  setSlip: (s: SlipSelection) => void;
}) {
  const market = which === 6 ? ("session6" as const) : ("session10" as const);
  const line = which === 6 ? match.session6Line : match.session10Line;
  const result = which === 6 ? match.sim?.s6Runs : match.sim?.s10Runs;
  const pOver = sessionOverProb(match, which);

  return (
    <MarketCard
      title={`Session — First ${which} Overs Total`}
      subtitle={result !== undefined ? `Settled at ${result} runs` : `Line: ${line} runs`}
    >
      {result !== undefined ? (
        <div className="py-2 text-sm">
          Final total: <b className="text-amber-300">{result} runs</b> —{" "}
          <b>{result > line ? `Over ${line}` : `Under ${line}`}</b> won. Predictions settled automatically.
        </div>
      ) : (
        [
          { sel: `Over ${line}`, p: pOver },
          { sel: `Under ${line}`, p: 1 - pOver },
        ].map(({ sel, p }) => {
          const bl = toBackLay(p);
          return (
            <div key={sel} className="flex items-center gap-2 py-1.5">
              <div className="flex-1 min-w-0">
                <div className="truncate font-semibold text-[15px]">{sel} runs</div>
                <div className="text-[11px] text-zinc-500">Probability {(p * 100).toFixed(0)}%</div>
              </div>
              <div className="w-[86px]">
                <OddsBox
                  kind="back"
                  price={bl.back}
                  suspended={suspended}
                  selected={slip?.market === market && slip.selection === sel && slip.side === "back"}
                  onClick={() => setSlip({ market, selection: sel, side: "back" })}
                />
              </div>
              <div className="w-[86px]">
                <OddsBox
                  kind="lay"
                  price={bl.lay}
                  suspended={suspended}
                  selected={slip?.market === market && slip.selection === sel && slip.side === "lay"}
                  onClick={() => setSlip({ market, selection: sel, side: "lay" })}
                />
              </div>
            </div>
          );
        })
      )}
    </MarketCard>
  );
}

export function StatusChip({ status, pnl }: { status: string; pnl?: number }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-400/15 text-amber-300",
    won: "bg-emerald-500/15 text-emerald-300",
    lost: "bg-red-500/15 text-red-300",
    refunded: "bg-white/10 text-zinc-300",
    cancelled: "bg-white/10 text-zinc-400",
  };
  return (
    <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${styles[status] ?? styles.pending}`}>
      {status.toUpperCase()}
      {pnl !== undefined && status !== "pending" ? ` • ${pnl > 0 ? "+" : ""}${pnl.toLocaleString()}` : ""}
    </span>
  );
}

export default function MatchDetailPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-zinc-500">Loading…</div>}>
      <MatchDetail />
    </Suspense>
  );
}
