/**
 * The novel mechanic: the consumer weights its DeFi action by the oracle's
 * ON-CHAIN reputation. A signal from a high-accuracy oracle moves more capital;
 * a low-reputation oracle is ignored entirely. This makes the oracle's word
 * worth exactly its verifiable track record — the trust-minimized machine economy.
 *
 * Two of the three sizing inputs are graded on-chain: accuracy is the contract's
 * own hit rate, and the bond is real slashable capital. The third — the
 * confidence stamped on the signal — is the oracle's own unaudited claim, and it
 * multiplies the position directly. Left alone it is a free lever: always claim
 * 95% and move more of the consumer's money at no cost, with the hit rate none
 * the wiser. So the consumer does not act on stated confidence; it acts on
 * confidence discounted by the oracle's measured calibration (see
 * `calibration.ts`), recomputed from the same on-chain history anyone can read.
 */
import {
  Calibration,
  Direction,
  Reputation,
  calibratedConfidence,
} from "@verity/shared";

export type ActionSide = "BUY" | "SELL" | "HOLD";

export interface ActionDecision {
  side: ActionSide;
  /** Notional to deploy in the asset's smallest unit (0 when HOLD). */
  notional: number;
  /** Fraction of max notional actually used (0..1), driven by reputation+confidence. */
  weight: number;
  reasonCode: string;
  rationale: string;
  /** Confidence actually used for sizing after the calibration haircut (0..100). */
  effectiveConfidence: number;
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
  /**
   * How well the oracle's past stated confidence matched its realised outcomes,
   * derived from on-chain history. Omitted = take the claim at face value.
   */
  calibration?: Calibration;
}

/**
 * Map (direction, confidence, on-chain accuracy) -> a concrete trade.
 *
 *   weight = (accuracyBps/10000) * (effectiveConfidence/100)
 *
 * where `effectiveConfidence` is the stated confidence after the calibration
 * haircut. Reputation gates participation (below threshold => HOLD) and linearly
 * scales size, so an unproven or poor oracle simply cannot move much capital —
 * and an oracle that overstates its certainty shrinks its own future sizing.
 */
export function decideAction(inputs: DecisionInputs): ActionDecision {
  const { direction, reputation, maxNotional, minReputationBps, calibration } = inputs;
  const accuracyBps = reputation.accuracyBps;

  // The claim is the oracle's; the discount is the chain's.
  const confidence = calibration
    ? calibratedConfidence(inputs.confidence, calibration)
    : inputs.confidence;

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
      effectiveConfidence: confidence,
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
      effectiveConfidence: confidence,
    };
  }

  if (direction === Direction.Flat) {
    return {
      side: "HOLD",
      notional: 0,
      weight: 0,
      reasonCode: "SIGNAL_FLAT",
      rationale: "signal is FLAT — no directional trade",
      effectiveConfidence: confidence,
    };
  }

  const weight = (accuracyBps / 10_000) * (confidence / 100);
  const notional = Math.max(0, Math.round(maxNotional * weight));
  const side: ActionSide = direction === Direction.Up ? "BUY" : "SELL";

  const haircut =
    calibration && confidence !== inputs.confidence
      ? ` (claimed ${inputs.confidence}%, ${calibration.verdict.toLowerCase()} on ` +
        `${calibration.resolved} resolved → discounted)`
      : "";

  return {
    side,
    notional,
    weight,
    reasonCode: "REPUTATION_WEIGHTED",
    rationale:
      `weight ${(weight * 100).toFixed(1)}% = accuracy ${(accuracyBps / 100).toFixed(1)}% ` +
      `× confidence ${confidence}%${haircut} → ${side} ${notional} units`,
    effectiveConfidence: confidence,
  };
}
