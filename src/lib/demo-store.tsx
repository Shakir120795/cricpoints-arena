"use client";

// DEMO MODE provider — everything lives in the browser (localStorage):
// local accounts, points, bets, casino history, and the ball-by-ball
// simulator feed. 100% functional with zero backend and zero env vars.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bet, CasinoPlay, Invite, LeaderboardEntry, MarketType, Match, BetSide, User } from "./types";
import {
  AppContext,
  DAILY_BONUS,
  WELCOME_POINTS,
  todayKey,
  uid,
  type ActionResult,
  type AppContextValue,
  type CasinoResult,
} from "./context";
import { advanceBall, buildScoreText, createSimMatch } from "./sim";
import { currentOddsFor, round2 } from "./odds";
import { betReserve, settleMatchBets, settleSessionBets } from "./settle";
import { COIN_PAYOUT, DICE_PAYOUTS, MIN_BET, WHEEL_SEGMENTS, type DiceChoice } from "./casino";
import { randomInt, rollDie } from "./random";

const STORAGE_KEY = "cricpoints-arena-v1";
const TICK_MS = 2800;

interface StoredUser extends User {
  passHash: string;
}

interface DemoState {
  users: StoredUser[];
  sessionUserId: string | null;
  bets: Bet[];
  matches: Match[];
  casinoPlays: CasinoPlay[];
  invites: Invite[];
  settings: { welcomePoints: number };
}

/** Random single-use invite code, e.g. CPA-8K2QX-4MD7P. */
function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no easily-confused chars
  const part = (n: number) =>
    Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");
  return `CPA-${part(5)}-${part(5)}`;
}

function findInvite(invites: Invite[], code: string): Invite | undefined {
  const normalized = code.trim().toUpperCase();
  return invites.find((i) => i.code.toUpperCase() === normalized);
}

function inviteUsable(invites: Invite[], code: string): Invite | null {
  const inv = findInvite(invites, code);
  if (!inv || inv.revoked || inv.usedAt) return null;
  return inv;
}

