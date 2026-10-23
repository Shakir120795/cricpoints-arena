"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";

export default function AdminPage() {
  const {
    ready, user, isAdmin, users, matches, invites, welcomePoints,
    adminAddMatch, adminToggleSuspend, adminStartMatch, adminSettle,
    adminCreateInvite, adminRevokeInvite, adminSetWelcomePoints,
  } = useApp();
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [series, setSeries] = useState("");
  const [format, setFormat] = useState<"T20" | "ODI">("T20");
  const [msg, setMsg] = useState<string | null>(null);
  const [wpInput, setWpInput] = useState("");
  const [wpMsg, setWpMsg] = useState<string | null>(null);
  const [newCode, setNewCode] = useState<string | null>(null);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  useEffect(() => {
    setWpInput(String(welcomePoints));
  }, [welcomePoints]);

  const inviteLink = (code: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/signup?invite=${code}` : `/signup?invite=${code}`;

  const copyText = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setInviteMsg(okMsg);
    } catch {
      setInviteMsg(text);
    }
    setTimeout(() => setInviteMsg(null), 3000);
  };

  const generateInvite = async () => {
    const r = await adminCreateInvite();
    if (r.ok && r.code) {
      setNewCode(r.code);
      setInviteMsg("Invite created — copy the link below and share it.");
    } else {
      setInviteMsg(r.error ?? "Could not create invite.");
    }
    setTimeout(() => setInviteMsg(null), 4000);
  };

  const saveWelcomePoints = () => {
    const r = adminSetWelcomePoints(Math.floor(Number(wpInput) || 0));
    setWpMsg(r.ok ? "Saved — applies to all future signups." : r.error ?? "Could not save.");
    setTimeout(() => setWpMsg(null), 3500);
  };

  if (!ready) return <div className="py-24 text-center text-zinc-500">Loading…</div>;

  if (!user || !isAdmin) {
    return (
      <div className="py-24 text-center">
        <p className="text-zinc-400">This area is for site admins only.</p>
        {!user && (
          <Link href="/login" className="inline-block mt-3 rounded-full bg-amber-400 text-black font-bold px-5 py-2">
            Login
          </Link>
        )}
      </div>
    );
  }

  const addMatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamA.trim() || !teamB.trim()) return;
    adminAddMatch({ teamA: teamA.trim(), teamB: teamB.trim(), series: series.trim() || "Friendly Series", format });
    setTeamA("");
    setTeamB("");
    setSeries("");
    setMsg("Match added (upcoming). Start it from the match list below or its match page.");
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="mt-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin — Content Manager</h1>
      <p className="text-sm text-zinc-400 mt-1 max-w-2xl">
        This admin is intentionally <b className="text-zinc-200">content-only</b>: manage matches, suspend/resume
        markets, settle results and view registered users. By design there are <b className="text-zinc-200">no</b>{" "}
        point-issuance, credit or bookie tools here — points come only from signup, the daily bonus, predictions and
        fair casino games.
      </p>

      {/* Platform settings — one global welcome-points amount */}
      <div className="mt-4 rounded-xl border border-white/10 bg-[#10141b] p-4">
        <h3 className="font-extrabold">Platform setting — welcome points</h3>
        <p className="text-[13px] text-zinc-400 mt-1">
          The single standard amount <b className="text-zinc-200">every</b> new account receives. It applies
          uniformly to all invites — welcome points are never set per invite or per person.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <input
            type="number"
            min={0}
            value={wpInput}
            onChange={(e) => setWpInput(e.target.value)}
            className="w-40 rounded-lg bg-black/40 border border-white/15 px-3 py-2 font-bold outline-none focus:border-amber-400"
          />
          <span className="text-sm text-zinc-400">points</span>
          <button
            onClick={saveWelcomePoints}
            className="rounded-lg bg-amber-400 text-black font-extrabold px-4 py-2 hover:bg-amber-300"
          >
            Save setting
          </button>
          {wpMsg && <span className="text-sm text-emerald-300 font-semibold">{wpMsg}</span>}
        </div>
      </div>

      {/* Invite links */}
      <div className="mt-4 rounded-xl border border-white/10 bg-[#10141b] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h3 className="font-extrabold">Invite links (registration is invite-only)</h3>
            <p className="text-[13px] text-zinc-400 mt-0.5">
              Each invite is <b className="text-zinc-200">single-use</b> and grants the standard welcome points
              above. Generate one per person you want to let in.
            </p>
          </div>
          <button
            onClick={generateInvite}
            className="ml-auto rounded-lg bg-amber-400 text-black font-extrabold px-4 py-2 hover:bg-amber-300"
          >
            + Generate invite link
          </button>
        </div>

        {inviteMsg && <div className="mt-2 text-sm text-emerald-300 font-semibold break-all">{inviteMsg}</div>}

        {newCode && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-400/30 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wider text-emerald-300 font-bold">New invite link</div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <code className="text-sm font-mono break-all">{inviteLink(newCode)}</code>
              <button
                onClick={() => copyText(inviteLink(newCode), "Invite link copied to clipboard.")}
                className="text-xs font-bold bg-emerald-400 text-black rounded-full px-3 py-1"
              >
                Copy link
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {invites.length === 0 && <p className="text-sm text-zinc-500">No invites yet — generate the first one above.</p>}
          {invites.map((inv) => {
            const status = inv.usedAt ? "used" : inv.revoked ? "revoked" : "unused";
            return (
              <div key={inv.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                <code className="font-mono font-bold">{inv.code}</code>
                <span
                  className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                    status === "unused"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : status === "used"
                        ? "bg-white/10 text-zinc-300"
                        : "bg-red-500/15 text-red-300"
                  }`}
                >
                  {status === "unused" && "UNUSED"}
                  {status === "used" && `USED${inv.usedByName ? ` — ${inv.usedByName}` : ""}`}
                  {status === "revoked" && "REVOKED"}
                </span>
                <span className="text-xs text-zinc-500">
                  Created {new Date(inv.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                  {inv.usedAt
                    ? ` • Used ${new Date(inv.usedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}${inv.usedByEmail ? ` (${inv.usedByEmail})` : ""}`
                    : ""}
                </span>
                {status === "unused" && (
                  <span className="ml-auto flex gap-2">
                    <button
                      onClick={() => copyText(inviteLink(inv.code), "Invite link copied to clipboard.")}
                      className="text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1"
                    >
                      Copy link
                    </button>
                    <button
                      onClick={() => adminRevokeInvite(inv.id)}
                      className="text-xs font-bold bg-red-500/15 text-red-300 hover:bg-red-500/25 rounded-full px-3 py-1"
                    >
                      Revoke
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add match */}
      <form onSubmit={addMatch} className="mt-4 rounded-xl border border-white/10 bg-[#10141b] p-4">
        <h3 className="font-extrabold">Add a manual match</h3>
        <div className="grid sm:grid-cols-4 gap-3 mt-3">
          <input
            value={teamA}
            onChange={(e) => setTeamA(e.target.value)}
            placeholder="Team A (e.g. India)"
            className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 outline-none focus:border-amber-400"
          />
          <input
            value={teamB}
            onChange={(e) => setTeamB(e.target.value)}
            placeholder="Team B (e.g. Australia)"
            className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 outline-none focus:border-amber-400"
          />
          <input
            value={series}
            onChange={(e) => setSeries(e.target.value)}
            placeholder="Series name"
            className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 outline-none focus:border-amber-400"
          />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as "T20" | "ODI")}
            className="rounded-lg bg-black/40 border border-white/15 px-3 py-2 outline-none focus:border-amber-400"
          >
            <option value="T20">T20</option>
            <option value="ODI">ODI</option>
          </select>
        </div>
        <button type="submit" className="mt-3 rounded-lg bg-amber-400 text-black font-extrabold px-5 py-2 hover:bg-amber-300">
          Add match
        </button>
        {msg && <span className="ml-3 text-sm text-emerald-300 font-semibold">{msg}</span>}
      </form>

      {/* Manage matches */}
      <h2 className="mt-6 font-extrabold">Manage matches ({matches.length})</h2>
      <div className="mt-2 space-y-2.5">
        {matches.map((m) => (
          <div key={m.id} className="rounded-xl border border-white/10 bg-[#10141b] p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/match/${m.id}`} className="font-bold hover:text-amber-300">
                {m.teamA} vs {m.teamB}
              </Link>
              <span className="text-xs text-zinc-500">
                {m.series} • {m.source}
              </span>
              <span
                className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${
                  m.status === "live"
                    ? "bg-red-500/15 text-red-300"
                    : m.status === "finished"
                      ? "bg-white/10 text-zinc-300"
                      : "bg-sky-500/15 text-sky-300"
                }`}
              >
                {m.status.toUpperCase()}
              </span>
              {m.marketsSuspended && (
                <span className="text-[11px] font-bold rounded-full px-2 py-0.5 bg-red-500/15 text-red-300">SUSPENDED</span>
              )}
              {m.status === "finished" && (
                <span className="text-xs text-amber-300 font-semibold">
                  Winner: {m.winner ?? "Tie"}
                </span>
              )}
            </div>
            {m.scoreText && <div className="text-[13px] text-zinc-400 mt-1">{m.scoreText}</div>}
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                onClick={() => adminToggleSuspend(m.id)}
                className="text-xs font-bold bg-white/10 hover:bg-white/20 rounded-full px-3 py-1.5"
              >
                {m.marketsSuspended ? "Resume market" : "Suspend market"}
              </button>
              {m.status === "upcoming" && (
                <button
                  onClick={() => adminStartMatch(m.id)}
                  className="text-xs font-bold bg-emerald-500/20 text-emerald-200 rounded-full px-3 py-1.5"
                >
                  Start now
                </button>
              )}
              {m.status !== "finished" && (
                <>
                  <button
                    onClick={() => adminSettle(m.id, m.teamA)}
                    className="text-xs font-bold bg-amber-400/20 text-amber-200 rounded-full px-3 py-1.5"
                  >
                    Settle: {m.teamA} wins
                  </button>
                  <button
                    onClick={() => adminSettle(m.id, m.teamB)}
                    className="text-xs font-bold bg-amber-400/20 text-amber-200 rounded-full px-3 py-1.5"
                  >
                    Settle: {m.teamB} wins
                  </button>
                  <button
                    onClick={() => adminSettle(m.id, null)}
                    className="text-xs font-bold bg-white/10 rounded-full px-3 py-1.5"
                  >
                    Settle: Tie
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Users */}
      <h2 className="mt-6 font-extrabold">Registered users ({users.length})</h2>
      <div className="mt-2 rounded-xl border border-white/10 bg-[#10141b] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500 border-b border-white/10">
              <th className="px-4 py-2.5">Name</th>
              <th className="px-2 py-2.5">Email</th>
              <th className="px-2 py-2.5">Joined</th>
              <th className="px-4 py-2.5 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5">
                <td className="px-4 py-2.5 font-semibold">
                  {u.name}
                  {u.isAdmin && (
                    <span className="ml-2 text-[10px] font-bold bg-purple-500/20 text-purple-200 rounded-full px-2 py-0.5">ADMIN</span>
                  )}
                </td>
                <td className="px-2 py-2.5 text-zinc-400">{u.email}</td>
                <td className="px-2 py-2.5 text-zinc-400">
                  {new Date(u.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-amber-200">{Math.floor(u.balance).toLocaleString()} pts</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div className="p-5 text-center text-zinc-500 text-sm">No registered users yet.</div>}
      </div>
    </div>
  );
}
