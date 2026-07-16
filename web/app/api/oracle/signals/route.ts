// Signal feed, reconstructed LIVE from Casper testnet on every request (30s
// cache) via the public explorer API — falls back to the committed snapshot.
import { getOracleState } from "../../../lib/live-oracle-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getOracleState();
  return Response.json({
    count: state.signals.length,
    signals: state.signals,
    source: state.source,
    generatedAt: state.generatedAt,
  });
}