function hashPw(pw: string): string {
  let h = 5381;
  for (let i = 0; i < pw.length; i++) h = ((h << 5) + h + pw.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

const LEADERBOARD_BOTS: LeaderboardEntry[] = [
  { name: "DhoniFinisher07", balance: 22100, isBot: true },
  { name: "RohitFanClub", balance: 18450, isBot: true },
  { name: "WicketWale", balance: 15230, isBot: true },
  { name: "CoverDriveQueen", balance: 13475, isBot: true },
  { name: "YorkerKing", balance: 9800, isBot: true },
  { name: "SpinWizard", balance: 7615, isBot: true },
];

function seedState(): DemoState {
  const now = Date.now();
  const live = createSimMatch({
    id: "sim-ind-pak",
    teamA: "India",
    teamB: "Pakistan",
    series: "T20 World Series",
    format: "T20",
    startTime: now - 25 * 60000,
    status: "live",
  });
  // Pre-roll 12 balls so the match is already in flow on first open.
  for (let i = 0; i < 12; i++) advanceBall(live);
  live.scoreText = buildScoreText(live);

  const finished: Match = {
    id: "manual-mi-csk",
    source: "manual",
    teamA: "Mumbai Indians",
    teamB: "Chennai Super Kings",
    series: "Indian T20 League",
    format: "T20",
    status: "finished",
    startTime: now - 26 * 3600000,
    scoreText: "MI 186/5 (20 ov) • CSK 182/7 (20 ov)",
    winner: "Mumbai Indians",
    marketsSuspended: false,
    session6Line: 44.5,
    session10Line: 82.5,
  };

  return {
    users: [
      {
        id: "u-admin",
        name: "Arena Admin",
        email: "admin@cricpoints.demo",
        passHash: hashPw("admin123"),
        balance: 50000,
        createdAt: now,
        isAdmin: true,
      },
      {
        id: "u-demo",
        name: "Demo Player",
        email: "player@cricpoints.demo",
        passHash: hashPw("demo123"),
        balance: WELCOME_POINTS,
        createdAt: now,
      },
    ],
    sessionUserId: null,
    bets: [],
    // One pre-generated invite so the invite flow is testable straight away;
    // admins generate more from the Admin panel.
    invites: [{ id: uid(), code: generateInviteCode(), createdAt: now, revoked: false }],
    settings: { welcomePoints: WELCOME_POINTS },
    matches: [
      live,
      createSimMatch({
        id: "sim-aus-eng",
        teamA: "Australia",
        teamB: "England",
        series: "Ashes T20 Series",
        format: "T20",
        startTime: now + 90 * 60000,
        status: "upcoming",
      }),
      createSimMatch({
        id: "sim-sa-nz",
        teamA: "South Africa",
        teamB: "New Zealand",
        series: "Tri-Nation T20",
        format: "T20",
        startTime: now + 26 * 3600000,
        status: "upcoming",
      }),
      finished,
    ],
    casinoPlays: [],
  };
}

/** Advance all live sim matches by one ball and run any settlements. Pure. */
function tickState(prev: DemoState): DemoState {
  let bets = prev.bets;
  let users = prev.users;
  let dirty = false;

  const matches = prev.matches.map((m) => {
    if (m.source !== "sim") return m;
    let cur = m;
    if (cur.status === "upcoming" && cur.startTime <= Date.now()) {
      cur = { ...cur, status: "live" as const };
      dirty = true;
    }
    if (cur.status !== "live" || !cur.sim) return cur;
    const clone = structuredClone(cur);
    const s6Before = clone.sim?.s6Runs;
    const s10Before = clone.sim?.s10Runs;
    advanceBall(clone);
    dirty = true;
    if (clone.sim && s6Before === undefined && clone.sim.s6Runs !== undefined) {
      ({ bets, users } = settleSessionBets(bets, users, clone, "session6", clone.sim.s6Runs));
    }
    if (clone.sim && s10Before === undefined && clone.sim.s10Runs !== undefined) {
      ({ bets, users } = settleSessionBets(bets, users, clone, "session10", clone.sim.s10Runs));
    }
    if (clone.status === "finished") {
      ({ bets, users } = settleMatchBets(bets, users, clone));
    }
    return clone;
  });

  if (!dirty) return prev;
  return { ...prev, matches, bets, users };
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [ready, setReady] = useState(false);
  // Client-side clock (0 during prerender) — current time must not be read
  // during render under Cache Components.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const apiFetchedRef = useRef(false);

  // Load (or seed) on mount, fast-forwarding the simulator for elapsed time.
  useEffect(() => {
    let initial: DemoState;
    let savedAt = 0;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { savedAt: number; data: DemoState };
        initial = parsed.data;
        // Backfill fields added after earlier saves (invites / settings).
        if (!Array.isArray(initial.invites)) initial.invites = [];
        if (!initial.settings || typeof initial.settings.welcomePoints !== "number") {
          initial.settings = { welcomePoints: WELCOME_POINTS };
        }
        savedAt = parsed.savedAt || 0;
      } else {
        initial = seedState();
      }
    } catch {
      initial = seedState();
    }
    if (savedAt > 0) {
      const ticks = Math.min(240, Math.floor((Date.now() - savedAt) / TICK_MS));
      for (let i = 0; i < ticks; i++) initial = tickState(initial);
    }
    setState(initial);
    setReady(true);
  }, []);

  // Persist on every change.
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data: state }));
    } catch {
      /* storage full / private mode — app still works in-memory */
    }
  }, [state]);

  // Simulator heartbeat.
  useEffect(() => {
    const t = setInterval(() => setState((s) => (s ? tickState(s) : s)), TICK_MS);
    return () => clearInterval(t);
  }, []);

  const refreshApiMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches", { cache: "no-store" });
      const json = (await res.json()) as { source: string; matches: Match[] };
      if (json.source !== "cricapi" || !Array.isArray(json.matches)) return;
      setState((s) => {
        if (!s) return s;
        let bets = s.bets;
        let users = s.users;
        const byId = new Map(s.matches.map((m) => [m.id, m]));
        for (const incoming of json.matches) {
          const existing = byId.get(incoming.id);
          if (!existing) {
            byId.set(incoming.id, incoming);
          } else if (existing.source === "cricapi") {
            const merged: Match = {
              ...existing,
              status: incoming.status,
              scoreText: incoming.scoreText ?? existing.scoreText,
              winner: incoming.winner ?? existing.winner,
            };
            byId.set(incoming.id, merged);
            if (merged.status === "finished" && existing.status !== "finished") {
              ({ bets, users } = settleMatchBets(bets, users, merged));
            }
          }
        }
        return { ...s, matches: [...byId.values()], bets, users };
      });
    } catch {
      /* offline etc. — demo feed keeps running */
    }
  }, []);

  useEffect(() => {
    if (ready && !apiFetchedRef.current) {
      apiFetchedRef.current = true;
      void refreshApiMatches();
    }
  }, [ready, refreshApiMatches]);

  const sessionUser: StoredUser | null = useMemo(() => {
    if (!state?.sessionUserId) return null;
    return state.users.find((u) => u.id === state.sessionUserId) ?? null;
  }, [state]);

  const publicUser = useCallback((u: StoredUser): User => {
    const { passHash: _ph, ...rest } = u;
    void _ph;
    return rest;
  }, []);

  const value: AppContextValue = useMemo(() => {
    const users: User[] = state ? state.users.map(publicUser) : [];
    const myPlays = state && sessionUser ? state.casinoPlays.filter((p) => p.userId === sessionUser.id) : [];

    const leaderboard: LeaderboardEntry[] = [
      ...users.map((u) => ({ name: u.name, balance: u.balance, isYou: sessionUser?.id === u.id })),
      ...LEADERBOARD_BOTS,
    ].sort((a, b) => b.balance - a.balance);

    const weekAgo = nowMs - 7 * 86400000;
    const pnlByUser = new Map<string, number>();
    for (const b of state?.bets ?? []) {
      if ((b.status === "won" || b.status === "lost") && b.settledAt && b.settledAt >= weekAgo && b.pnl) {
        pnlByUser.set(b.userId, (pnlByUser.get(b.userId) ?? 0) + b.pnl);
      }
    }
    const nameOf = (id: string) => users.find((u) => u.id === id)?.name ?? "Player";
    const weeklyWinners = [...pnlByUser.entries()]
      .map(([id, pnl]) => ({ name: nameOf(id), pnl }))
      .filter((x) => x.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);

    return {
      ready,
      demoMode: true,
      user: sessionUser ? publicUser(sessionUser) : null,
      users,
      bets: state?.bets ?? [],
      matches: state?.matches ?? [],
      casinoPlays: myPlays,
      leaderboard,
      weeklyWinners,
      isAdmin: Boolean(sessionUser?.isAdmin),

      invites: state?.invites ?? [],
      welcomePoints: state?.settings.welcomePoints ?? WELCOME_POINTS,

      checkInvite: async (code) => {
        if (!state || !code.trim()) return false;
        return inviteUsable(state.invites, code) !== null;
      },

      signup: async (name, email, password, inviteCode) => {
        if (!state) return { ok: false, error: "Loading…" };
        const em = email.trim().toLowerCase();
        if (!name.trim()) return { ok: false, error: "Please enter your name." };
        if (!/^\S+@\S+\.\S+$/.test(em)) return { ok: false, error: "Please enter a valid email." };
        if (password.length < 4) return { ok: false, error: "Password must be at least 4 characters." };
        if (state.users.some((u) => u.email === em)) return { ok: false, error: "An account with this email already exists." };
        // Invite-only registration: a valid, unused, unrevoked invite is required.
        if (!inviteCode || !inviteCode.trim())
          return { ok: false, error: "Registration is invite-only. Please use an invite link or enter an invite code." };
        const invite = inviteUsable(state.invites, inviteCode);
        if (!invite)
          return { ok: false, error: "This invite is invalid, already used, or has been revoked. Ask an admin for a fresh invite link." };
        const nu: StoredUser = {
          id: uid(),
          name: name.trim(),
          email: em,
          passHash: hashPw(password),
          // The single global welcome-points setting — same for every invite.
          balance: state.settings.welcomePoints,
          createdAt: Date.now(),
        };
        setState((s) =>
          s
            ? {
                ...s,
                users: [...s.users, nu],
                sessionUserId: nu.id,
                invites: s.invites.map((i) =>
                  i.id === invite.id
                    ? { ...i, usedByName: nu.name, usedByEmail: nu.email, usedAt: Date.now() }
                    : i
                ),
              }
            : s
        );
        return { ok: true };
      },

      login: async (email, password) => {
        if (!state) return { ok: false, error: "Loading…" };
        const em = email.trim().toLowerCase();
        const found = state.users.find((u) => u.email === em);
        if (!found || found.passHash !== hashPw(password)) return { ok: false, error: "Invalid email or password." };
        setState((s) => (s ? { ...s, sessionUserId: found.id } : s));
        return { ok: true };
      },

      logout: () => setState((s) => (s ? { ...s, sessionUserId: null } : s)),

      claimBonus: () => {
        if (!sessionUser) return { ok: false, error: "Login first." };
        if (sessionUser.lastBonusDate === todayKey()) return { ok: false, error: "Daily bonus already claimed today." };
        setState((s) =>
          s
            ? {
                ...s,
                users: s.users.map((u) =>
                  u.id === sessionUser.id ? { ...u, balance: round2(u.balance + DAILY_BONUS), lastBonusDate: todayKey() } : u
                ),
              }
            : s
        );
        return { ok: true };
      },

      placeBet: (matchId, market, selection, side, stake) => {
        if (!state || !sessionUser) return { ok: false, error: "Login to place a prediction." };
        const match = state.matches.find((m) => m.id === matchId);
        if (!match) return { ok: false, error: "Match not found." };
        if (match.status === "finished") return { ok: false, error: "Match is finished." };
        if (match.marketsSuspended || (match.sim && match.sim.suspendedUntil > Date.now()))
          return { ok: false, error: "Market suspended — try again in a few seconds." };
        if (market !== "match" && !match.sim)
          return { ok: false, error: "Session markets are available on Demo Feed matches." };
        if (market === "session6" && match.sim?.s6Runs !== undefined)
          return { ok: false, error: "6-over session already settled." };
        if (market === "session10" && match.sim?.s10Runs !== undefined)
          return { ok: false, error: "10-over session already settled." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum stake is ${MIN_BET} points.` };
        const odds = currentOddsFor(match, market, selection, side);
        const reserve = betReserve(side, odds, stake);
        if (sessionUser.balance < reserve)
          return {
            ok: false,
            error:
              side === "lay"
                ? `Not enough points — this lay needs ${reserve} points of liability cover.`
                : "Not enough points for this stake.",
          };
        const bet: Bet = {
          id: uid(),
          userId: sessionUser.id,
          matchId,
          matchLabel: `${match.teamA} vs ${match.teamB}`,
          market,
          selection,
          side,
          odds,
          stake,
          liability: reserve,
          status: "pending",
          createdAt: Date.now(),
        };
        setState((s) =>
          s
            ? {
                ...s,
                bets: [bet, ...s.bets],
                users: s.users.map((u) => (u.id === sessionUser.id ? { ...u, balance: round2(u.balance - reserve) } : u)),
              }
            : s
        );
        return { ok: true };
      },

      cancelBet: (betId) => {
        if (!sessionUser) return;
        setState((s) => {
          if (!s) return s;
          const bet = s.bets.find((b) => b.id === betId && b.userId === sessionUser.id && b.status === "pending");
          if (!bet) return s;
          const match = s.matches.find((m) => m.id === bet.matchId);
          if (match?.status === "finished") return s;
          return {
            ...s,
            bets: s.bets.map((b) => (b.id === betId ? { ...b, status: "cancelled" as const, pnl: 0 } : b)),
            users: s.users.map((u) => (u.id === sessionUser.id ? { ...u, balance: round2(u.balance + bet.liability) } : u)),
          };
        });
      },

      playCoin: (choice, stake) => {
        if (!sessionUser) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (sessionUser.balance < stake) return { ok: false, error: "Not enough points." };
        const outcome = randomInt(2) === 0 ? ("heads" as const) : ("tails" as const);
        const win = outcome === choice;
        const payout = win ? round2(stake * COIN_PAYOUT) : 0;
        const play: CasinoPlay = {
          id: uid(),
          userId: sessionUser.id,
          game: "coin",
          stake,
          payout,
          detail: `Called ${choice}, coin landed ${outcome}`,
          createdAt: Date.now(),
        };
        setState((s) =>
          s
            ? {
                ...s,
                casinoPlays: [play, ...s.casinoPlays].slice(0, 300),
                users: s.users.map((u) => (u.id === sessionUser.id ? { ...u, balance: round2(u.balance - stake + payout) } : u)),
              }
            : s
        );
        return { ok: true, payout, coin: outcome, detail: play.detail };
      },

      playWheel: (stake) => {
        if (!sessionUser) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (sessionUser.balance < stake) return { ok: false, error: "Not enough points." };
        const segmentIndex = randomInt(WHEEL_SEGMENTS.length);
        const seg = WHEEL_SEGMENTS[segmentIndex];
        const payout = round2(stake * seg.mult);
        const play: CasinoPlay = {
          id: uid(),
          userId: sessionUser.id,
          game: "wheel",
          stake,
          payout,
          detail: `Wheel landed on ${seg.label}`,
          createdAt: Date.now(),
        };
        setState((s) =>
          s
            ? {
                ...s,
                casinoPlays: [play, ...s.casinoPlays].slice(0, 300),
                users: s.users.map((u) => (u.id === sessionUser.id ? { ...u, balance: round2(u.balance - stake + payout) } : u)),
              }
            : s
        );
        return { ok: true, payout, segmentIndex, segmentLabel: seg.label, multiplier: seg.mult, detail: play.detail };
      },

      playDice: (choice: DiceChoice, stake) => {
        if (!sessionUser) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (sessionUser.balance < stake) return { ok: false, error: "Not enough points." };
        const d1 = rollDie();
        const d2 = rollDie();
        const sum = d1 + d2;
        const win = choice === "over" ? sum > 7 : choice === "under" ? sum < 7 : sum === 7;
        const payout = win ? round2(stake * DICE_PAYOUTS[choice]) : 0;
        const play: CasinoPlay = {
          id: uid(),
          userId: sessionUser.id,
          game: "dice",
          stake,
          payout,
          detail: `Rolled ${d1} + ${d2} = ${sum} (picked ${choice})`,
          createdAt: Date.now(),
        };
        setState((s) =>
          s
            ? {
                ...s,
                casinoPlays: [play, ...s.casinoPlays].slice(0, 300),
                users: s.users.map((u) => (u.id === sessionUser.id ? { ...u, balance: round2(u.balance - stake + payout) } : u)),
              }
            : s
        );
        return { ok: true, payout, d1, d2, detail: play.detail };
      },

      adminCreateInvite: async () => {
        if (!sessionUser?.isAdmin) return { ok: false, error: "Admins only." };
        const invite: Invite = { id: uid(), code: generateInviteCode(), createdAt: Date.now(), revoked: false };
        setState((s) => (s ? { ...s, invites: [invite, ...s.invites] } : s));
        return { ok: true, code: invite.code };
      },

      adminRevokeInvite: (inviteId) => {
        setState((s) =>
          s
            ? {
                ...s,
                invites: s.invites.map((i) => (i.id === inviteId && !i.usedAt ? { ...i, revoked: true } : i)),
              }
            : s
        );
      },

      adminSetWelcomePoints: (points) => {
        if (!sessionUser?.isAdmin) return { ok: false, error: "Admins only." };
        if (!Number.isFinite(points) || points < 0 || points > 1000000)
          return { ok: false, error: "Enter a points amount between 0 and 1,000,000." };
        setState((s) => (s ? { ...s, settings: { welcomePoints: Math.floor(points) } } : s));
        return { ok: true };
      },

      adminAddMatch: (input) => {
        const m: Match = {
          id: uid(),
          source: "manual",
          teamA: input.teamA,
          teamB: input.teamB,
          series: input.series || "Friendly",
          format: input.format,
          status: "upcoming",
          startTime: Date.now() + 3600000,
          winner: null,
          marketsSuspended: false,
          session6Line: 44.5,
          session10Line: 82.5,
        };
        setState((s) => (s ? { ...s, matches: [m, ...s.matches] } : s));
      },

      adminToggleSuspend: (matchId) => {
        setState((s) =>
          s ? { ...s, matches: s.matches.map((m) => (m.id === matchId ? { ...m, marketsSuspended: !m.marketsSuspended } : m)) } : s
        );
      },

      adminStartMatch: (matchId) => {
        setState((s) =>
          s
            ? {
                ...s,
                matches: s.matches.map((m) =>
                  m.id === matchId && m.status === "upcoming" ? { ...m, status: "live" as const, startTime: Date.now() } : m
                ),
              }
            : s
        );
      },

      adminSettle: (matchId, winner) => {
        setState((s) => {
          if (!s) return s;
          const match = s.matches.find((m) => m.id === matchId);
          if (!match) return s;
          const finishedMatch: Match = { ...match, status: "finished", winner };
          const { bets, users } = settleMatchBets(s.bets, s.users, finishedMatch);
          return { ...s, matches: s.matches.map((m) => (m.id === matchId ? finishedMatch : m)), bets, users };
        });
      },

      refreshApiMatches,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, ready, sessionUser, publicUser, refreshApiMatches, nowMs]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export type { ActionResult };
