/**
 * Server side of the x402 flow for the Vercel paywall route: local EIP-712
 * signature verification (casper-js-sdk) + verify/settle against the hosted
 * CSPR.cloud facilitator. Without a CSPR_CLOUD_ACCESS_TOKEN the paywall still
 * enforces a cryptographically valid payment and reports "verified-deferred".
 */
import casperSdk from "casper-js-sdk";
import { FACILITATOR_URL } from "./verity-public-config";
import {
  buildTransferDigest,
  type PaymentPayload,
  type PaymentRequirements,
} from "./x402-protocol";

// casper-js-sdk ships as a CJS webpack bundle: default-import + destructure
// (named ESM imports fail at runtime).
const { PublicKey } = casperSdk as unknown as typeof import("casper-js-sdk");

export interface PaywallOutcome {
  mode: "settled" | "verified-deferred";
  settled: boolean;
  settlementTx?: string;
  payer?: string;
  /** Why settlement was deferred (absent when settled). */
  deferredReason?: "not_configured" | "facilitator_error";
}

interface FacilitatorVerifyResponse {
  isValid: boolean;
  payer?: string;
  invalidReason?: string;
  invalidMessage?: string;
}

interface FacilitatorSettleResponse {
  success: boolean;
  transaction?: string;
  payer?: string;
  errorReason?: string;
  errorMessage?: string;
}

/** Cryptographic proof the payer authorized this exact transfer. */
export function verifyPaymentLocally(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): { ok: boolean; payer?: string } {
  try {
    const digest = buildTransferDigest(requirements, payload.payload.authorization);
    const pub = PublicKey.fromHex(payload.payload.publicKey);
    const sig = Uint8Array.from(Buffer.from(payload.payload.signature, "hex"));
    return { ok: pub.verifySignature(digest, sig), payer: payload.payload.authorization.from };
  } catch {
    return { ok: false };
  }
}

/** Request body shape the CSPR.cloud facilitator expects on /verify + /settle. */
function facilitatorBody(payload: PaymentPayload, req: PaymentRequirements) {
  return {
    paymentPayload: {
      x402Version: payload.x402Version,
      resource: { url: req.resource, description: req.description ?? null, mimeType: req.mimeType ?? null },
      accepted: {
        scheme: req.scheme,
        network: req.network,
        asset: req.asset,
        amount: req.amount,
        payTo: req.payTo,
        maxTimeoutSeconds: req.maxTimeoutSeconds,
        extra: req.extra,
      },
      payload: payload.payload,
    },
    paymentRequirements: req,
  };
}

async function facilitatorPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${FACILITATOR_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

/**
 * Full paywall decision for a locally-verified payment: settle on-chain via
 * the facilitator when configured, otherwise accept as verified-deferred.
 */
export async function settleOrDefer(
  payload: PaymentPayload,
  requirements: PaymentRequirements,
  localPayer?: string
): Promise<PaywallOutcome> {
  const token = process.env.CSPR_CLOUD_ACCESS_TOKEN;
  if (!token) {
    return { mode: "verified-deferred", settled: false, payer: localPayer, deferredReason: "not_configured" };
  }
  const deferred: PaywallOutcome = {
    mode: "verified-deferred",
    settled: false,
    payer: localPayer,
    deferredReason: "facilitator_error",
  };

  try {
    const body = facilitatorBody(payload, requirements);
    const verify = await facilitatorPost<FacilitatorVerifyResponse>("/verify", body, token);
    if (!verify.isValid) {
      console.error(`[x402] facilitator verify rejected: ${verify.invalidReason} — ${verify.invalidMessage}`);
      return deferred;
    }
    const settle = await facilitatorPost<FacilitatorSettleResponse>("/settle", body, token);
    if (!settle.success) {
      console.error(`[x402] facilitator settle failed: ${settle.errorReason} — ${settle.errorMessage}`);
      return deferred;
    }
    return { mode: "settled", settled: true, settlementTx: settle.transaction, payer: settle.payer ?? localPayer };
  } catch (err) {
    console.error(`[x402] facilitator unreachable: ${err instanceof Error ? err.message : err}`);
    return deferred;
  }
}
