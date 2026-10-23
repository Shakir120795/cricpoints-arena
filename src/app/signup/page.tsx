"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useApp } from "@/lib/store";

function SignupForm() {
  const { signup, checkInvite, welcomePoints } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [inviteState, setInviteState] = useState<"empty" | "checking" | "valid" | "invalid">("empty");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Prefill from an invite link (?invite=CODE).
  useEffect(() => {
    const fromLink = searchParams.get("invite");
    if (fromLink) setInviteCode(fromLink.toUpperCase());
  }, [searchParams]);

  // Live-check the code as it changes.
  useEffect(() => {
    const code = inviteCode.trim();
    if (!code) {
      setInviteState("empty");
      return;
    }
    setInviteState("checking");
    let cancelled = false;
    const t = setTimeout(() => {
      void checkInvite(code).then((ok) => {
        if (!cancelled) setInviteState(ok ? "valid" : "invalid");
      });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [inviteCode, checkInvite]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await signup(name, email, password, inviteCode);
    setBusy(false);
    if (r.ok) router.push("/");
    else setError(r.error ?? "Signup failed.");
  };

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="rounded-2xl border border-white/10 bg-[#10141b] p-6">
        <h1 className="text-xl font-extrabold">Create your account</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Registration is <b className="text-zinc-200">invite-only</b>. Every new account starts with{" "}
          <b className="text-amber-300">{welcomePoints.toLocaleString()} virtual points</b> — the same standard
          amount for everyone. Points are free play money: no deposits, no withdrawals, no cash value.
        </p>

        {inviteState === "empty" && (
          <div className="mt-4 rounded-lg bg-amber-400/10 border border-amber-400/30 px-3 py-2 text-[13px] text-amber-200">
            🔒 You need an invite to register. Open an invite link from an admin, or paste your invite code below.
          </div>
        )}
        {inviteState === "checking" && (
          <div className="mt-4 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[13px] text-zinc-300">
            Checking invite…
          </div>
        )}
        {inviteState === "valid" && (
          <div className="mt-4 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2 text-[13px] text-emerald-200">
            ✅ Invite accepted! Create your account below — {welcomePoints.toLocaleString()} welcome points included.
          </div>
        )}
        {inviteState === "invalid" && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-400/30 px-3 py-2 text-[13px] text-red-200">
            This invite is invalid, already used, or has been revoked. Ask an admin for a fresh invite link.
          </div>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">Invite code</span>
            <input
              type="text"
              required
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-amber-400 font-mono tracking-wider"
              placeholder="CPA-XXXXX-XXXXX"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">Display name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2.5 outline-none focus:border-amber-400"
              placeholder="e.g. CoverDriveKing"
            />
          </label>
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
              placeholder="Min. 4 characters"
            />
          </label>
          {error && <div className="rounded-lg bg-red-500/15 text-red-300 text-sm font-semibold px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={busy || inviteState !== "valid"}
            className="w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? "Creating…" : `Sign up — get ${welcomePoints.toLocaleString()} points`}
          </button>
          {inviteState !== "valid" && (
            <p className="text-[12px] text-zinc-500 text-center">A valid invite code is required to enable signup.</p>
          )}
        </form>
        <p className="text-sm text-zinc-400 mt-4">
          Already playing?{" "}
          <Link href="/login" className="text-amber-300 font-semibold underline">
            Login
          </Link>
        </p>
        <p className="text-[11px] text-zinc-500 mt-3">18+. Entertainment only. Virtual points have no cash value.</p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-zinc-500">Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}
