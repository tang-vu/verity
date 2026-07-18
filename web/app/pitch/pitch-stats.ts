/**
 * Live numbers the pitch deck renders. Fetched from /api/oracle/reputation at
 * open (same source as the dashboard); the fallback mirrors the committed
 * snapshot so the deck presents cleanly even fully offline.
 */

export interface PitchStats {
  accuracyPct: string; // "83.3"
  totalSignals: number;
  resolvedSignals: number;
  correctSignals: number;
  bondedDisplay: string; // "1,600"
  slashedDisplay: string; // "400"
  settledCount: number;
  revenueDisplay: string; // "0.80"
  live: boolean;
}

export const FALLBACK_STATS: PitchStats = {
  accuracyPct: "83.3",
  totalSignals: 11,
  resolvedSignals: 6,
  correctSignals: 5,
  bondedDisplay: "1,600",
  slashedDisplay: "400",
  settledCount: 8,
  revenueDisplay: "0.80",
  live: false,
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
  };
}
