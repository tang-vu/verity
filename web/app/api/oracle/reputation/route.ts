// Oracle reputation for the deployed dashboard — served from the testnet snapshot.
import snapshot from "../../../../data/oracle-snapshot.json";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({
    reputation: snapshot.reputation,
    contract: snapshot.contract,
    explorer: snapshot.explorer,
  });
}
