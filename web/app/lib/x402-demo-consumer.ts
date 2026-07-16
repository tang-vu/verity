/**
 * Server-held demo consumer for the "buy the signal live" button: loads the
 * demo agent's TESTNET key from env and signs the x402 EIP-712 payment payload.
 * The secret never leaves the server; visitors only trigger the flow.
 *
 * Key sources (first match wins):
 *   CONSUMER_SECRET_KEY_PEM   full PEM text (Vercel env; "\n" escapes ok)
 *   CONSUMER_SECRET_KEY_PATH  local-dev path to a PEM file
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import casperSdk from "casper-js-sdk";
import {
  buildTransferDigest,
  toAddressForm,
  X402_VERSION,
  type Authorization,
  type PaymentPayload,
  type PaymentRequirements,
} from "./x402-protocol";

const { PrivateKey, KeyAlgorithm } = casperSdk as unknown as typeof import("casper-js-sdk");

export type DemoSigner = InstanceType<typeof PrivateKey>;

/** null when the demo buyer isn't configured (the curl path still works). */
export function loadDemoConsumerKey(): DemoSigner | null {
  try {
    const pemEnv = process.env.CONSUMER_SECRET_KEY_PEM;
    const path = process.env.CONSUMER_SECRET_KEY_PATH;
    const pem = pemEnv ? pemEnv.replace(/\\n/g, "\n") : path ? readFileSync(path, "utf8") : null;
    if (!pem) return null;
    return PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  } catch (err) {
    console.error("[demo-buy] failed to load consumer key:", err instanceof Error ? err.message : err);
    return null;
  }
}

/** Sign the exact transfer the 402 challenge asks for (65-byte prefixed sig). */
export function buildPaymentPayload(signer: DemoSigner, requirements: PaymentRequirements): PaymentPayload {
  const now = Math.floor(Date.now() / 1000);
  const authorization: Authorization = {
    from: toAddressForm(signer.publicKey.accountHash().toHex()),
    to: requirements.payTo,
    value: requirements.amount,
    validAfter: String(now - 60),
    validBefore: String(now + requirements.maxTimeoutSeconds),
    nonce: Buffer.from(randomBytes(32)).toString("hex"),
  };
  const digest = buildTransferDigest(requirements, authorization);
  return {
    x402Version: X402_VERSION,
    scheme: "exact",
    network: requirements.network,
    payload: {
      // Algorithm-prefixed 65-byte signature — the x402 wire format the
      // facilitator and casper-js-sdk's verifySignature expect.
      signature: Buffer.from(signer.signAndAddAlgorithmBytes(digest)).toString("hex"),
      publicKey: signer.publicKey.toHex(),
      authorization,
    },
  };
}
