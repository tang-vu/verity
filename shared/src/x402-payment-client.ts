/**
 * x402 paying client (consumer side). Probes a protected resource; on HTTP 402
 * it reads the payment requirements, builds + signs the EIP-712
 * transfer_with_authorization, and retries with the base64 `X-PAYMENT` header.
 * Returns the unlocked data plus any settlement info from `X-PAYMENT-RESPONSE`.
 */
import { PrivateKey } from "./casper-sdk.js";
import type { VerityConfig } from "./env-config.js";
import { Authorization, buildTransferDigest, randomNonceHex } from "./eip712-casper.js";
import {
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PaymentPayload,
  PaymentRequiredResponse,
  PaymentRequirements,
  X402_VERSION,
} from "./x402-types.js";

export interface PaidResponse<T> {
  data: T;
  paid: boolean;
  requirements?: PaymentRequirements;
  settlement?: unknown;
}

/** Account-hash hex -> 33-byte "00"+hex address form the facilitator expects. */
function toAddressForm(accountHashHex: string): string {
  const clean = accountHashHex.replace(/^0x/, "").replace(/^account-hash-/, "");
  return "00" + clean;
}

/** Build and sign the x402 payment payload for the given requirements. */
export function buildPaymentPayload(opts: {
  signer: PrivateKey;
  requirements: PaymentRequirements;
}): PaymentPayload {
  const { signer, requirements } = opts;
  const now = Math.floor(Date.now() / 1000);
  const authorization: Authorization = {
    from: toAddressForm(signer.publicKey.accountHash().toHex()),
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: String(now - 60),
    validBefore: String(now + requirements.maxTimeoutSeconds),
    nonce: randomNonceHex(),
  };
  const digest = buildTransferDigest({
    assetName: requirements.extra.name,
    assetVersion: requirements.extra.version,
    chainName: requirements.network,
    contractPackageHash: requirements.asset,
    authorization,
  });
  return {
    x402Version: X402_VERSION,
    scheme: "exact",
    network: requirements.network,
    payload: {
      // 65-byte algorithm-prefixed signature: the x402 wire format and what
      // casper-js-sdk's verifySignature / the facilitator expect.
      signature: Buffer.from(signer.signAndAddAlgorithmBytes(digest)).toString("hex"),
      publicKey: signer.publicKey.toHex(),
      authorization,
    },
  };
}

export async function payAndFetch<T = unknown>(opts: {
  url: string;
  config: VerityConfig;
  signer: PrivateKey;
}): Promise<PaidResponse<T>> {
  const { url, signer } = opts;

  const probe = await fetch(url);
  if (probe.status !== 402) {
    return { data: (await probe.json()) as T, paid: false };
  }

  const challenge = (await probe.json()) as PaymentRequiredResponse;
  const requirements = challenge.accepts?.[0];
  if (!requirements) {
    throw new Error("402 challenge contained no payment requirements");
  }

  const payload = buildPaymentPayload({ signer, requirements });
  const header = Buffer.from(JSON.stringify(payload)).toString("base64");

  const paid = await fetch(url, { headers: { [PAYMENT_HEADER]: header } });
  if (!paid.ok) {
    throw new Error(`payment rejected (${paid.status}): ${await paid.text()}`);
  }

  let settlement: unknown;
  const settleHeader = paid.headers.get(PAYMENT_RESPONSE_HEADER);
  if (settleHeader) {
    try {
      settlement = JSON.parse(Buffer.from(settleHeader, "base64").toString("utf8"));
    } catch {
      settlement = settleHeader;
    }
  }

  return { data: (await paid.json()) as T, paid: true, requirements, settlement };
}
