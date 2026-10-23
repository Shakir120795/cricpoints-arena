// Shared domain types for CricPoints Arena.
// Everything in this app is VIRTUAL POINTS only — no real money anywhere.

export type MatchStatus = "upcoming" | "live" | "finished";
export type MarketType = "match" | "session6" | "session10";
export type BetSide = "back" | "lay";
export type BetStatus = "pending" | "won" | "lost" | "refunded" | "cancelled";

export interface InningsState {
  batting: string;
  runs: number;
  wickets: number;
  balls: number;
}

/** Ball-by-ball simulator state (demo feed matches only). */
export interface SimState {
  innings: InningsState[];
  current: 0 | 1;
  target?: number;
  lastEvent: string;
  recentBalls: string[];
  /** epoch ms until which the market is suspended (e.g. just after a wicket) */
  suspendedUntil: number;
  s6Runs?: number; // first-innings total after 6 overs, once reached
  s10Runs?: number; // first-innings total after 10 overs, once reached
}

export interface Match {
  id: string;
  source: "sim" | "cricapi" | "manual";
  teamA: string;
  teamB: string;
  series: string;
  format: "T20" | "ODI" | "Test";
  status: MatchStatus;
  startTime: number;
  scoreText?: string;
  winner?: string | null;
  marketsSuspended: boolean;
  sim?: SimState;
  session6Line: number;
  session10Line: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: number;
  lastBonusDate?: string; // YYYY-MM-DD (local)
  isAdmin?: boolean;
}

export interface Bet {
  id: string;
  userId: string;
  matchId: string;
  matchLabel: string;
  market: MarketType;
  /** team name for match market, or "Over 44.5" / "Under 44.5" for sessions */
  selection: string;
  side: BetSide;
  /** decimal odds locked in at placement time */
  odds: number;
  /** backer's stake (for a lay, this is the amount the layer wins if the selection loses) */
  stake: number;
  /** amount reserved from balance at placement: stake for back, stake*(odds-1) for lay */
  liability: number;
  status: BetStatus;
  pnl?: number;
  createdAt: number;
  settledAt?: number;
}

export interface CasinoPlay {
  id: string;
  userId: string;
  game: "coin" | "wheel" | "dice";
  stake: number;
  /** total points returned to the user (0 on a loss) */
  payout: number;
  detail: string;
  createdAt: number;
}

/**
 * A single-use registration invite. Registration is invite-only: a valid,
 * unused, unrevoked invite is required to sign up. Every invite grants the
 * SAME standard welcome points (the global platform setting) — there is no
 * per-invite or per-person point amount, by design.
 */
export interface Invite {
  id: string;
  code: string;
  createdAt: number;
  usedByName?: string;
  usedByEmail?: string;
  usedAt?: number;
  revoked: boolean;
}

export interface LeaderboardEntry {
  name: string;
  balance: number;
  isBot?: boolean;
  isYou?: boolean;
}
