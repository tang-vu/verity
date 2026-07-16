/**
 * One-click LIVE x402 purchase for visitors: a server-held demo consumer agent
 * runs the real protocol against this deployment's own paywall —
 * 402 challenge -> EIP-712 signature -> X-PAYMENT retry -> facilitator
 * settlement on Casper testnet — and returns a step-by-step trace.
 * Rate-limited: it spends real (testnet) x402USD per click.
 */
import { buildPaymentPayload, loadDemoConsumerKey } from "../../../lib/x402-demo-consumer";
import {
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentRequirements,
} from "../../../lib/x402-protocol";

export const dynamic = "force-dynamic";

// Best-effort in-memory limits (per serverless instance): plenty for judges,
// useless for spammers who would drain the demo agent's testnet balance.
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const PER_IP_MAX = 6;
const GLOBAL_DAY_MAX = 60;
const ipHits = new Map<string, number[]>();
let dayKey = "";
let dayCount = 0;

function rateLimited(ip: string): string | null {
  const today = new Date().toISOString().slice(0, 10);
  if (dayKey !== today) { dayKey = today; dayCount = 0; }
  if (dayCount >= GLOBAL_DAY_MAX) return "daily demo budget reached — try the curl flow instead";
  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (hits.length >= PER_IP_MAX) return "rate limit: max 6 demo purchases per hour per visitor";
  hits.push(now);
  ipHits.set(ip, hits);
  dayCount += 1;
  return null;
}

interface Step { title: string; detail: string; data?: unknown }

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limited = rateLimited(ip);
  if (limited) return Response.json({ ok: false, error: limited }, { status: 429 });

  const signer = loadDemoConsumerKey();
  if (!signer) {
    return Response.json(
      { ok: false, error: "demo buyer not configured on this deployment — use the curl flow shown below" },
      { status: 503 }
    );
  }

  const paywallUrl = new URL(req.url).origin + "/api/x402/signal";
  const steps: Step[] = [];

  // 1. Probe the paid resource — the paywall answers HTTP 402 with the price.
  const probe = await fetch(paywallUrl, { cache: "no-store" });
  const challenge = (await probe.json()) as { accepts?: PaymentRequirements[] };
  const requirements = challenge.accepts?.[0];
  if (probe.status !== 402 || !requirements) {
    return Response.json({ ok: false, error: `expected 402 challenge, got ${probe.status}`, steps }, { status: 502 });
  }
  steps.push({
    title: "HTTP 402 Payment Required",
    detail: `paywall quoted ${requirements.amount} base units of ${requirements.extra.name} to ${requirements.payTo.slice(0, 10)}…`,
    data: { status: 402, accepts: [requirements] },
  });

  // 2. The consumer agent signs the exact transfer as EIP-712 typed data.
  const payload = buildPaymentPayload(signer, requirements);
  const auth = payload.payload.authorization;
  steps.push({
    title: "EIP-712 transfer_with_authorization signed",
    detail: `payer ${auth.from.slice(0, 12)}… authorizes ${auth.value} base units, valid until ${new Date(Number(auth.validBefore) * 1000).toISOString()}`,
    data: { publicKey: payload.payload.publicKey, nonce: auth.nonce, signature: payload.payload.signature.slice(0, 24) + "…" },
  });

  // 3. Retry with X-PAYMENT — the facilitator verifies + settles on-chain.
  const paid = await fetch(paywallUrl, {
    cache: "no-store",
    headers: { [PAYMENT_HEADER]: Buffer.from(JSON.stringify(payload)).toString("base64") },
  });
  if (!paid.ok) {
    steps.push({ title: `payment rejected (${paid.status})`, detail: await paid.text() });
    return Response.json({ ok: false, error: "payment rejected", steps }, { status: 502 });
  }
  let settlement: unknown = null;
  const settleHeader = paid.headers.get(PAYMENT_RESPONSE_HEADER);
  if (settleHeader) {
    try { settlement = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf8")); } catch { settlement = settleHeader; }
  }
  const body = (await paid.json()) as Record<string, unknown>;
  const x402 = body.x402 as
    | { mode: string; settlementTx?: string; settlementExplorerUrl?: string; deferredReason?: string }
    | undefined;
  steps.push({
    title: x402?.settlementTx ? "Settled on-chain by the facilitator" : "Payment verified (settlement deferred)",
    detail: x402?.settlementTx
      ? `CEP-18 transfer_with_authorization executed on casper-test — tx ${x402.settlementTx.slice(0, 12)}…`
      : x402?.deferredReason === "facilitator_error"
        ? "signature cryptographically verified; the hosted facilitator is temporarily unavailable, settlement deferred"
        : "signature cryptographically verified; facilitator settlement not configured on this deployment",
    data: settlement,
  });

  return Response.json({ ok: true, steps, result: body });
}
