"use client";

import Link from "next/link";
import { useState } from "react";
import type { BetSide, MarketType, Match } from "@/lib/types";
import { useApp } from "@/lib/store";
import { currentOddsFor, round2 } from "@/lib/odds";
import { betReserve } from "@/lib/settle";
import { MIN_BET } from "@/lib/casino";

export interface SlipSelection {
  market: MarketType;
  selection: string;
  side: BetSide;
}

export function marketLabel(market: MarketType): string {
  if (market === "match") return "Match Odds";
  if (market === "session6") return "Session · First 6 Overs";
  return "Session · First 10 Overs";
}

export default function BetSlip({
  match,
  sel,
  onClose,
}: {
  match: Match;
  sel: SlipSelection;
  onClose: () => void;
}) {
  const { user, placeBet } = useApp();
  const [stakeStr, setStakeStr] = useState("100");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const odds = currentOddsFor(match, sel.market, sel.selection, sel.side);
  const stake = Math.max(0, Math.floor(Number(stakeStr) || 0));
  const reserve = betReserve(sel.side, odds, stake);
  const profitIfWin = sel.side === "back" ? round2(stake * (odds - 1)) : stake;
  const totalReturn = sel.side === "back" ? round2(stake * odds) : round2(reserve + stake);

  const isBack = sel.side === "back";

  const confirm = () => {
    const r = placeBet(match.id, sel.market, sel.selection, sel.side, stake);
    setMsg(
      r.ok
        ? { ok: true, text: "Prediction placed! Check My Bets for status." }
        : { ok: false, text: r.error ?? "Could not place." }
    );
  };

  return (
    <div className="rounded-xl border border-amber-400/40 bg-[#12161d] p-4 shadow-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-zinc-400">{marketLabel(sel.market)}</div>
          <div className="font-bold text-[15px]">
            <span className={isBack ? "text-sky-300" : "text-pink-300"}>{isBack ? "BACK (Lagai)" : "LAY (Khai)"}</span>{" "}
            · {sel.selection}
          </div>
          <div className="text-xs text-zinc-400">
            {match.teamA} vs {match.teamB} — odds refresh live; the price locks when you confirm.
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-white text-lg leading-none px-1" aria-label="Close bet slip">
          ✕
        </button>
      </div>

      {!user ? (
        <div className="mt-3 text-sm">
          <Link href="/login" className="text-amber-300 font-semibold underline">
            Login
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="text-amber-300 font-semibold underline">
            sign up free
          </Link>{" "}
          to place predictions with virtual points.
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">Odds</span>
              <div className={`mt-1 rounded-lg px-3 py-2 font-extrabold text-lg ${isBack ? "bg-[#a9d7f8] text-[#0b3556]" : "bg-[#f6c3d5] text-[#571231]"}`}>
                {odds.toFixed(2)}
              </div>
            </label>
            <label className="block">
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">Stake (points)</span>
              <input
                type="number"
                min={MIN_BET}
                value={stakeStr}
                onChange={(e) => setStakeStr(e.target.value)}
                className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 font-bold text-lg outline-none focus:border-amber-400"
              />
            </label>
          </div>

          <div className="flex gap-2 mt-2">
            {[50, 100, 250, 500, 1000].map((v) => (
              <button
                key={v}
                onClick={() => setStakeStr(String(v))}
                className="text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1"
              >
                {v}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-1 text-sm">
            {isBack ? (
              <>
                <Row k="You risk" v={`${stake.toLocaleString()} pts`} />
                <Row k="Profit if you win" v={`+${profitIfWin.toLocaleString()} pts`} accent />
                <Row k="Total return if you win" v={`${totalReturn.toLocaleString()} pts`} />
              </>
            ) : (
              <>
                <Row k="Liability (reserved from balance)" v={`${reserve.toLocaleString()} pts`} />
                <Row k={`Profit if ${sel.selection} does NOT happen`} v={`+${profitIfWin.toLocaleString()} pts`} accent />
                <Row k="Total return if you win" v={`${totalReturn.toLocaleString()} pts`} />
              </>
            )}
            <Row k="Your balance" v={`${Math.floor(user.balance).toLocaleString()} pts`} />
          </div>

          {msg && (
            <div
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {msg.text}
            </div>
          )}

          <button
            onClick={confirm}
            className="mt-3 w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300 active:scale-[0.99] transition"
          >
            Confirm {isBack ? "Back" : "Lay"} — {stake.toLocaleString()} pts
          </button>
          <p className="mt-2 text-[11px] text-zinc-500">
            Virtual points only — no real money. You can cancel a pending prediction any time before the match ends.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-400">{k}</span>
      <span className={`font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>{v}</span>
    </div>
  );
}
