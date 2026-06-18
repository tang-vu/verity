// Standalone signal feed for the deployed dashboard (Vercel) — serves the
// committed testnet snapshot, so no oracle server is required.
import snapshot from "../../../../data/oracle-snapshot.json";

export const dynamic = "force-static";

export async function GET() {
  return Response.json({ count: snapshot.signals.length, signals: snapshot.signals });
}
