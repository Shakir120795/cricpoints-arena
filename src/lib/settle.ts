// Bet settlement math — correct exchange mechanics.
//  BACK: reserve = stake.            Win → credit stake × odds (profit stake×(odds−1)). Lose → credit 0.
//  LAY:  reserve = stake × (odds−1)  (the liability). If the selection LOSES, the layer wins:
//        credit liability + stake. If the selection wins: credit 0 (liability lost).
//  Refund (tie / void): credit back exactly what was reserved. PnL 0.

import type { Bet, BetStatus, Match, User } from "./types";
import { round2 } from "./odds";

export function betReserve(side: "back" | "lay", odds: number, stake: number): number {
  return side === "back" ? stake : round2(stake * (odds - 1));
}

interface Outcome {
  credit: number;
  pnl: number;
  status: BetStatus;
}

/** won === null means void/refund. */
export function betOutcome(bet: Bet, won: boolean | null): Outcome {
  if (won === null) return { credit: bet.liability, pnl: 0, status: "refunded" };
  if (bet.side === "back") {
    return won
      ? { credit: round2(bet.stake * bet.odds), pnl: round2(bet.stake * (bet.odds - 1)), status: "won" }
      : { credit: 0, pnl: -bet.stake, status: "lost" };
  }
  // lay
  return won
    ? { credit: round2(bet.liability + bet.stake), pnl: bet.stake, status: "won" }
    : { credit: 0, pnl: -bet.liability, status: "lost" };
}

function applyOutcomes<T extends User>(
  bets: Bet[],
  users: T[],
  decide: (bet: Bet) => boolean | null | undefined
): { bets: Bet[]; users: T[] } {
  const credits = new Map<string, number>();
  const nextBets = bets.map((b) => {
    if (b.status !== "pending") return b;
    const won = decide(b);
    if (won === undefined) return b;
    const o = betOutcome(b, won);
    if (o.credit > 0) credits.set(b.userId, (credits.get(b.userId) ?? 0) + o.credit);
    return { ...b, status: o.status, pnl: o.pnl, settledAt: Date.now() };
  });
  if (credits.size === 0) return { bets: nextBets, users };
  const nextUsers = users.map((u) =>
    credits.has(u.id) ? { ...u, balance: round2(u.balance + (credits.get(u.id) ?? 0)) } : u
  );
  return { bets: nextBets, users: nextUsers };
}

/** Settle all pending bets attached to a finished match (match market + any leftover session bets). */
export function settleMatchBets<T extends User>(bets: Bet[], users: T[], match: Match): { bets: Bet[]; users: T[] } {
  return applyOutcomes(bets, users, (b) => {
    if (b.matchId !== match.id) return undefined;
    if (b.market === "match") {
      if (match.winner === null || match.winner === undefined) return null; // tie → refund
      const selectionWon = b.selection === match.winner;
      return b.side === "back" ? selectionWon : !selectionWon;
    }
    // Session bets still open when the match ends: settle from sim results if
    // known, otherwise refund.
    const sim = match.sim;
    const result = b.market === "session6" ? sim?.s6Runs : sim?.s10Runs;
    if (result === undefined) return null;
    const line = parseFloat(b.selection.split(" ")[1]);
    const overWon = result > line;
    const selectionWon = b.selection.startsWith("Over") ? overWon : !overWon;
    return b.side === "back" ? selectionWon : !selectionWon;
  });
}

/** Settle session bets when their milestone total is known. */
export function settleSessionBets<T extends User>(
  bets: Bet[],
  users: T[],
  match: Match,
  market: "session6" | "session10",
  resultRuns: number
): { bets: Bet[]; users: T[] } {
  return applyOutcomes(bets, users, (b) => {
    if (b.matchId !== match.id || b.market !== market) return undefined;
    const line = parseFloat(b.selection.split(" ")[1]);
    const overWon = resultRuns > line;
    const selectionWon = b.selection.startsWith("Over") ? overWon : !overWon;
    return b.side === "back" ? selectionWon : !selectionWon;
  });
}
