"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { COIN_PAYOUT, DICE_PAYOUTS, MIN_BET, WHEEL_RTP, WHEEL_SEGMENTS } from "@/lib/casino";

const DIE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

function StakeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400">Bet (points)</span>
        <input
          type="number"
          min={MIN_BET}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 font-bold outline-none focus:border-amber-400"
        />
      </label>
      <div className="flex gap-1.5 mt-2">
        {[50, 100, 250, 500].map((v) => (
          <button
            key={v}
            onClick={() => onChange(String(v))}
            className="text-[11px] font-bold bg-white/10 hover:bg-white/20 rounded-full px-2.5 py-1"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

function GameCard({ title, icon, children, footnote }: { title: string; icon: string; children: React.ReactNode; footnote?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
      <h3 className="font-extrabold flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="mt-3">{children}</div>
      {footnote && <p className="mt-3 text-[11px] text-zinc-500">{footnote}</p>}
    </div>
  );
}

function ResultMsg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <div
      className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${
        msg.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
      }`}
    >
      {msg.text}
    </div>
  );
}

export default function CasinoPage() {
  const { user, playCoin, playWheel, playDice, casinoPlays } = useApp();

  const [coinStake, setCoinStake] = useState("100");
  const [coinChoice, setCoinChoice] = useState<"heads" | "tails">("heads");
  const [coinMsg, setCoinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [coinFace, setCoinFace] = useState<string>("🪙");

  const [wheelStake, setWheelStake] = useState("100");
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [wheelMsg, setWheelMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [diceStake, setDiceStake] = useState("100");
  const [diceChoice, setDiceChoice] = useState<"over" | "seven" | "under">("over");
  const [diceRoll, setDiceRoll] = useState<{ d1: number; d2: number } | null>(null);
  const [diceMsg, setDiceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const doCoin = () => {
    const r = playCoin(coinChoice, Math.floor(Number(coinStake) || 0));
    if (!r.ok) return setCoinMsg({ ok: false, text: r.error ?? "Could not play." });
    setCoinFace(r.coin === "heads" ? "👑" : "🦅");
    setCoinMsg({
      ok: (r.payout ?? 0) > 0,
      text: `Coin landed ${r.coin}. ${r.payout && r.payout > 0 ? `You won ${r.payout.toLocaleString()} pts!` : "No win this time."}`,
    });
  };

  const doWheel = () => {
    if (spinning) return;
    const r = playWheel(Math.floor(Number(wheelStake) || 0));
    if (!r.ok) return setWheelMsg({ ok: false, text: r.error ?? "Could not play." });
    const i = r.segmentIndex ?? 0;
    setSpinning(true);
    setWheelMsg(null);
    const target = -(i * 45 + 22.5);
    setRotation((prev) => {
      const cur = ((prev % 360) + 360) % 360;
      const want = ((target % 360) + 360) % 360;
      let delta = want - cur;
      if (delta <= 0) delta += 360;
      return prev + 360 * 5 + delta;
    });
    setTimeout(() => {
      setSpinning(false);
      setWheelMsg({
        ok: (r.payout ?? 0) > 0,
        text: `Wheel stopped on ${r.segmentLabel}. ${r.payout && r.payout > 0 ? `You won ${r.payout.toLocaleString()} pts!` : "No win this time."}`,
      });
    }, 3750);
  };

  const doDice = () => {
    const r = playDice(diceChoice, Math.floor(Number(diceStake) || 0));
    if (!r.ok) return setDiceMsg({ ok: false, text: r.error ?? "Could not play." });
    setDiceRoll({ d1: r.d1 ?? 1, d2: r.d2 ?? 1 });
    setDiceMsg({
      ok: (r.payout ?? 0) > 0,
      text: `${r.detail}. ${r.payout && r.payout > 0 ? `You won ${r.payout.toLocaleString()} pts!` : "No win this time."}`,
    });
  };

  const wheelGradient = `conic-gradient(${WHEEL_SEGMENTS.map(
    (s, i) => `${s.color} ${i * 45}deg ${(i + 1) * 45}deg`
  ).join(", ")})`;

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Casino</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Instant mini-games with <b className="text-zinc-200">cryptographically random</b> outcomes and published
            payout tables. Points only — no real money.
          </p>
        </div>
        {user && (
          <div className="bg-amber-400/10 border border-amber-400/30 rounded-full px-4 py-1.5 font-bold text-amber-300">
            {Math.floor(user.balance).toLocaleString()} PTS
          </div>
        )}
      </div>

      {!user && (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm">
          <Link href="/login" className="text-amber-300 font-bold underline">
            Login
          </Link>{" "}
          or{" "}
          <Link href="/signup" className="text-amber-300 font-bold underline">
            sign up
          </Link>{" "}
          to play with your free virtual points.
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 mt-4 items-start">
        {/* Coin Flip */}
        <GameCard title="Coin Flip" icon="🪙" footnote={`Call it right and win ${COIN_PAYOUT}× your bet (true odds 2.0× — the 0.1 gap is the published house margin).`}>
          <div className="text-center text-6xl py-2">{coinFace}</div>
          <div className="grid grid-cols-2 gap-2">
            {(["heads", "tails"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCoinChoice(c)}
                className={`rounded-lg py-2 font-bold capitalize ${
                  coinChoice === c ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {c === "heads" ? "👑 Heads" : "🦅 Tails"}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <StakeInput value={coinStake} onChange={setCoinStake} />
          </div>
          <button onClick={doCoin} className="mt-3 w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300">
            Flip — {COIN_PAYOUT}× payout
          </button>
          <ResultMsg msg={coinMsg} />
        </GameCard>

        {/* Spin Wheel */}
        <GameCard title="Spin Wheel" icon="🎡" footnote={`8 equally likely segments. Published expected return: ${(WHEEL_RTP * 100).toFixed(0)}% of stake.`}>
          <div className="relative w-56 h-56 mx-auto">
            <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-amber-400 text-xl">▼</div>
            <div
              className="wheel-spin w-full h-full rounded-full border-4 border-amber-400/60 relative overflow-hidden"
              style={{ background: wheelGradient, transform: `rotate(${rotation}deg)` }}
            >
              {WHEEL_SEGMENTS.map((s, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 text-[12px] font-extrabold text-white drop-shadow"
                  style={{ transform: `translate(-50%,-50%) rotate(${i * 45 + 22.5}deg) translateY(-82px)` }}
                >
                  {s.label}
                </span>
              ))}
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#0b0e13] border border-amber-400/60 flex items-center justify-center text-lg">
                🎡
              </span>
            </div>
          </div>
          <div className="mt-3">
            <StakeInput value={wheelStake} onChange={setWheelStake} />
          </div>
          <button
            onClick={doWheel}
            disabled={spinning}
            className="mt-3 w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300 disabled:opacity-60"
          >
            {spinning ? "Spinning…" : "Spin the wheel"}
          </button>
          <ResultMsg msg={wheelMsg} />
        </GameCard>

        {/* Dice */}
        <GameCard title="Dice Over / Under" icon="🎲" footnote="Two fair dice (totals 2–12). Payouts = true odds × 0.95, published below.">
          <div className="flex justify-center gap-3 py-2 text-6xl leading-none">
            <span>{diceRoll ? DIE_FACES[diceRoll.d1 - 1] : "🎲"}</span>
            <span>{diceRoll ? DIE_FACES[diceRoll.d2 - 1] : "🎲"}</span>
          </div>
          {diceRoll && (
            <div className="text-center font-bold text-zinc-300 -mt-1 mb-1">Total: {diceRoll.d1 + diceRoll.d2}</div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { k: "under", label: "Under 7", pay: DICE_PAYOUTS.under },
                { k: "seven", label: "Exactly 7", pay: DICE_PAYOUTS.seven },
                { k: "over", label: "Over 7", pay: DICE_PAYOUTS.over },
              ] as const
            ).map((o) => (
              <button
                key={o.k}
                onClick={() => setDiceChoice(o.k)}
                className={`rounded-lg py-2 font-bold text-[13px] ${
                  diceChoice === o.k ? "bg-amber-400 text-black" : "bg-white/10 hover:bg-white/20"
                }`}
              >
                {o.label}
                <span className="block text-[10px] font-semibold opacity-80">{o.pay}× payout</span>
              </button>
            ))}
          </div>
          <div className="mt-3">
            <StakeInput value={diceStake} onChange={setDiceStake} />
          </div>
          <button onClick={doDice} className="mt-3 w-full rounded-lg bg-amber-400 text-black font-extrabold py-2.5 hover:bg-amber-300">
            Roll the dice
          </button>
          <ResultMsg msg={diceMsg} />
        </GameCard>
      </div>

      {/* Recent results + published tables */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4 items-start">
        <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
          <h3 className="font-extrabold">Your recent results</h3>
          {casinoPlays.length === 0 ? (
            <p className="text-sm text-zinc-500 mt-2">No games played yet.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {casinoPlays.slice(0, 12).map((p) => {
                const net = p.payout - p.stake;
                return (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span>{p.game === "coin" ? "🪙" : p.game === "wheel" ? "🎡" : "🎲"}</span>
                    <span className="flex-1 truncate text-zinc-300">{p.detail}</span>
                    <span className="text-zinc-500 text-xs">bet {p.stake.toLocaleString()}</span>
                    <span className={`font-extrabold ${net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                      {net >= 0 ? "+" : ""}
                      {net.toLocaleString()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-[#10141b] p-4">
          <h3 className="font-extrabold">📋 Published payout tables (fair play promise)</h3>
          <div className="mt-2 space-y-3 text-sm text-zinc-300">
            <div>
              <b className="text-zinc-100">Coin Flip:</b> win pays <b>1.90×</b> (true probability 50%, fair price 2.0×).
            </div>
            <div>
              <b className="text-zinc-100">Spin Wheel:</b> segments{" "}
              {WHEEL_SEGMENTS.map((s) => s.label).join(" · ")} — each 1/8 likely. Expected return{" "}
              <b>{(WHEEL_RTP * 100).toFixed(0)}%</b>.
            </div>
            <div>
              <b className="text-zinc-100">Dice:</b> Under 7 → 15/36 chance, pays <b>{DICE_PAYOUTS.under}×</b>; Exactly 7
              → 6/36, pays <b>{DICE_PAYOUTS.seven}×</b>; Over 7 → 15/36, pays <b>{DICE_PAYOUTS.over}×</b>. (True odds ×
              0.95.)
            </div>
            <p className="text-[12px] text-zinc-500">
              All outcomes are generated with cryptographic randomness (Web Crypto) in your browser / our servers —
              they cannot be predicted or manipulated, by us or anyone else.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
