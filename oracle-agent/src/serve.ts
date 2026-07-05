/**
 * Oracle x402 server. Exposes the oracle's signals + reputation, with the
 * "latest signal" endpoint behind an x402 paywall settled via the Casper
 * facilitator. Public read endpoints power the dashboard; the paid endpoint is
 * the machine-to-machine product the consumer agent buys.
 *
 *   GET  /health              liveness
 *   GET  /signals             public: full signal history (audit trail)
 *   GET  /reputation          public: on-chain-mirrored accuracy score
 *   GET  /signal/latest       PAID (x402): the freshest actionable signal
 *
 * Run: `npm run oracle:serve`.
 */
import express from "express";
import {
  computeReputation,
  createPaywall,
  directionLabel,
  loadConfig,
  loadLoopLog,
  loadSignals,
  loadStakeState,
  log,
  latestSignal,
  PaywallResult,
  section,
  statusLabel,
} from "@verity/shared";

const config = loadConfig();
const app = express();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "verity-oracle", chain: config.chainName });
});

app.get("/signals", (_req, res) => {
  const signals = loadSignals().map((s) => ({
    ...s,
    directionLabel: directionLabel(s.direction),
    statusLabel: statusLabel(s.status),
  }));
  res.json({ count: signals.length, signals });
});

app.get("/reputation", (_req, res) => {
  const signals = loadSignals();
  const pkg = config.signalOraclePackageHash ?? config.signalOracleContractHash;
  res.json({
    reputation: computeReputation(signals),
    stake: loadStakeState() ?? null,
    contract: pkg ?? null,
    explorer: pkg ? `${config.explorerBase}/contract-package/${pkg}` : null,
  });
});

app.get("/loop-log", (_req, res) => {
  const entries = loadLoopLog().slice().reverse();
  res.json({ count: entries.length, entries });
});

// --- Paywalled endpoint ------------------------------------------------------
const paywall = createPaywall({
  config,
  resourceUrl: (req) => `${config.oracleServerUrl}${req.originalUrl}`,
  onResult: (result: PaywallResult) => {
    log(
      "pay",
      result.mode === "settled"
        ? `x402 settled on-chain (${result.settlementTx}) payer=${result.payer}`
        : `x402 verified (deferred settlement) payer=${result.payer}`
    );
  },
});

app.get("/signal/latest", paywall, (_req, res) => {
  const latest = latestSignal();
  if (!latest) {
    res.status(404).json({ error: "no signals published yet" });
    return;
  }
  const signals = loadSignals();
  res.json({
    signal: { ...latest, directionLabel: directionLabel(latest.direction) },
    reputation: computeReputation(signals),
    stake: loadStakeState() ?? null,
    note: "Weight your action by reputation.accuracyBps (0-10000); require a bonded stake before trusting.",
  });
});

const port = config.oracleServerPort;
app.listen(port, () => {
  section("verity oracle x402 server");
  log("ok", `listening on http://localhost:${port}`);
  log("info", `public:  GET /signals  GET /reputation  GET /health`);
  log("pay", `paid:    GET /signal/latest  (price ${config.x402Price} ${config.x402AssetSymbol})`);
});
