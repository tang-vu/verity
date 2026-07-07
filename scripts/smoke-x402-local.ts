/**
 * Local x402 smoke test — NO secrets, NO testnet, NO funds required.
 *
 * Validates the hardest integration: the EIP-712 sign (paying client) ⇄ verify
 * (paywall middleware) round-trip, plus the 402 → X-PAYMENT → 200 flow. Spins up
 * an in-process Express server with the real paywall, seeds one signal, then has
 * the real paying client pay and read it. Exits non-zero on any mismatch.
 *
 * Run: `npm run smoke:x402`
 */
import express from "express";
import rateLimit from "express-rate-limit";
import type { AddressInfo } from "node:net";
import {
  createPaywall,
  Direction,
  loadConfig,
  loadPrivateKey,
  log,
  PaywallResult,
  SignalStatus,
  saveSignals,
  section,
  StoredSignal,
} from "@verity/shared";
import { payAndFetch } from "@verity/shared";

async function main(): Promise<void> {
  section("verity — local x402 smoke test (no funds)");
  const config = loadConfig();

  // Route the store to a temp file so we don't disturb real data.
  process.env.VERITY_STORE_PATH = "./loop-output/smoke-signals.json";
  const signal: StoredSignal = {
    id: 0,
    asset: "casper-network",
    symbol: "CSPR",
    direction: Direction.Up,
    confidence: 73,
    horizonHours: 24,
    priceAtPublish: 15_000,
    priceUsdAtPublish: 0.015,
    reasoning: "smoke-test signal",
    keyFactors: ["smoke"],
    publishedAt: Date.now(),
    publisher: config.payeeAddress ?? "00".repeat(32),
    publishTxHash: "n/a",
    publishExplorerUrl: "n/a",
    status: SignalStatus.Pending,
  };
  saveSignals([signal]);

  // Ensure the paywall has a payee + asset to sign over (local verify only).
  const cfg = {
    ...config,
    payeeAddress: config.payeeAddress || "97".repeat(32),
    x402AssetPackageHash: config.x402AssetPackageHash || "ab".repeat(32),
    csprCloudAccessToken: undefined, // force verified-deferred (no facilitator call)
  };

  let captured: PaywallResult | undefined;
  const app = express();
  // Same guard as the real oracle server: paywall verification is not free,
  // so cap request rate even in the local smoke server.
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  const paywall = createPaywall({
    config: cfg,
    resourceUrl: (req) => `http://localhost${req.originalUrl}`,
    onResult: (r) => (captured = r),
  });
  app.get("/signal/latest", paywall, (_req, res) => {
    res.json({ signal, ok: true });
  });

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const url = `http://localhost:${port}/signal/latest`;

  try {
    const consumer = loadPrivateKey(config.consumerSecretKeyPath);

    // 1. Probe should be 402.
    const probe = await fetch(url);
    if (probe.status !== 402) throw new Error(`expected 402, got ${probe.status}`);
    log("ok", "Step 1: server returned HTTP 402 with payment requirements");

    // 2. Pay + read.
    const result = await payAndFetch<{ ok: boolean }>({ url, config: cfg, signer: consumer });
    if (!result.paid) throw new Error("client did not pay (no 402 path taken)");
    if (!result.data?.ok) throw new Error("did not receive unlocked payload");
    log("ok", "Step 2: client signed EIP-712, paid, and read the signal");

    // 3. Server must have verified the signature locally.
    if (!captured?.verifiedLocally) throw new Error("server did not verify the payment signature");
    log("ok", `Step 3: paywall verified signature locally (mode=${captured.mode}, payer=${captured.payer})`);

    section("SMOKE TEST PASSED");
    log("ok", "EIP-712 sign⇄verify round-trip works; x402 paywall + client integrated.");
  } finally {
    server.close();
  }
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
