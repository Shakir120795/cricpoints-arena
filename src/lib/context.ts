"use client";

// Shared app context — implemented by two providers behind one interface:
//  • DemoProvider      (localStorage, built-in simulator feed)
//  • SupabaseProvider  (Supabase Auth + Postgres, CricAPI matches)
// Pages only ever talk to this interface.

import { createContext, useContext } from "react";
import type { Bet, CasinoPlay, Invite, LeaderboardEntry, MarketType, Match, BetSide, User } from "./types";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CasinoResult extends ActionResult {
  payout?: number;
  detail?: string;
  /** coin flip outcome */
  coin?: "heads" | "tails";
  /** wheel segment landed on */
  segmentIndex?: number;
  segmentLabel?: string;
  multiplier?: number;
  /** dice rolls */
  d1?: number;
  d2?: number;
}

export interface AppContextValue {
  ready: boolean;
  demoMode: boolean;
  user: User | null;
  /** All registered users (for admin view + leaderboard names). Demo mode: local users. */
  users: User[];
  /** Bets visible in this mode (demo: all; supabase: your own). Pages filter by userId. */
  bets: Bet[];
  matches: Match[];
  /** Current user's casino history, newest first. */
  casinoPlays: CasinoPlay[];
  leaderboard: LeaderboardEntry[];
  weeklyWinners: { name: string; pnl: number }[];
  isAdmin: boolean;
  /** All invites (admin view). Empty for non-admins in Supabase mode. */
  invites: Invite[];
  /**
   * The single global welcome-points setting. EVERY new account receives
   * exactly this many points — it is never set per invite or per person.
   */
  welcomePoints: number;

  /** Registration is invite-only. Returns true if the code is usable. */
  checkInvite: (code: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string, inviteCode: string) => Promise<ActionResult>;
  login: (email: string, password: string) => Promise<ActionResult>;
  logout: () => void;
  claimBonus: () => ActionResult;
  placeBet: (
    matchId: string,
    market: MarketType,
    selection: string,
    side: BetSide,
    stake: number
  ) => ActionResult;
  cancelBet: (betId: string) => void;
  playCoin: (choice: "heads" | "tails", stake: number) => CasinoResult;
  playWheel: (stake: number) => CasinoResult;
  playDice: (choice: "over" | "seven" | "under", stake: number) => CasinoResult;

  // Admin-lite (content admin only — no credit/bookie functions exist by design)
  /** Create a single-use invite; returns its code so the UI can show/copy the link. */
  adminCreateInvite: () => Promise<ActionResult & { code?: string }>;
  adminRevokeInvite: (inviteId: string) => void;
  /** Edit the single global welcome-points setting (applies to all future signups). */
  adminSetWelcomePoints: (points: number) => ActionResult;
  adminAddMatch: (input: { teamA: string; teamB: string; series: string; format: "T20" | "ODI" }) => void;
  adminToggleSuspend: (matchId: string) => void;
  adminStartMatch: (matchId: string) => void;
  adminSettle: (matchId: string, winner: string | null) => void;
  refreshApiMatches: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Default for the global welcome-points platform setting (admin-configurable). */
export const WELCOME_POINTS = 10000;
export const DAILY_BONUS = 1000;

export function todayKey(): string {
  // Local calendar date as YYYY-MM-DD
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
