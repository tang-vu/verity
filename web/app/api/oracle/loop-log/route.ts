// Autonomous-loop log for the deployed dashboard — served from the testnet snapshot.
import snapshot from "../../../../data/oracle-snapshot.json";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({ count: snapshot.loopLog.length, entries: snapshot.loopLog });
}
