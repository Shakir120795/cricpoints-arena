// Crypto-grade randomness for casino games.
// Uses Web Crypto (crypto.getRandomValues) with rejection sampling so results
// are unbiased and NOT manipulable by the house — outcomes are genuinely random.

export function randomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    let x = 0;
    do {
      crypto.getRandomValues(arr);
      x = arr[0];
    } while (x >= limit);
    return x % maxExclusive;
  }
  // Fallback (non-secure contexts only) — still uniform.
  return Math.floor(Math.random() * maxExclusive);
}

/** Roll one six-sided die using crypto randomness. */
export function rollDie(): number {
  return 1 + randomInt(6);
}
