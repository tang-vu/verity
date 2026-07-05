/**
 * The novel mechanic: the consumer weights its DeFi action by the oracle's
 * ON-CHAIN reputation. A signal from a high-accuracy oracle moves more capital;
 * a low-reputation oracle is ignored entirely. This makes the oracle's word
 * worth exactly its verifiable track record — the trust-minimized machine economy.
 */
import { Direction, Reputation } from "@verity/shared";

export type ActionSide = "BUY" | "SELL" | "HOLD";

export interface ActionDecision {
  side: ActionSide;
  /** Notional to deploy in the asset's smallest unit (0 when HOLD). */
  notional: number;
  /** Fraction of max notional actually used (0..1), driven by reputation+confidence. */
  weight: number;
  reasonCode: string;
  rationale: string;
}

export interface DecisionInputs {
  direction: Direction;
  confidence: number; // 0..100
  reputation: Reputation;
  maxNotional: number; // asset smallest unit
  minReputationBps: number; // gate: below this -> HOLD
  /** Oracle's live bonded collateral (stake token base units), if known. */
  stakeBaseUnits?: number;
  /** Minimum bond the consumer requires before trusting the oracle at all. */
  minStakeBaseUnits?: number;
}

/**
 * Map (direction, confidence, on-chain accuracy) -> a concrete trade.
 *
 *   weight = (accuracyBps/10000) * (confidence/100)
 *
 * Reputation gates participation (below threshold => HOLD) and linearly scales
 * size, so an unproven or poor oracle simply cannot move much capital.
 */
export function decideAction(inputs: DecisionInputs): ActionDecision {
  const { direction, confidence, reputation, maxNotional, minReputationBps } = inputs;
  const accuracyBps = reputation.accuracyBps;

  // Collateral gate: a claim is only trustworthy if the oracle has real,
  // slashable capital behind it. An oracle bonded below the floor is ignored
  // outright — accuracy alone is not enough without skin in the game.
  if (
    inputs.minStakeBaseUnits !== undefined &&
    inputs.stakeBaseUnits !== undefined &&
    inputs.stakeBaseUnits < inputs.minStakeBaseUnits
  ) {
    return {
      side: "HOLD",
      notional: 0,
      weight: 0,
      reasonCode: "STAKE_BELOW_GATE",
      rationale: `oracle bond ${inputs.stakeBaseUnits} < required ${inputs.minStakeBaseUnits} base units — no collateral at risk, refusing to act`,
    };
  }

  if (accuracyBps < minReputationBps) {
    return {
      side: "HOLD",
      notional: 0,
      weight: 0,
      reasonCode: "REPUTATION_BELOW_GATE",
      rationale: `oracle accuracy ${(accuracyBps / 100).toFixed(1)}% < gate ${(
        minReputationBps / 100
      ).toFixed(1)}% — refusing to act`,
    };
  }

  if (direction === Direction.Flat) {
    return {
      side: "HOLD",
      notional: 0,
      weight: 0,
      reasonCode: "SIGNAL_FLAT",
      rationale: "signal is FLAT — no directional trade",
    };
  }

  const weight = (accuracyBps / 10_000) * (confidence / 100);
  const notional = Math.max(0, Math.round(maxNotional * weight));
  const side: ActionSide = direction === Direction.Up ? "BUY" : "SELL";

  return {
    side,
    notional,
    weight,
    reasonCode: "REPUTATION_WEIGHTED",
    rationale:
      `weight ${(weight * 100).toFixed(1)}% = accuracy ${(accuracyBps / 100).toFixed(1)}% ` +
      `× confidence ${confidence}% → ${side} ${notional} units`,
  };
}
