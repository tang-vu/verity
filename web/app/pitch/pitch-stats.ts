/**
 * Live numbers the pitch deck renders. Fetched from /api/oracle/reputation at
 * open (same source as the dashboard); the fallback mirrors the committed
 * snapshot so the deck presents cleanly even fully offline.
 */
import { calibrationFromSignals } from "../lib/confidence-calibration";
import type { Signal } from "../lib/dashboard-data";

export interface PitchStats {
  accuracyPct: string; // "62.5"
  totalSignals: number;
  resolvedSignals: number;
  correctSignals: number;
  bondedDisplay: string; // "1,600"
  slashedDisplay: string; // "976"
  settledCount: number;
  revenueDisplay: string; // "0.80"
  live: boolean;
  /** How well the oracle's stated confidence has matched reality. */
  claimedPct: string; // "65"
  deliveredPct: string; // "63"
  brier: string; // "0.216"
  calibrationVerdict: string; // "CALIBRATED"
  haircutPct: number; // 2
}

export const FALLBACK_STATS: PitchStats = {
  accuracyPct: "57.1",
  totalSignals: 19,
  resolvedSignals: 14,
  correctSignals: 8,
  bondedDisplay: "819.2",
  slashedDisplay: "1,756.8",
  settledCount: 12,
  revenueDisplay: "1.20",
  live: false,
  claimedPct: "63",
  deliveredPct: "57",
  brier: "0.243",
  calibrationVerdict: "OVERCONFIDENT",
  haircutPct: 6,
};

interface RepApiResponse {
  reputation: {
    accuracyBps: number;
    totalSignals: number;
    resolvedSignals: number;
    correctSignals: number;
  };
  stake: { bondedBaseUnits: number; slashedBaseUnits: number; decimals: number } | null;
  revenue: { settledCount: number; totalBaseUnits: number; decimals: number } | null;
  source: string;
}

function baseUnitsToDisplay(units: number, decimals: number): string {
  return (units / 10 ** decimals).toLocaleString("en-US");
}

export async function fetchPitchStats(): Promise<PitchStats> {
  const res = await fetch("/api/oracle/reputation", { cache: "no-store" });
  if (!res.ok) throw new Error(`reputation API ${res.status}`);
  const j = (await res.json()) as RepApiResponse;

  // Calibration needs the per-signal rows (stated confidence + outcome), which
  // the reputation endpoint does not carry. A failure here must not cost the
  // deck its other live numbers, so it degrades to the committed figures.
  const calibration = await fetchCalibration().catch(() => null);

  return {
    accuracyPct: (j.reputation.accuracyBps / 100).toFixed(1),
    totalSignals: j.reputation.totalSignals,
    resolvedSignals: j.reputation.resolvedSignals,
    correctSignals: j.reputation.correctSignals,
    bondedDisplay: j.stake
      ? baseUnitsToDisplay(j.stake.bondedBaseUnits, j.stake.decimals)
      : FALLBACK_STATS.bondedDisplay,
    slashedDisplay: j.stake
      ? baseUnitsToDisplay(j.stake.slashedBaseUnits, j.stake.decimals)
      : FALLBACK_STATS.slashedDisplay,
    settledCount: j.revenue?.settledCount ?? FALLBACK_STATS.settledCount,
    revenueDisplay: j.revenue
      ? (j.revenue.totalBaseUnits / 10 ** j.revenue.decimals).toFixed(2)
      : FALLBACK_STATS.revenueDisplay,
    live: j.source === "live",
    ...(calibration ?? {
      claimedPct: FALLBACK_STATS.claimedPct,
      deliveredPct: FALLBACK_STATS.deliveredPct,
      brier: FALLBACK_STATS.brier,
      calibrationVerdict: FALLBACK_STATS.calibrationVerdict,
      haircutPct: FALLBACK_STATS.haircutPct,
    }),
  };
}

/** Grade the oracle's stated confidence from the same rows the dashboard shows. */
async function fetchCalibration() {
  const res = await fetch("/api/oracle/signals", { cache: "no-store" });
  if (!res.ok) throw new Error(`signals API ${res.status}`);
  const { signals } = (await res.json()) as { signals: Signal[] };
  const cal = calibrationFromSignals(signals);
  if (cal.resolved === 0) throw new Error("nothing resolved yet");
  return {
    claimedPct: (cal.meanConfidence * 100).toFixed(0),
    deliveredPct: (cal.hitRate * 100).toFixed(0),
    brier: cal.brier.toFixed(3),
    calibrationVerdict: cal.verdict,
    haircutPct: Math.round((1 - cal.reliabilityFactor) * 100),
  };
}
