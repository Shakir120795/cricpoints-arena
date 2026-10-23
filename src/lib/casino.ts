// Casino game definitions — FAIR games, points only.
// Every outcome is drawn from crypto-grade randomness (see lib/random.ts).
// Payout tables are published here and shown in the UI. The small gap between
// true odds and payout (e.g. coin flip pays 1.9x instead of 2.0x) is the
// standard, disclosed house margin — outcomes themselves are never rigged.

/** Coin Flip: call heads/tails correctly → stake × 1.9 returned. */
export const COIN_PAYOUT = 1.9;

export interface WheelSegment {
  label: string;
  mult: number;
  color: string;
}

/** Spin Wheel: 8 equally likely segments. Expected return = 90% (published). */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: "3x", mult: 3, color: "#f5c518" },
  { label: "0", mult: 0, color: "#262b33" },
  { label: "0.5x", mult: 0.5, color: "#3b82f6" },
  { label: "0", mult: 0, color: "#262b33" },
  { label: "2x", mult: 2, color: "#22c55e" },
  { label: "0", mult: 0, color: "#262b33" },
  { label: "1.2x", mult: 1.2, color: "#a855f7" },
  { label: "0.5x", mult: 0.5, color: "#3b82f6" },
];

export const WHEEL_RTP =
  WHEEL_SEGMENTS.reduce((s, x) => s + x.mult, 0) / WHEEL_SEGMENTS.length; // 0.90

/**
 * Dice Over/Under: two fair dice, total 2–12.
 * True probabilities: Over 7 → 15/36, Exactly 7 → 6/36, Under 7 → 15/36.
 * Payouts = (1 / true probability) × 0.95, published.
 */
export const DICE_PAYOUTS = {
  over: 2.28, // (36/15) × 0.95
  seven: 5.7, // (36/6) × 0.95
  under: 2.28, // (36/15) × 0.95
} as const;

export type DiceChoice = keyof typeof DICE_PAYOUTS;

export const MIN_BET = 10;
