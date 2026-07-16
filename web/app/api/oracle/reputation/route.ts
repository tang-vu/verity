// Oracle reputation + bonded collateral + live x402 revenue, reconstructed
// from Casper testnet via the public explorer API (snapshot fallback).
import { getOracleState } from "../../../lib/live-oracle-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getOracleState();
  return Response.json({
    reputation: state.reputation,
    stake: state.stake,
    x402: state.x402,
    revenue: state.revenue,
    contract: state.contract,
    explorer: state.explorer,
    source: state.source,
    generatedAt: state.generatedAt,
  });
}
