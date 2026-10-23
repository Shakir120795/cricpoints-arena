"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import type { Bet } from "@/lib/types";
import { marketLabel } from "@/components/BetSlip";

function Chip({ status, pnl }: { status: string; pnl?: number }) {
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

function BetRow({ bet, onCancel, matchFinished }: { bet: Bet; onCancel?: () => void; matchFinished?: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#10141b] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${
            bet.side === "back" ? "bg-[#a9d7f8] text-[#0b3556]" : "bg-[#f6c3d5] text-[#571231]"
          }`}
        >
          {bet.side === "back" ? "BACK" : "LAY"}
        </span>
        <span className="font-bold">{bet.selection}</span>
        <span className="text-sm text-zinc-400">@ {bet.odds.toFixed(2)}</span>
        <span className="ml-auto">
          <Chip status={bet.status} pnl={bet.pnl} />
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] text-zinc-400">
        <Link href={`/match/${bet.matchId}`} className="hover:text-amber-300">
          {bet.matchLabel}
        </Link>
        <span>{marketLabel(bet.market)}</span>
        <span>Stake {bet.stake.toLocaleString()} pts</span>
        {bet.side === "lay" && <span>Liability {bet.liability.toLocaleString()} pts</span>}
        <span>{new Date(bet.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
      </div>
      {bet.status === "pending" && onCancel && !matchFinished && (
        <button onClick={onCancel} className="mt-2 text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5">
          Cancel prediction (refund {bet.liability.toLocaleString()} pts)
        </button>
      )}
    </div>
  );
}

export default function MyBetsPage() {
  const { user, bets, matches, ready, cancelBet } = useApp();

  if (!ready) return <div className="py-24 text-center text-zinc-500">Loading…</div>;
  if (!user) {
    return (
      <div className="py-24 text-center">
        <p className="text-zinc-400 mb-3">Login to see your predictions.</p>
        <Link href="/login" className="rounded-full bg-amber-400 text-black font-bold px-5 py-2">
          Login
        </Link>
      </div>
    );
  }

  const mine = bets.filter((b) => b.userId === user.id);
  const pending = mine.filter((b) => b.status === "pending");
  const settled = mine.filter((b) => b.status !== "pending");
  const exposure = pending.reduce((s, b) => s + b.liability, 0);
  const totalPnl = settled.reduce((s, b) => s + (b.pnl ?? 0), 0);
  const finishedIds = new Set(matches.filter((m) => m.status === "finished").map((m) => m.id));

  return (
    <div className="mt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">My Bets</h1>
      <div className="mt-3 grid grid-cols-3 gap-3 max-w-xl">
        <div className="rounded-xl border border-white/10 bg-[#10141b] p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Balance</div>
          <div className="font-extrabold text-amber-300">{Math.floor(user.balance).toLocaleString()} pts</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#10141b] p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">In play (reserved)</div>
          <div className="font-extrabold">{exposure.toLocaleString()} pts</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#10141b] p-3">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Settled P&amp;L</div>
          <div className={`font-extrabold ${totalPnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {totalPnl > 0 ? "+" : ""}
            {totalPnl.toLocaleString()} pts
          </div>
        </div>
      </div>

      <h2 className="mt-6 font-extrabold">Pending ({pending.length})</h2>
      <div className="mt-2 space-y-2.5">
        {pending.length === 0 && <p className="text-sm text-zinc-500">No pending predictions. Pick a match and tap a price!</p>}
        {pending.map((b) => (
          <BetRow key={b.id} bet={b} onCancel={() => cancelBet(b.id)} matchFinished={finishedIds.has(b.matchId)} />
        ))}
      </div>

      <h2 className="mt-6 font-extrabold">History ({settled.length})</h2>
      <div className="mt-2 space-y-2.5">
        {settled.length === 0 && <p className="text-sm text-zinc-500">Nothing settled yet.</p>}
        {settled.map((b) => (
          <BetRow key={b.id} bet={b} />
        ))}
      </div>
    </div>
  );
}
