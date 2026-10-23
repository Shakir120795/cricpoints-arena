"use client";

// SUPABASE MODE provider — active when NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY are set. Auth via Supabase Auth; profiles,
// bets and casino plays in Postgres (see supabase/schema.sql). Match data
// comes from the CricAPI route plus admin-created matches in the matches
// table. The ball-by-ball simulator feed is a demo-mode feature.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Bet, CasinoPlay, Invite, LeaderboardEntry, Match, User } from "./types";
import {
  AppContext,
  DAILY_BONUS,
  WELCOME_POINTS,
  todayKey,
  uid,
  type AppContextValue,
} from "./context";
import { currentOddsFor, round2 } from "./odds";
import { betOutcome, betReserve } from "./settle";
import { COIN_PAYOUT, DICE_PAYOUTS, MIN_BET, WHEEL_SEGMENTS, type DiceChoice } from "./casino";
import { randomInt, rollDie } from "./random";
import { isAdminEmail } from "./supabase";

/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToUser(r: any): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    balance: Number(r.balance),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    lastBonusDate: r.last_bonus_date ?? undefined,
    isAdmin: Boolean(r.is_admin) || isAdminEmail(r.email),
  };
}

function rowToBet(r: any): Bet {
  return {
    id: r.id,
    userId: r.user_id,
    matchId: r.match_id,
    matchLabel: r.match_label,
    market: r.market,
    selection: r.selection,
    side: r.side,
    odds: Number(r.odds),
    stake: Number(r.stake),
    liability: Number(r.liability),
    status: r.status,
    pnl: r.pnl === null || r.pnl === undefined ? undefined : Number(r.pnl),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    settledAt: r.settled_at ? new Date(r.settled_at).getTime() : undefined,
  };
}

