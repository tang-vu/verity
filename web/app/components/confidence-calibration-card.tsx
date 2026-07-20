/**
 * Grading the oracle's certainty, not just its direction.
 *
 * Accuracy already answers "was the call right?". This card answers the question
 * the consumer's position size actually depends on: when this oracle says 90%,
 * does 90% happen? Stated confidence is the one sizing input the oracle writes
 * itself, so leaving it ungraded would make "always claim 95%" a free way to
 * move more of a buyer's capital. The haircut shown here is what the consumer
 * applies before sizing — computed from the same on-chain rows in the table
 * below, so anyone can recheck it.
 */
import { calibrationFromSignals } from "../lib/confidence-calibration";
import type { Signal } from "../lib/dashboard-data";

/** Each line completes the sentence "Over N graded calls this oracle …". */
const VERDICT_COPY: Record<string, { badge: string; line: string }> = {
  OVERCONFIDENT: {
    badge: "wrong",
    line: "claimed more certainty than it delivered — so the consumer sizes it down.",
  },
  CALIBRATED: {
    badge: "ok",
    line: "has meant what it said — no haircut applied.",
  },
  UNDERCONFIDENT: {
    badge: "ok",
    line: "delivered better than it claimed. Sizing is never raised above the stated claim.",
  },
  UNPROVEN: {
    badge: "",
    line: "has not resolved enough calls to grade its confidence yet.",
  },
};

export function ConfidenceCalibrationCard({
  signals,
  loading,
}: {
  signals: Signal[];
  loading: boolean;
}) {
  const cal = calibrationFromSignals(signals);
  const copy = VERDICT_COPY[cal.verdict] ?? VERDICT_COPY.UNPROVEN;
  const haircutPct = Math.round((1 - cal.reliabilityFactor) * 100);

  if (loading && signals.length === 0) {
    return (
      <div className="panel">
        <p className="klabel">is its confidence honest?</p>
        <div className="sub"><span className="skeleton">grading stated confidence…</span></div>
      </div>
    );
  }

  return (
    <div className="panel">
      <p className="klabel">is its confidence honest?</p>

      <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--gold)" }}>
        {(cal.meanConfidence * 100).toFixed(0)}%
        <span className="sub" style={{ fontSize: 14, marginLeft: 6 }}>claimed</span>
        <span style={{ fontSize: 20, margin: "0 8px", opacity: 0.5 }}>→</span>
        {(cal.hitRate * 100).toFixed(0)}%
        <span className="sub" style={{ fontSize: 14, marginLeft: 6 }}>delivered</span>
      </div>

      <div className="row" style={{ marginTop: 12, gap: 6 }}>
        <span className={`badge ${copy.badge}`}>{cal.verdict.toLowerCase()}</span>
        <span className="badge">Brier {cal.brier.toFixed(3)}</span>
        <span className="badge">{cal.resolved} resolved</span>
      </div>

      <div className="sub" style={{ marginTop: 10 }}>
        Over {cal.resolved} graded calls this oracle {copy.line}
      </div>

      <div className="sub" style={{ marginTop: 10 }}>
        {haircutPct > 0 ? (
          <>
            The consumer agent multiplies every stated confidence by{" "}
            <b>{cal.reliabilityFactor.toFixed(2)}</b> before sizing — a{" "}
            <b>{haircutPct}% haircut</b>. Inflating confidence shrinks the capital this
            oracle can move, so the claim is no longer free.
          </>
        ) : (
          <>
            No haircut: stated confidence is taken at face value because the track record
            backs it. Overstating it would cut into future position sizing.
          </>
        )}
      </div>
    </div>
  );
}
