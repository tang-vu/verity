// Autonomous-loop decision log. The loop's reasoning is off-chain by nature
// (its txs ARE on-chain and linked); served from the committed testnet run.
import { getOracleState } from "../../../lib/live-oracle-state";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = await getOracleState();
  return Response.json({ count: state.loopLog.length, entries: state.loopLog });
}
