/**
 * The grading rule, in one place for the agent side: does a call count as
 * correct, and what hit rate does that imply. This is a mirror of the contract's
 * `reputation_math.rs` — the contract is what actually grades and slashes, so if
 * these two ever disagree the agents would report a reputation the chain does
 * not hold. Integer micro-USD math throughout, exactly like the Rust.
 *
 * (The dashboard carries its own copy of the same rule: it must stay free of
 * Node-only dependencies to build on Vercel. Change one, change all three.)
 */
import { Direction } from "./signal-types.js";

/** A FLAT call is right when the move stayed inside +/-0.50%. */
export const FLAT_BAND_BPS = 50;

/** Neutral score before anything has resolved — an unproven oracle, not a good one. */
export const NEUTRAL_ACCURACY_BPS = 5_000;

export function isCorrect(
  direction: Direction,
  priceAtPublishMicro: number,
  priceAtResolveMicro: number
): boolean {
  if (direction === Direction.Up) return priceAtResolveMicro > priceAtPublishMicro;
  if (direction === Direction.Down) return priceAtResolveMicro < priceAtPublishMicro;
  const delta = Math.abs(priceAtResolveMicro - priceAtPublishMicro);
  return delta * 10_000 <= priceAtPublishMicro * FLAT_BAND_BPS;
}

/** Cumulative hit rate in basis points; neutral while the book is empty. */
export function accuracyBps(correct: number, resolved: number): number {
  if (resolved <= 0) return NEUTRAL_ACCURACY_BPS;
  return Math.floor((correct * 10_000) / resolved);
}
