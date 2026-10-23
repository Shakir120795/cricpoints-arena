// ─────────────────────────────────────────────────────────────────────────────
// ODDS ENGINE — win-probability model → exchange-style Back (Lagai) / Lay (Khai)
// ─────────────────────────────────────────────────────────────────────────────
// How it works:
//  1. Every market starts from a WIN PROBABILITY for a selection.
//     • Pre-match: from a static team-rating map (logistic on rating diff).
//     • In-play: a resource-based projection — the batting side's projected
//       final total is estimated from runs, wickets in hand, balls remaining
//       and current run rate; that projection is compared (logistic) against
//       the target (2nd innings) or the opponent's expected chase total
//       (1st innings).
//     • Session (fancy) markets: probability that the first-innings total at
//       the milestone (over 6 / over 10) finishes above the line, from a
//       normal approximation around the projected session total.
//  2. Probability p → fair decimal odds = 1/p.
//  3. A small, PUBLISHED margin is applied in odds space so that
//     Back < fair < Lay:   back = fair × (1 − m),  lay = fair × (1 + m),
//     with m = 1.5%. Prices are rounded to 2 decimals, min 1.01.
// ─────────────────────────────────────────────────────────────────────────────

import type { Match } from "./types";

export const MARGIN = 0.015;

export const TEAM_RATINGS: Record<string, number> = {
  India: 92,
  Australia: 90,
  England: 88,
  "South Africa": 87,
  Pakistan: 85,
  "New Zealand": 84,
  Afghanistan: 79,
  "Sri Lanka": 78,
  "West Indies": 77,
  Bangladesh: 76,
  Ireland: 72,
  Zimbabwe: 70,
  "Mumbai Indians": 88,
  "Chennai Super Kings": 87,
  "Royal Challengers Bengaluru": 86,
  "Kolkata Knight Riders": 85,
};

export const TEAM_SHORT: Record<string, string> = {
  India: "IND",
  Australia: "AUS",
  England: "ENG",
  "South Africa": "SA",
  Pakistan: "PAK",
  "New Zealand": "NZ",
  Afghanistan: "AFG",
  "Sri Lanka": "SL",
  "West Indies": "WI",
  Bangladesh: "BAN",
  Ireland: "IRE",
  Zimbabwe: "ZIM",
  "Mumbai Indians": "MI",
  "Chennai Super Kings": "CSK",
  "Royal Challengers Bengaluru": "RCB",
  "Kolkata Knight Riders": "KKR",
};

export function shortName(team: string): string {
  if (TEAM_SHORT[team]) return TEAM_SHORT[team];
  return team
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 4)
    .toUpperCase();
}

export function ratingOf(team: string): number {
  return TEAM_RATINGS[team] ?? 75;
}

export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
export const logistic = (x: number) => 1 / (1 + Math.exp(-x));
/** Approximation of the standard normal CDF at z. */
export const normalCdf = (z: number) => 1 / (1 + Math.exp(-1.702 * z));

const PAR_T20 = 162;
const PAR_RR_T20 = 8.1;
const PAR_ODI = 268;
const PAR_RR_ODI = 5.35;

function parFor(format: string) {
  return format === "ODI" ? { par: PAR_ODI, parRR: PAR_RR_ODI, balls: 300 } : { par: PAR_T20, parRR: PAR_RR_T20, balls: 120 };
}

/** Pre-match win probability for teamA (logistic on rating difference). */
export function preMatchProb(teamA: string, teamB: string): number {
  const diff = ratingOf(teamA) - ratingOf(teamB);
  return clamp(logistic(diff / 9), 0.06, 0.94);
}

/** Projected final total for an innings given its current state. */
export function projectedTotal(runs: number, wickets: number, balls: number, totalBalls: number, parRR: number): number {
  const ballsLeft = totalBalls - balls;
  if (ballsLeft <= 0 || wickets >= 10) return runs;
  const crr = balls > 0 ? runs / (balls / 6) : parRR;
  const blended = 0.5 * crr + 0.5 * parRR;
  const wicketFactor = 0.45 + 0.55 * ((10 - wickets) / 10);
  let rr = blended * wicketFactor;
  if (ballsLeft <= totalBalls / 4) rr *= 1.1; // death-overs acceleration
  return runs + (ballsLeft / 6) * rr;
}

