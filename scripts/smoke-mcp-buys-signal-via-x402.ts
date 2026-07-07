/**
 * MCP smoke test — proves ANY MCP agent can buy verity's signal, end to end,
 * with NO testnet funds:
 *
 *   1. Spin up an in-process Express server with the REAL x402 paywall
 *      (verified-deferred mode: local EIP-712 verify only, no facilitator).
 *   2. Launch the real verity MCP server (`oracle-agent/src/mcp-server.ts`)
 *      as a child process over stdio, pointed at that server.
 *   3. Act as the MCP host: list tools, read reputation + price quote for
 *      free, then call `verity_buy_latest_signal` — the tool signs the
 *      EIP-712 payment and unlocks the signal through HTTP 402.
 *
 * Run: `npm run smoke:mcp`. Exits non-zero on any mismatch.
 */
import express from "express";
import rateLimit from "express-rate-limit";
import type { AddressInfo } from "node:net";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  createPaywall,
  Direction,
  loadConfig,
  log,
  PaywallResult,
  saveSignals,
  section,
  SignalStatus,
  StoredSignal,
} from "@verity/shared";

const STORE_PATH = "./loop-output/smoke-mcp-signals.json";

/** Text payload of the first content block of an MCP tool result. */
function toolJson(result: unknown): Record<string, unknown> {
  const content = (result as { content?: { type: string; text?: string }[] }).content;
  const text = content?.find((c) => c.type === "text")?.text;
  if (!text) throw new Error(`tool returned no text content: ${JSON.stringify(result).slice(0, 200)}`);
  return JSON.parse(text) as Record<string, unknown>;
}

async function main(): Promise<void> {
  section("verity — MCP smoke test (agent buys the signal over x402, no funds)");
  const config = loadConfig();

  // Seed one signal into an isolated store so real data is untouched.
  process.env.VERITY_STORE_PATH = STORE_PATH;
  const signal: StoredSignal = {
    id: 0,
    asset: "casper-network",
    symbol: "CSPR",
    direction: Direction.Up,
    confidence: 71,
    horizonHours: 24,
    priceAtPublish: 15_000,
    priceUsdAtPublish: 0.015,
    reasoning: "mcp-smoke signal",
    keyFactors: ["smoke"],
    publishedAt: Date.now(),
    publisher: config.payeeAddress ?? "00".repeat(32),
    publishTxHash: "n/a",
    publishExplorerUrl: "n/a",
    status: SignalStatus.Pending,
  };
  saveSignals([signal]);

  // Real paywall, verified-deferred: zero-config fallbacks keep EIP-712 valid.
  const cfg = {
    ...config,
    payeeAddress: config.payeeAddress || "97".repeat(32),
    x402AssetPackageHash: config.x402AssetPackageHash || "ab".repeat(32),
    csprCloudAccessToken: undefined,
  };
  let captured: PaywallResult | undefined;
  const app = express();
  app.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false }));
  const paywall = createPaywall({
    config: cfg,
    resourceUrl: (req) => `http://localhost${req.originalUrl}`,
    onResult: (r) => (captured = r),
  });
  app.get("/signal/latest", paywall, (_req, res) => {
    res.json({ signal, ok: true });
  });
  const httpServer = app.listen(0);
  const port = (httpServer.address() as AddressInfo).port;

  // Launch the real MCP server as a child, pointed at the local paywall.
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) childEnv[k] = v;
  childEnv.ORACLE_SERVER_URL = `http://localhost:${port}`;
  childEnv.VERITY_STORE_PATH = STORE_PATH;
  childEnv.X402_ASSET_PACKAGE_HASH = cfg.x402AssetPackageHash;
  childEnv.PAYEE_ADDRESS = cfg.payeeAddress;
  childEnv.CSPR_CLOUD_ACCESS_TOKEN = "";

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "oracle-agent/src/mcp-server.ts"],
    env: childEnv,
  });
  const client = new Client({ name: "smoke-mcp-host", version: "0.1.0" });

  try {
    await client.connect(transport);

    // 1. Discovery: the four verity tools must be advertised.
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    const expected = [
      "verity_buy_latest_signal",
      "verity_get_payment_requirements",
      "verity_get_reputation",
      "verity_get_signal_history",
    ];
    for (const e of expected) {
      if (!names.includes(e)) throw new Error(`tool missing from discovery: ${e} (got ${names.join(", ")})`);
    }
    log("ok", `Step 1: MCP discovery advertised ${names.length} verity tools`);

    // 2. Free reads: reputation + price quote.
    const rep = toolJson(await client.callTool({ name: "verity_get_reputation", arguments: {} }));
    const reputation = rep.reputation as { totalSignals: number } | undefined;
    if (!reputation || reputation.totalSignals < 1) throw new Error("reputation tool returned no data");
    const quote = toolJson(await client.callTool({ name: "verity_get_payment_requirements", arguments: {} }));
    const req0 = (quote.accepts as { amount: string }[] | undefined)?.[0];
    if (!req0?.amount) throw new Error("payment-requirements tool returned no quote");
    log("ok", `Step 2: free tools returned reputation + x402 quote (${req0.amount} base units)`);

    // 3. The paid product: buy through the real 402 → EIP-712 → X-PAYMENT flow.
    const bought = toolJson(await client.callTool({ name: "verity_buy_latest_signal", arguments: {} }));
    if (bought.paid !== true) throw new Error(`buy tool did not pay: ${JSON.stringify(bought).slice(0, 200)}`);
    if (!bought.signal) throw new Error("buy tool returned no signal");
    if (!captured?.verifiedLocally) throw new Error("paywall never verified the MCP agent's signature");
    log("ok", `Step 3: MCP agent PAID via x402 and unlocked the signal (mode=${captured.mode})`);

    section("MCP SMOKE TEST PASSED");
    log("ok", "Any MCP-capable agent can discover verity, check its reputation, and buy the signal.");
  } finally {
    await client.close().catch(() => {});
    httpServer.close();
  }
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
