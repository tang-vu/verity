/**
 * x402 paywall middleware (resource-server side).
 *
 * No `X-PAYMENT` header  -> 402 with the payment requirements.
 * Valid signed payment   -> locally verify the EIP-712 signature (cryptographic
 *                           proof the payer authorized this exact transfer),
 *                           then ask the hosted facilitator to verify + settle
 *                           on-chain. If the facilitator/asset/token aren't
 *                           configured, fall back to "verified-deferred" so the
 *                           pay-per-query floor keeps working for the demo.
 */
import type { NextFunction, Request, Response } from "express";
import { PublicKey } from "./casper-sdk.js";
import type { VerityConfig } from "./env-config.js";
import { buildTransferDigest } from "./eip712-casper.js";
import { facilitatorSettle, facilitatorVerify } from "./facilitator-client.js";
import {
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  PaymentPayload,
  PaymentRequirements,
  X402_VERSION,
} from "./x402-types.js";

export interface PaywallResult {
  settled: boolean;
  settlementTx?: string;
  verifiedLocally: boolean;
  payer?: string;
  mode: "settled" | "verified-deferred";
}

// 32-byte zero placeholders keep EIP-712 encoding valid when the asset/payee
// aren't configured yet (verified-deferred floor mode), so signing never breaks.
const ZERO_PACKAGE_HASH = "0".repeat(64);
const ZERO_ACCOUNT_ADDRESS = "00" + "0".repeat(64);

function normalizePayTo(hash: string): string {
  const clean = hash.replace(/^0x/, "").replace(/^account-hash-/, "");
  return clean.length === 64 ? "00" + clean : clean;
}

export function buildRequirements(config: VerityConfig, resourceUrl: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: config.x402Network,
    asset: config.x402AssetPackageHash || ZERO_PACKAGE_HASH,
    payTo: config.payeeAddress ? normalizePayTo(config.payeeAddress) : ZERO_ACCOUNT_ADDRESS,
    amount: config.x402Price,
    maxTimeoutSeconds: 120,
    resource: resourceUrl,
    description: "verity latest reputation-staked market signal",
    mimeType: "application/json",
    extra: {
      name: config.x402AssetName,
      version: config.x402AssetVersion,
      decimals: config.x402AssetDecimals,
      symbol: config.x402AssetSymbol,
    },
  };
}

function verifyLocally(
  payload: PaymentPayload,
  requirements: PaymentRequirements
): { ok: boolean; payer?: string } {
  try {
    const auth = payload.payload.authorization;
    const digest = buildTransferDigest({
      assetName: requirements.extra.name,
      assetVersion: requirements.extra.version,
      chainName: requirements.network,
      contractPackageHash: requirements.asset,
      authorization: auth,
    });
    const pub = PublicKey.fromHex(payload.payload.publicKey);
    const sig = Uint8Array.from(Buffer.from(payload.payload.signature, "hex"));
    return { ok: pub.verifySignature(digest, sig), payer: auth.from };
  } catch {
    return { ok: false };
  }
}

export function createPaywall(opts: {
  config: VerityConfig;
  resourceUrl: (req: Request) => string;
  onResult?: (result: PaywallResult) => void;
}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requirements = buildRequirements(opts.config, opts.resourceUrl(req));
    const challenge = { x402Version: X402_VERSION, accepts: [requirements] };

    const headerVal = req.header(PAYMENT_HEADER);
    if (!headerVal) {
      res.status(402).json({ ...challenge, error: "payment required" });
      return;
    }

    let payload: PaymentPayload;
    try {
      payload = JSON.parse(Buffer.from(headerVal, "base64").toString("utf8")) as PaymentPayload;
    } catch {
      res.status(402).json({ ...challenge, error: "malformed X-PAYMENT header" });
      return;
    }

    const local = verifyLocally(payload, requirements);
    if (!local.ok) {
      res.status(402).json({ ...challenge, error: "invalid payment signature" });
      return;
    }

    let result: PaywallResult = {
      settled: false,
      verifiedLocally: true,
      payer: local.payer,
      mode: "verified-deferred",
    };

    if (opts.config.csprCloudAccessToken && opts.config.x402AssetPackageHash) {
      try {
        const verify = await facilitatorVerify(opts.config, payload, requirements);
        if (!verify.isValid) {
          // eslint-disable-next-line no-console
          console.log(`[x402] facilitator verify rejected: ${verify.invalidReason} — ${verify.invalidMessage}`);
        } else {
          const settle = await facilitatorSettle(opts.config, payload, requirements);
          if (settle.success) {
            result = {
              settled: true,
              settlementTx: settle.transaction,
              verifiedLocally: true,
              payer: settle.payer ?? local.payer,
              mode: "settled",
            };
          } else {
            // eslint-disable-next-line no-console
            console.log(`[x402] facilitator settle failed: ${settle.errorReason} — ${settle.errorMessage}`);
          }
        }
      } catch (err) {
        // Facilitator unreachable -> keep the floor: verified-deferred.
        // eslint-disable-next-line no-console
        console.log(`[x402] facilitator error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const responseInfo = result.settlementTx
      ? { success: true, transaction: result.settlementTx, network: requirements.network, payer: result.payer }
      : { success: true, mode: result.mode, payer: result.payer };
    res.setHeader(
      PAYMENT_RESPONSE_HEADER,
      Buffer.from(JSON.stringify(responseInfo)).toString("base64")
    );

    opts.onResult?.(result);
    (req as Request & { x402?: PaywallResult }).x402 = result;
    next();
  };
}