/** Probability that teamA eventually wins the match, given current state. */
export function matchWinProb(m: Match): number {
  if (m.status === "finished") {
    if (m.winner === m.teamA) return 1;
    if (m.winner === m.teamB) return 0;
    return 0.5;
  }
  const pre = preMatchProb(m.teamA, m.teamB);
  const sim = m.sim;
  if (!sim || m.status === "upcoming") return pre;
  const { par, parRR, balls: totalBalls } = parFor(m.format);
  const inn = sim.innings[sim.current];
  if (!inn) return pre;

  if (sim.current === 0) {
    const proj = projectedTotal(inn.runs, inn.wickets, inn.balls, totalBalls, parRR);
    const other = inn.batting === m.teamA ? m.teamB : m.teamA;
    const expectedChase = par + (ratingOf(other) - ratingOf(inn.batting)) * 0.9;
    const pBatting = logistic((proj - expectedChase) / 15);
    return clamp(inn.batting === m.teamA ? pBatting : 1 - pBatting, 0.02, 0.98);
  }

  // Second innings — chase.
  const target = sim.target ?? sim.innings[0].runs + 1;
  if (inn.runs >= target) return inn.batting === m.teamA ? 1 : 0;
  const proj = projectedTotal(inn.runs, inn.wickets, inn.balls, totalBalls, parRR);
  const pChase = logistic((proj - target) / 8.5);
  return clamp(inn.batting === m.teamA ? pChase : 1 - pChase, 0.02, 0.98);
}

/** Probability the first-innings total at the milestone (over 6 or 10) is OVER the line. */
export function sessionOverProb(m: Match, which: 6 | 10): number {
  const line = which === 6 ? m.session6Line : m.session10Line;
  const sim = m.sim;
  if (!sim) return 0.5;
  const result = which === 6 ? sim.s6Runs : sim.s10Runs;
  if (result !== undefined) return result > line ? 1 : 0;
  const inn = sim.innings[0];
  if (!inn) return 0.5;
  const milestoneBalls = which * 6;
  if (inn.balls >= milestoneBalls) return inn.runs > line ? 1 : 0;
  const { parRR } = parFor(m.format);
  const rb = milestoneBalls - inn.balls;
  const crr = inn.balls > 0 ? inn.runs / (inn.balls / 6) : parRR;
  const rr = 0.5 * crr + 0.5 * parRR;
  const mu = inn.runs + (rb / 6) * rr;
  const sd = 3 + 4.2 * Math.sqrt(rb / 6);
  return clamp(normalCdf((mu - line) / sd), 0.02, 0.98);
}

export interface BackLay {
  back: number;
  lay: number;
  fair: number;
}

/** Convert a win probability to exchange Back/Lay decimal prices (margin applied, published). */
export function toBackLay(p: number): BackLay {
  const pc = clamp(p, 0.02, 0.98);
  const fair = 1 / pc;
  const back = Math.max(1.01, +(fair * (1 - MARGIN)).toFixed(2));
  const lay = Math.max(back + 0.01, +(fair * (1 + MARGIN)).toFixed(2));
  return { back, lay, fair: +fair.toFixed(2) };
}

/** Current Back/Lay prices for any selection in any market of a match. */
export function currentOddsFor(
  m: Match,
  market: "match" | "session6" | "session10",
  selection: string,
  side: "back" | "lay"
): number {
  let p: number;
  if (market === "match") {
    const pA = matchWinProb(m);
    p = selection === m.teamA ? pA : 1 - pA;
  } else {
    const pOver = sessionOverProb(m, market === "session6" ? 6 : 10);
    p = selection.startsWith("Over") ? pOver : 1 - pOver;
  }
  const bl = toBackLay(p);
  return side === "back" ? bl.back : bl.lay;
}

export function formatOvers(balls: number): string {
  return `${Math.floor(balls / 6)}.${balls % 6}`;
}

export const round2 = (x: number) => Math.round(x * 100) / 100;
