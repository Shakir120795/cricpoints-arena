// Ball-by-ball match simulator — the built-in DEMO FEED.
// Produces a realistic T20/ODI flow: runs, wickets, innings break, chase,
// session milestones (6-over and 10-over first-innings totals) and a winner.
// Clearly labelled "Demo Feed" in the UI wherever it is used.

import type { Match, SimState } from "./types";
import { randomInt } from "./random";
import { formatOvers, shortName } from "./odds";

export function createSimState(teamA: string, teamB: string): SimState {
  const batFirst = randomInt(2) === 0 ? teamA : teamB;
  return {
    innings: [{ batting: batFirst, runs: 0, wickets: 0, balls: 0 }],
    current: 0,
    lastEvent: `${batFirst} won the toss and chose to bat`,
    recentBalls: [],
    suspendedUntil: 0,
  };
}

export function createSimMatch(opts: {
  id: string;
  teamA: string;
  teamB: string;
  series: string;
  format: "T20" | "ODI";
  startTime: number;
  status: "upcoming" | "live";
}): Match {
  return {
    id: opts.id,
    source: "sim",
    teamA: opts.teamA,
    teamB: opts.teamB,
    series: opts.series,
    format: opts.format,
    status: opts.status,
    startTime: opts.startTime,
    winner: null,
    marketsSuspended: false,
    sim: createSimState(opts.teamA, opts.teamB),
    session6Line: 44.5,
    session10Line: 82.5,
  };
}

type Outcome = { runs: number; wicket: boolean; label: string };

// Weighted ball outcomes. Death overs / high required rate → more boundaries
// and more wickets, like real cricket.
function pickOutcome(aggressive: boolean): Outcome {
  const table: Array<[string, number]> = aggressive
    ? [["0", 24], ["1", 33], ["2", 8], ["4", 15], ["6", 10], ["W", 10]]
    : [["0", 30], ["1", 38], ["2", 8], ["4", 11], ["6", 6], ["W", 7]];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = randomInt(total);
  for (const [label, w] of table) {
    if (r < w) {
      if (label === "W") return { runs: 0, wicket: true, label: "W" };
      return { runs: parseInt(label, 10), wicket: false, label };
    }
    r -= w;
  }
  return { runs: 1, wicket: false, label: "1" };
}

export interface AdvanceResult {
  wicket: boolean;
  finished: boolean;
}

/** Advance a live sim match by one ball. Mutates the match (pass a clone). */
export function advanceBall(m: Match): AdvanceResult {
  const sim = m.sim;
  if (!sim || m.status !== "live") return { wicket: false, finished: false };
  const totalBalls = m.format === "ODI" ? 300 : 120;
  const inn = sim.innings[sim.current];

  const ballsLeft = totalBalls - inn.balls;
  let aggressive = ballsLeft <= totalBalls / 4;
  if (sim.current === 1 && sim.target !== undefined && ballsLeft > 0) {
    const reqRR = (sim.target - inn.runs) / (ballsLeft / 6);
    if (reqRR > 10) aggressive = true;
  }

  const o = pickOutcome(aggressive);
  inn.balls += 1;
  if (o.wicket) {
    inn.wickets += 1;
    sim.suspendedUntil = Date.now() + 2500; // market suspends briefly after a wicket
    sim.lastEvent = `WICKET! ${inn.batting} ${inn.runs}/${inn.wickets}`;
  } else {
    inn.runs += o.runs;
    sim.lastEvent =
      o.runs === 0 ? "Dot ball" : o.runs === 4 ? "FOUR!" : o.runs === 6 ? "SIX!" : `${o.runs} run${o.runs > 1 ? "s" : ""}`;
  }
  sim.recentBalls = [...sim.recentBalls.slice(-11), o.label];

  // Session milestones (first innings only).
  if (sim.current === 0) {
    if (inn.balls === 36 && sim.s6Runs === undefined) sim.s6Runs = inn.runs;
    if (inn.balls === 60 && sim.s10Runs === undefined) sim.s10Runs = inn.runs;
  }

  const inningsOver = inn.balls >= totalBalls || inn.wickets >= 10;
  const chaseDone = sim.current === 1 && sim.target !== undefined && inn.runs >= sim.target;

  let finished = false;
  if (chaseDone || inningsOver) {
    if (sim.current === 0) {
      // All-out / overs done before a milestone → session result is the final total.
      if (sim.s6Runs === undefined) sim.s6Runs = inn.runs;
      if (sim.s10Runs === undefined) sim.s10Runs = inn.runs;
      sim.target = inn.runs + 1;
      const other = inn.batting === m.teamA ? m.teamB : m.teamA;
      sim.innings.push({ batting: other, runs: 0, wickets: 0, balls: 0 });
      sim.current = 1;
      sim.lastEvent = `Innings break — ${other} need ${sim.target} to win`;
    } else {
      m.status = "finished";
      const first = sim.innings[0];
      m.winner = inn.runs > first.runs ? inn.batting : inn.runs < first.runs ? first.batting : null;
      sim.lastEvent = m.winner ? `${m.winner} won the match` : "Match tied";
      finished = true;
    }
  }

  m.scoreText = buildScoreText(m);
  return { wicket: o.wicket, finished };
}

export function buildScoreText(m: Match): string {
  if (!m.sim) return m.scoreText ?? "";
  const parts = m.sim.innings.map(
    (inn) => `${shortName(inn.batting)} ${inn.runs}/${inn.wickets} (${formatOvers(inn.balls)} ov)`
  );
  let txt = parts.join("  •  ");
  if (m.sim.current === 1 && m.sim.target) txt += `  •  Target ${m.sim.target}`;
  return txt;
}
