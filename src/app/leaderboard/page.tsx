"use client";

import { useApp } from "@/lib/store";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const { leaderboard, weeklyWinners, ready } = useApp();

  if (!ready) return <div className="py-24 text-center text-zinc-500">Loading…</div>;

  return (
    <div className="mt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Leaderboard</h1>
      <p className="text-sm text-zinc-400 mt-1">Ranked by virtual points balance. Points are play money — glory only!</p>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] mt-4 items-start">
        <div className="rounded-xl border border-white/10 bg-[#10141b] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
                <th className="px-4 py-2.5 w-14">Rank</th>
                <th className="px-2 py-2.5">Player</th>
                <th className="px-4 py-2.5 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.slice(0, 20).map((e, i) => (
                <tr key={i} className={`border-b border-white/5 ${e.isYou ? "bg-amber-400/10" : ""}`}>
                  <td className="px-4 py-2.5 font-bold">{MEDALS[i] ?? i + 1}</td>
                  <td className="px-2 py-2.5 font-semibold">
                    {e.name}
                    {e.isYou && <span className="ml-2 text-[10px] font-bold bg-amber-400 text-black rounded-full px-2 py-0.5">YOU</span>}
                    {e.isBot && <span className="ml-2 text-[10px] text-zinc-500">demo rival</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-extrabold text-amber-200">{Math.floor(e.balance).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {leaderboard.length === 0 && <div className="p-6 text-center text-zinc-500">No players yet — be the first!</div>}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
          <h3 className="font-extrabold">🔥 Biggest winners — last 7 days</h3>
          {weeklyWinners.length === 0 ? (
            <p className="text-sm text-zinc-500 mt-2">No settled predictions this week yet. Winners will show up here.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {weeklyWinners.map((w, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="font-semibold">{w.name}</span>
                  <span className="font-extrabold text-emerald-300">+{w.pnl.toLocaleString()} pts</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-zinc-500 mt-3">
            Tip: claim your daily +1,000 bonus from the top bar and protect your balance — lay bets reserve liability
            until the match settles.
          </p>
        </div>
      </div>
    </div>
  );
}