function rowToPlay(r: any): CasinoPlay {
  return {
    id: r.id,
    userId: r.user_id,
    game: r.game,
    stake: Number(r.stake),
    payout: Number(r.payout),
    detail: r.detail,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

export function SupabaseProvider({ client, children }: { client: SupabaseClient; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [authId, setAuthId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [myBets, setMyBets] = useState<Bet[]>([]);
  const [myPlays, setMyPlays] = useState<CasinoPlay[]>([]);
  const [tableMatches, setTableMatches] = useState<Match[]>([]);
  const [apiMatches, setApiMatches] = useState<Match[]>([]);
  const [welcomePoints, setWelcomePointsState] = useState<number>(WELCOME_POINTS);
  const [invites, setInvites] = useState<Invite[]>([]);
  // Client-side clock (0 during prerender) — current time must not be read
  // during render under Cache Components.
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const settlingRef = useRef<Set<string>>(new Set());

  const user: User | null = useMemo(
    () => profiles.find((p) => p.id === authId) ?? null,
    [profiles, authId]
  );

  const loadProfiles = useCallback(async () => {
    const { data } = await client.from("profiles").select("*").order("balance", { ascending: false });
    if (data) setProfiles(data.map(rowToUser));
  }, [client]);

  const loadMine = useCallback(
    async (uidValue: string) => {
      const [{ data: bets }, { data: plays }] = await Promise.all([
        client.from("bets").select("*").eq("user_id", uidValue).order("created_at", { ascending: false }),
        client.from("casino_plays").select("*").eq("user_id", uidValue).order("created_at", { ascending: false }).limit(50),
      ]);
      if (bets) setMyBets(bets.map(rowToBet));
      if (plays) setMyPlays(plays.map(rowToPlay));
    },
    [client]
  );

  const loadMatches = useCallback(async () => {
    const { data } = await client.from("matches").select("payload");
    if (data) setTableMatches(data.map((r: any) => r.payload as Match));
  }, [client]);

  const loadSettings = useCallback(async () => {
    const { data } = await client
      .from("platform_settings")
      .select("value")
      .eq("key", "welcome_points")
      .maybeSingle();
    if (data) {
      const n = typeof data.value === "number" ? data.value : Number(data.value);
      if (Number.isFinite(n)) setWelcomePointsState(n);
    }
  }, [client]);

  const loadInvites = useCallback(async () => {
    const [{ data: inv }, { data: profs }] = await Promise.all([
      client.from("invites").select("*").order("created_at", { ascending: false }),
      client.from("profiles").select("id, name, email"),
    ]);
    if (!inv) return;
    const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
    setInvites(
      inv.map((r: any): Invite => {
        const u = r.used_by ? byId.get(r.used_by) : undefined;
        return {
          id: r.id,
          code: r.code,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          usedByName: u?.name,
          usedByEmail: u?.email,
          usedAt: r.used_at ? new Date(r.used_at).getTime() : undefined,
          revoked: Boolean(r.revoked),
        };
      })
    );
  }, [client]);

  // Settle all pending bets for a finished match, crediting profiles in DB.
  const settleInDb = useCallback(
    async (match: Match) => {
      if (settlingRef.current.has(match.id)) return;
      settlingRef.current.add(match.id);
      try {
        const { data: pending } = await client
          .from("bets")
          .select("*")
          .eq("match_id", match.id)
          .eq("status", "pending");
        if (!pending || pending.length === 0) return;
        for (const row of pending) {
          const bet = rowToBet(row);
          let won: boolean | null;
          if (bet.market === "match") {
            if (match.winner === null || match.winner === undefined) won = null;
            else {
              const selectionWon = bet.selection === match.winner;
              won = bet.side === "back" ? selectionWon : !selectionWon;
            }
          } else {
            won = null; // session markets need ball-by-ball state → refund in this mode
          }
          const o = betOutcome(bet, won);
          await client
            .from("bets")
            .update({ status: o.status, pnl: o.pnl, settled_at: new Date().toISOString() })
            .eq("id", bet.id);
          if (o.credit > 0) {
            const { data: prof } = await client.from("profiles").select("balance").eq("id", bet.userId).single();
            if (prof) {
              await client
                .from("profiles")
                .update({ balance: round2(Number(prof.balance) + o.credit) })
                .eq("id", bet.userId);
            }
          }
        }
        await loadProfiles();
        if (authId) await loadMine(authId);
      } finally {
        settlingRef.current.delete(match.id);
      }
    },
    [client, authId, loadProfiles, loadMine]
  );

  const refreshApiMatches = useCallback(async () => {
    try {
      const res = await fetch("/api/matches", { cache: "no-store" });
      const json = (await res.json()) as { source: string; matches: Match[] };
      if (json.source !== "cricapi" || !Array.isArray(json.matches)) return;
      setApiMatches(json.matches);
      for (const m of json.matches) {
        if (m.status === "finished") await settleInDb(m);
      }
    } catch {
      /* ignore */
    }
  }, [settleInDb]);

  // Auth session lifecycle.
  useEffect(() => {
    let mounted = true;
    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthId(data.session?.user.id ?? null);
      setReady(true);
    });
    const { data: sub } = client.auth.onAuthStateChange((_e, session) => {
      setAuthId(session?.user.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  // Initial + per-user data loading.
  useEffect(() => {
    if (!ready) return;
    void loadProfiles();
    void loadMatches();
    void loadSettings();
    void refreshApiMatches();
    if (authId) void loadMine(authId);
    else {
      setMyBets([]);
      setMyPlays([]);
    }
  }, [ready, authId, loadProfiles, loadMatches, loadSettings, loadMine, refreshApiMatches]);

  // Admins additionally load the invite list.
  useEffect(() => {
    if (user?.isAdmin) void loadInvites();
  }, [user?.isAdmin, loadInvites]);

  // Ensure a profile row exists for the signed-in user (welcome points).
  useEffect(() => {
    if (!ready || !authId) return;
    if (profiles.some((p) => p.id === authId)) return;
    void (async () => {
      const { data: authData } = await client.auth.getUser();
      const au = authData.user;
      if (!au) return;
      await client.from("profiles").upsert({
        id: au.id,
        name: (au.user_metadata?.name as string) || (au.email?.split("@")[0] ?? "Player"),
        email: au.email ?? "",
        balance: welcomePoints,
      });
      await loadProfiles();
    })();
  }, [ready, authId, profiles, client, loadProfiles, welcomePoints]);

  const matches = useMemo(() => {
    const byId = new Map<string, Match>();
    for (const m of tableMatches) byId.set(m.id, m);
    for (const m of apiMatches) if (!byId.has(m.id)) byId.set(m.id, m);
    return [...byId.values()];
  }, [tableMatches, apiMatches]);

  const setBalance = useCallback(
    async (userId: string, newBalance: number) => {
      setProfiles((ps) => ps.map((p) => (p.id === userId ? { ...p, balance: newBalance } : p)));
      await client.from("profiles").update({ balance: newBalance }).eq("id", userId);
    },
    [client]
  );

  const persistMatch = useCallback(
    async (m: Match) => {
      setTableMatches((ms) => {
        const idx = ms.findIndex((x) => x.id === m.id);
        if (idx >= 0) {
          const copy = [...ms];
          copy[idx] = m;
          return copy;
        }
        return [m, ...ms];
      });
      await client.from("matches").upsert({ id: m.id, payload: m, updated_at: new Date().toISOString() });
    },
    [client]
  );

  const value: AppContextValue = useMemo(() => {
    const leaderboard: LeaderboardEntry[] = profiles
      .map((p) => ({ name: p.name, balance: p.balance, isYou: p.id === authId }))
      .sort((a, b) => b.balance - a.balance);

    const weekAgo = nowMs - 7 * 86400000;
    const pnlByUser = new Map<string, number>();
    for (const b of myBets) {
      if ((b.status === "won" || b.status === "lost") && b.settledAt && b.settledAt >= weekAgo && b.pnl) {
        pnlByUser.set(b.userId, (pnlByUser.get(b.userId) ?? 0) + b.pnl);
      }
    }
    const weeklyWinners = [...pnlByUser.entries()]
      .map(([id, pnl]) => ({ name: profiles.find((p) => p.id === id)?.name ?? "Player", pnl }))
      .filter((x) => x.pnl > 0)
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 5);

    return {
      ready,
      demoMode: false,
      user,
      users: profiles,
      bets: myBets,
      matches,
      casinoPlays: myPlays,
      leaderboard,
      weeklyWinners,
      isAdmin: Boolean(user?.isAdmin),

      invites,
      welcomePoints,

      checkInvite: async (code) => {
        if (!code.trim()) return false;
        const { data, error } = await client.rpc("check_invite", {
          p_code: code.trim().toUpperCase(),
        });
        return !error && data === true;
      },

      signup: async (name, email, password, inviteCode) => {
        // Invite-only registration: validate first, redeem after account creation.
        if (!inviteCode || !inviteCode.trim())
          return { ok: false, error: "Registration is invite-only. Please use an invite link or enter an invite code." };
        const normalized = inviteCode.trim().toUpperCase();
        const { data: usable, error: checkError } = await client.rpc("check_invite", { p_code: normalized });
        if (checkError || usable !== true)
          return { ok: false, error: "This invite is invalid, already used, or has been revoked. Ask an admin for a fresh invite link." };
        const { data, error } = await client.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) return { ok: false, error: error.message };
        if (data.user) {
          await client.rpc("redeem_invite", { p_code: normalized, p_user: data.user.id });
          await client.from("profiles").upsert({
            id: data.user.id,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            balance: welcomePoints,
          });
          await loadProfiles();
          if (user?.isAdmin) await loadInvites();
        }
        return { ok: true };
      },

      login: async (email, password) => {
        const { error } = await client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      },

      logout: () => {
        void client.auth.signOut();
        setAuthId(null);
      },

      claimBonus: () => {
        if (!user) return { ok: false, error: "Login first." };
        if (user.lastBonusDate === todayKey()) return { ok: false, error: "Daily bonus already claimed today." };
        const newBalance = round2(user.balance + DAILY_BONUS);
        void (async () => {
          await client
            .from("profiles")
            .update({ balance: newBalance, last_bonus_date: todayKey() })
            .eq("id", user.id);
          await loadProfiles();
        })();
        setProfiles((ps) => ps.map((p) => (p.id === user.id ? { ...p, balance: newBalance, lastBonusDate: todayKey() } : p)));
        return { ok: true };
      },

      placeBet: (matchId, market, selection, side, stake) => {
        if (!user) return { ok: false, error: "Login to place a prediction." };
        const match = matches.find((m) => m.id === matchId);
        if (!match) return { ok: false, error: "Match not found." };
        if (match.status === "finished") return { ok: false, error: "Match is finished." };
        if (match.marketsSuspended) return { ok: false, error: "Market suspended." };
        if (market !== "match") return { ok: false, error: "Session markets are available on Demo Feed matches." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum stake is ${MIN_BET} points.` };
        const odds = currentOddsFor(match, market, selection, side);
        const reserve = betReserve(side, odds, stake);
        if (user.balance < reserve)
          return {
            ok: false,
            error: side === "lay" ? `Not enough points — this lay needs ${reserve} points of liability cover.` : "Not enough points for this stake.",
          };
        const bet: Bet = {
          id: uid(),
          userId: user.id,
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
        void (async () => {
          await client.from("bets").insert({
            id: bet.id,
            user_id: bet.userId,
            match_id: bet.matchId,
            match_label: bet.matchLabel,
            market: bet.market,
            selection: bet.selection,
            side: bet.side,
            odds: bet.odds,
            stake: bet.stake,
            liability: bet.liability,
            status: bet.status,
            created_at: new Date(bet.createdAt).toISOString(),
          });
          await setBalance(user.id, round2(user.balance - reserve));
          setMyBets((bs) => [bet, ...bs]);
        })();
        return { ok: true };
      },

      cancelBet: (betId) => {
        if (!user) return;
        const bet = myBets.find((b) => b.id === betId && b.status === "pending");
        if (!bet) return;
        const match = matches.find((m) => m.id === bet.matchId);
        if (match?.status === "finished") return;
        void (async () => {
          await client.from("bets").update({ status: "cancelled", pnl: 0 }).eq("id", betId);
          await setBalance(user.id, round2(user.balance + bet.liability));
          setMyBets((bs) => bs.map((b) => (b.id === betId ? { ...b, status: "cancelled" as const, pnl: 0 } : b)));
        })();
      },

      playCoin: (choice, stake) => {
        if (!user) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (user.balance < stake) return { ok: false, error: "Not enough points." };
        const outcome = randomInt(2) === 0 ? ("heads" as const) : ("tails" as const);
        const payout = outcome === choice ? round2(stake * COIN_PAYOUT) : 0;
        const play: CasinoPlay = {
          id: uid(),
          userId: user.id,
          game: "coin",
          stake,
          payout,
          detail: `Called ${choice}, coin landed ${outcome}`,
          createdAt: Date.now(),
        };
        void (async () => {
          await client.from("casino_plays").insert({
            id: play.id, user_id: play.userId, game: play.game, stake, payout, detail: play.detail,
            created_at: new Date(play.createdAt).toISOString(),
          });
          await setBalance(user.id, round2(user.balance - stake + payout));
          setMyPlays((ps) => [play, ...ps].slice(0, 50));
        })();
        return { ok: true, payout, coin: outcome, detail: play.detail };
      },

      playWheel: (stake) => {
        if (!user) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (user.balance < stake) return { ok: false, error: "Not enough points." };
        const segmentIndex = randomInt(WHEEL_SEGMENTS.length);
        const seg = WHEEL_SEGMENTS[segmentIndex];
        const payout = round2(stake * seg.mult);
        const play: CasinoPlay = {
          id: uid(), userId: user.id, game: "wheel", stake, payout,
          detail: `Wheel landed on ${seg.label}`, createdAt: Date.now(),
        };
        void (async () => {
          await client.from("casino_plays").insert({
            id: play.id, user_id: play.userId, game: play.game, stake, payout, detail: play.detail,
            created_at: new Date(play.createdAt).toISOString(),
          });
          await setBalance(user.id, round2(user.balance - stake + payout));
          setMyPlays((ps) => [play, ...ps].slice(0, 50));
        })();
        return { ok: true, payout, segmentIndex, segmentLabel: seg.label, multiplier: seg.mult, detail: play.detail };
      },

      playDice: (choice: DiceChoice, stake) => {
        if (!user) return { ok: false, error: "Login to play." };
        if (!(stake >= MIN_BET)) return { ok: false, error: `Minimum bet is ${MIN_BET} points.` };
        if (user.balance < stake) return { ok: false, error: "Not enough points." };
        const d1 = rollDie();
        const d2 = rollDie();
        const sum = d1 + d2;
        const win = choice === "over" ? sum > 7 : choice === "under" ? sum < 7 : sum === 7;
        const payout = win ? round2(stake * DICE_PAYOUTS[choice]) : 0;
        const play: CasinoPlay = {
          id: uid(), userId: user.id, game: "dice", stake, payout,
          detail: `Rolled ${d1} + ${d2} = ${sum} (picked ${choice})`, createdAt: Date.now(),
        };
        void (async () => {
          await client.from("casino_plays").insert({
            id: play.id, user_id: play.userId, game: play.game, stake, payout, detail: play.detail,
            created_at: new Date(play.createdAt).toISOString(),
          });
          await setBalance(user.id, round2(user.balance - stake + payout));
          setMyPlays((ps) => [play, ...ps].slice(0, 50));
        })();
        return { ok: true, payout, d1, d2, detail: play.detail };
      },

      adminCreateInvite: async () => {
        if (!user?.isAdmin) return { ok: false, error: "Admins only." };
        const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
        const part = (n: number) =>
          Array.from({ length: n }, () => alphabet[randomInt(alphabet.length)]).join("");
        const code = `CPA-${part(5)}-${part(5)}`;
        const { error } = await client.from("invites").insert({ id: uid(), code });
        if (error) return { ok: false, error: error.message };
        await loadInvites();
        return { ok: true, code };
      },

      adminRevokeInvite: (inviteId) => {
        void (async () => {
          await client.from("invites").update({ revoked: true }).eq("id", inviteId);
          setInvites((list) => list.map((i) => (i.id === inviteId && !i.usedAt ? { ...i, revoked: true } : i)));
        })();
      },

      adminSetWelcomePoints: (points) => {
        if (!user?.isAdmin) return { ok: false, error: "Admins only." };
        if (!Number.isFinite(points) || points < 0 || points > 1000000)
          return { ok: false, error: "Enter a points amount between 0 and 1,000,000." };
        const value = Math.floor(points);
        setWelcomePointsState(value);
        void client
          .from("platform_settings")
          .upsert({ key: "welcome_points", value }, { onConflict: "key" });
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
        void persistMatch(m);
      },

      adminToggleSuspend: (matchId) => {
        const m = matches.find((x) => x.id === matchId);
        if (m) void persistMatch({ ...m, marketsSuspended: !m.marketsSuspended });
      },

      adminStartMatch: (matchId) => {
        const m = matches.find((x) => x.id === matchId);
        if (m && m.status === "upcoming") void persistMatch({ ...m, status: "live", startTime: Date.now() });
      },

      adminSettle: (matchId, winner) => {
        const m = matches.find((x) => x.id === matchId);
        if (!m) return;
        const finished: Match = { ...m, status: "finished", winner };
        void (async () => {
          if (finished.source === "manual") await persistMatch(finished);
          else setApiMatches((ms) => ms.map((x) => (x.id === matchId ? finished : x)));
          await settleInDb(finished);
        })();
      },

      refreshApiMatches,
    };
  }, [
    ready, user, profiles, myBets, myPlays, matches, authId, client,
    loadProfiles, persistMatch, settleInDb, refreshApiMatches, setBalance,
    invites, welcomePoints, loadInvites, nowMs,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
