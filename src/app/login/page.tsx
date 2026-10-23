"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/store";

export default function LoginPage() {
  const { login, demoMode, welcomePoints } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await login(email, password);
    setBusy(false);
    if (r.ok) router.push("/");
    else setError(r.error ?? "Login failed.");
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
        <h1 className="text-xl font-extrabold">Welcome back</h1>
        <p className="text-sm text-zinc-400 mt-1">Login to your CricPoints Arena account.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-amber-400"
              placeholder="you@example.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-amber-400"
              placeholder="••••••••"
            />
          </label>
          {error && <div className="rounded-lg bg-red-500/15 text-red-300 text-sm font-semibold px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300 disabled:opacity-60"
          >
            {busy ? "Logging in…" : "Login"}
          </button>
        </form>
        <p className="text-sm text-zinc-400 mt-4">
          New here?{" "}
          <Link href="/signup" className="text-amber-300 font-semibold underline">
            Create an account with an invite
          </Link>{" "}
          — registration is invite-only, with {welcomePoints.toLocaleString()} welcome points.
        </p>
        {demoMode && (
          <div className="mt-4 rounded-lg bg-sky-500/10 border border-sky-400/25 px-3 py-2 text-[13px] text-sky-200">
            <b>Demo accounts</b> (this browser only):
            <br />Player — player@cricpoints.demo / demo123
            <br />Admin — admin@cricpoints.demo / admin123
          </div>
        )}
      </div>
    </div>
  );
}
