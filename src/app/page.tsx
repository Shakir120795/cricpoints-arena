"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";
import MatchCard from "@/components/MatchCard";

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight mb-3">
        <span>{icon}</span> {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const { matches, ready, user, welcomePoints } = useApp();

  if (!ready) {
    return <div className="py-24 text-center text-zinc-500">Loading matches…</div>;
  }

  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches
    .filter((m) => m.status === "upcoming")
    .sort((a, b) => a.startTime - b.startTime);
  const finished = matches.filter((m) => m.status === "finished");

  return (
    <div>
      {/* Hero */}
      <div className="mt-4 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#161a21] to-[#0b0e13] p-5 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Predict cricket. <span className="text-amber-400">Win points.</span> Top the board.
        </h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-xl">
          Exchange-style Back (Lagai) &amp; Lay (Khai) predictions with live odds, session markets and fair casino
          mini-games — all with <b className="text-zinc-200">virtual points</b>. No real money, ever.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5">🎁 {welcomePoints.toLocaleString()} free points on signup</span>
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5">⚡ Live odds engine</span>
          <span className="rounded-full bg-white/5 border border-white/10 px-3 py-1.5">🎲 Fair random casino</span>
          {!user && (
            <Link href="/signup" className="rounded-full bg-amber-400 text-black px-3 py-1.5 hover:bg-amber-300">
              Create free account →
            </Link>
          )}
        </div>
      </div>

      {live.length > 0 && (
        <Section title={`Live Now (${live.length})`} icon="🔴">
          {live.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section title="Upcoming" icon="🗓️">
          {upcoming.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </Section>
      )}

      {finished.length > 0 && (
        <Section title="Results" icon="🏁">
          {finished.map((m) => (
            <MatchCard key={m.id} match={m} />
          ))}
        </Section>
      )}

      {matches.length === 0 && (
        <div className="mt-10 text-center text-zinc-500">
          No matches available right now. Please check back soon.
        </div>
      )}
    </div>
  );
}
