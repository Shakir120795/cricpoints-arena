"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { DAILY_BONUS, todayKey } from "@/lib/context";

const NAV = [
  { href: "/", label: "Matches" },
  { href: "/bets", label: "My Bets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/casino", label: "Casino" },
];

export default function Header() {
  const { user, demoMode, isAdmin, logout, claimBonus } = useApp();
  const pathname = usePathname();
  const [msg, setMsg] = useState<string | null>(null);
  // Today's date key, resolved on the client (never during prerender).
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(todayKey());
  }, []);

  const bonusClaimed = today !== "" && user?.lastBonusDate === today;

  const onBonus = () => {
    const r = claimBonus();
    setMsg(r.ok ? `+${DAILY_BONUS} bonus points claimed!` : r.error ?? "Could not claim");
    setTimeout(() => setMsg(null), 3500);
  };

  return (
    <header className="sticky top-0 z-40">
      {/* Gold ticker */}
      <div className="bg-amber-400 text-black overflow-hidden">
        <div className="marquee-track py-1 text-[11px] font-semibold tracking-wide">
          {[0, 1].map((i) => (
            <span key={i} className="px-4">
              🏏 CRICPOINTS ARENA — VIRTUAL POINTS ONLY • NO REAL MONEY • POINTS HAVE NO CASH VALUE • CANNOT BE
              WITHDRAWN OR TRANSFERRED • FAIR RANDOM CASINO GAMES — PAYOUT TABLES PUBLISHED • ENTERTAINMENT ONLY • 18+
              &nbsp;•&nbsp; 🏏 CRICPOINTS ARENA — VIRTUAL POINTS ONLY • NO REAL MONEY •&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-[#0b0e13]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4">
          <div className="flex items-center gap-3 h-14">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="text-xl">🏏</span>
              <span className="font-extrabold tracking-tight text-[17px]">
                Cric<span className="text-amber-400">Points</span> Arena
              </span>
            </Link>

            {demoMode && (
              <span className="hidden sm:inline-block text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-400/30 rounded-full px-2 py-0.5">
                DEMO MODE
              </span>
            )}

            <nav className="hidden md:flex items-center gap-1 ml-4">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    pathname === n.href ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  {n.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                    pathname === "/admin" ? "bg-amber-400 text-black" : "text-zinc-300 hover:bg-white/10"
                  }`}
                >
                  Admin
                </Link>
              )}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {user ? (
                <>
                  <button
                    onClick={onBonus}
                    disabled={bonusClaimed}
                    className={`hidden sm:block text-xs font-bold rounded-full px-3 py-1.5 transition ${
                      bonusClaimed
                        ? "bg-white/5 text-zinc-500 cursor-default"
                        : "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/25"
                    }`}
                    title="Daily bonus"
                  >
                    🎁 {bonusClaimed ? "Claimed" : `+${DAILY_BONUS}`}
                  </button>
                  <div className="bg-amber-400/10 border border-amber-400/30 rounded-full px-3 py-1.5 text-sm font-bold text-amber-300">
                    {Math.floor(user.balance).toLocaleString()} <span className="text-[10px] font-semibold">PTS</span>
                  </div>
                  <span className="hidden lg:block text-sm text-zinc-300 max-w-[110px] truncate">{user.name}</span>
                  <button
                    onClick={logout}
                    className="text-xs font-semibold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-semibold bg-white/10 hover:bg-white/20 rounded-full px-4 py-1.5">
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="text-sm font-bold bg-amber-400 text-black hover:bg-amber-300 rounded-full px-4 py-1.5"
                  >
                    Sign up free
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="md:hidden flex gap-1 pb-2 overflow-x-auto">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap ${
                  pathname === n.href ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"
                }`}
              >
                {n.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap ${
                  pathname === "/admin" ? "bg-amber-400 text-black" : "bg-white/5 text-zinc-300"
                }`}
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
      </div>

      {msg && (
        <div className="bg-emerald-500 text-black text-center text-sm font-semibold py-1.5 px-3">{msg}</div>
      )}
    </header>
  );
}
