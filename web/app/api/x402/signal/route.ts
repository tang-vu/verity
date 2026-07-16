/**
 * The REAL x402 paywall, hosted on Vercel. Any agent (or judge with curl) can:
 *   1. GET this route            -> HTTP 402 + payment requirements (the challenge)
 *   2. Sign EIP-712 transfer_with_authorization, retry with `X-PAYMENT` header
 *   3. Paywall verifies the signature, the CSPR.cloud facilitator settles the
 *      CEP-18 payment on-chain -> 200 + the latest signal + settlement tx.
 * Mirrors oracle-agent/src/serve.ts /signal/latest, minus the local server.
 */
import { getOracleState } from "../../../lib/live-oracle-state";
import { txExplorerUrl } from "../../../lib/verity-public-config";
import {
  buildRequirements,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  X402_VERSION,
  type PaymentPayload,
} from "../../../lib/x402-protocol";
import { settleOrDefer, verifyPaymentLocally } from "../../../lib/x402-server-flow";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": `Content-Type, ${PAYMENT_HEADER}`,
  "Access-Control-Expose-Headers": PAYMENT_RESPONSE_HEADER,
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(req: Request) {
  const requirements = buildRequirements(new URL(req.url).origin + "/api/x402/signal");
  const challenge = { x402Version: X402_VERSION, accepts: [requirements] };
  const reject = (error: string) =>
    Response.json({ ...challenge, error }, { status: 402, headers: CORS });

  const headerVal = req.headers.get(PAYMENT_HEADER);
  if (!headerVal) return reject("payment required");

  let payload: PaymentPayload;
  try {
    payload = JSON.parse(Buffer.from(headerVal, "base64").toString("utf8")) as PaymentPayload;
  } catch {
    return reject("malformed X-PAYMENT header");
  }

  const local = verifyPaymentLocally(payload, requirements);
  if (!local.ok) return reject("invalid payment signature");

  const outcome = await settleOrDefer(payload, requirements, local.payer);

  const state = await getOracleState();
  const latest = state.signals[state.signals.length - 1];
  if (!latest) {
    return Response.json({ error: "no signals published yet" }, { status: 404, headers: CORS });
  }

  const responseInfo = outcome.settlementTx
    ? { success: true, transaction: outcome.settlementTx, network: requirements.network, payer: outcome.payer }
    : { success: true, mode: outcome.mode, payer: outcome.payer };

  return Response.json(
    {
      signal: latest,
      reputation: state.reputation,
      stake: state.stake,
      x402: {
        mode: outcome.mode,
        settlementTx: outcome.settlementTx ?? null,
        settlementExplorerUrl: outcome.settlementTx ? txExplorerUrl(outcome.settlementTx) : null,
        payer: outcome.payer ?? null,
      },
      note: "Weight your action by reputation.accuracyBps (0-10000); require a bonded stake before trusting.",
    },
    {
      headers: {
        ...CORS,
        [PAYMENT_RESPONSE_HEADER]: Buffer.from(JSON.stringify(responseInfo)).toString("base64"),
      },
    }
  );
}
