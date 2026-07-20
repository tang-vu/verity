/**
 * DeFi Consumer Agent — the autonomous loop (Phase 2 gate).
 *
 *   1. DISCOVER the oracle via MCP (Casper MCP server) + read its on-chain rep.
 *   2. PAY the x402 fee and READ the latest signal (cryptographic payment proof,
 *      settled by the Casper facilitator).
 *   3. WEIGHT the action by the oracle's on-chain reputation (novel mechanic).
 *   4. EXECUTE a reputation-weighted swap on Casper testnet via CSPR.trade MCP.
 *
 * Every on-chain tx hash + explorer link is printed. No human in the loop.
 * Run: `npm run agent:loop`.
 */
import {
  appendLoopLog,
  bpsToPercent,
  Calibration,
  calibrationFromSignals,
  describeCalibration,
  directionLabel,
  loadConfig,
  loadPrivateKey,
  log,
  readSignalsFromChain,
  Reputation,
  section,
  Signal,
  StakeState,
  stakeToDisplay,
  VerityConfig,
} from "@verity/shared";
import { connectMcp } from "./mcp-client.js";
import { decideAction } from "./reputation-weighted-action.js";
import { executeReputationWeightedSwap } from "./cspr-trade-executor.js";
import { payAndReadSignal } from "./x402-read-signal.js";

interface OraclePayload {
  signal: Signal & { directionLabel: string };
  reputation: Reputation;
  stake?: StakeState | null;
}

/** Step 1: best-effort MCP discovery of the oracle/chain. */
async function discoverViaMcp(url: string, token?: string): Promise<void> {
  try {
    const session = await connectMcp({ url, label: "casper-discovery", accessToken: token });
    log("ok", `Casper MCP reachable — discovered ${session.tools.length} on-chain tools`);
    await session.close();
  } catch (err) {
    log("warn", `Casper MCP discovery skipped (${err instanceof Error ? err.message : err})`);
  }
}

/**
 * Grade the oracle's stated confidence against what it actually delivered.
 *
 * Deliberately read from the chain rather than from the paywall payload: the
 * oracle must not be the one reporting how honest its own confidence has been.
 * Everything needed is public contract history, so any consumer can do this
 * independently. If the history is unreachable the consumer falls back to taking
 * the claim at face value — a degraded read must not silently size positions.
 */
async function gradeStatedConfidence(config: VerityConfig): Promise<Calibration | undefined> {
  const packageHash = config.signalOraclePackageHash;
  if (!packageHash) return undefined;
  try {
    const history = await readSignalsFromChain({
      packageHash,
      explorerBase: config.explorerBase,
    });
    const calibration = calibrationFromSignals(history);
    if (calibration.resolved === 0) return undefined;
    log("info", `Oracle confidence calibration: ${describeCalibration(calibration)}`);
    return calibration;
  } catch (err) {
    log(
      "warn",
      `Calibration check skipped (${err instanceof Error ? err.message : err}) — ` +
        "sizing on stated confidence"
    );
    return undefined;
  }
}

export async function runLoop(): Promise<void> {
  const config = loadConfig();
  section("verity DeFi agent — autonomous loop");

  // 1. Discover.
  log("info", "Step 1/4 — discovering oracle via MCP...");
  await discoverViaMcp(config.casperMcpUrl, config.csprCloudAccessToken);

  // 2. Pay x402 + read signal.
  log("pay", "Step 2/4 — paying x402 fee and reading latest signal...");
  const signer = loadPrivateKey(config.consumerSecretKeyPath);
  const { payload, paid, settlement } = await payAndReadSignal(config, signer);
  const { signal, reputation, stake } = payload as OraclePayload;
  log(
    "ok",
    `Signal #${signal.id}: ${directionLabel(signal.direction)} @ ${signal.confidence}% ` +
      `(${paid ? "PAID" : "free"})`
  );
  if (settlement) log("chain", `x402 settlement: ${JSON.stringify(settlement)}`);
  log("info", `Oracle on-chain reputation: ${bpsToPercent(reputation.accuracyBps)} ` +
    `(${reputation.correctSignals}/${reputation.resolvedSignals} resolved)`);
  if (stake) {
    log(
      "info",
      `Oracle bonded collateral: ${stakeToDisplay(stake.bondedBaseUnits, stake.decimals)} ` +
        `${stake.stakeSymbol} at risk (slashed to date: ` +
        `${stakeToDisplay(stake.slashedBaseUnits, stake.decimals)})`
    );
  }

  // 3. Weight by reputation AND require real collateral behind the word.
  log("bot", "Step 3/4 — weighting action by on-chain reputation + bonded stake...");
  const calibration = await gradeStatedConfidence(config);
  const decision = decideAction({
    direction: signal.direction,
    confidence: signal.confidence,
    reputation,
    maxNotional: Number(config.consumerMaxNotional),
    minReputationBps: config.consumerMinReputationBps,
    stakeBaseUnits: stake?.bondedBaseUnits,
    minStakeBaseUnits: stake ? config.consumerMinStakeBaseUnits : undefined,
    calibration,
  });
  log("info", `Decision: ${decision.side} — ${decision.rationale}`);

  // 4. Execute swap via CSPR.trade MCP.
  log("chain", "Step 4/4 — executing reputation-weighted action via CSPR.trade MCP...");
  const swap = await executeReputationWeightedSwap({
    mcpUrl: config.csprTradeMcpUrl,
    accessToken: config.csprCloudAccessToken,
    decision,
    baseAsset: signal.asset,
    explorerBase: config.explorerBase,
  });

  if (swap.executed) {
    log("ok", `Swap executed via ${swap.toolUsed}: ${swap.detail}`);
    if (swap.explorerUrl) log("chain", swap.explorerUrl);
  } else {
    log("warn", `No swap executed (${swap.via}): ${swap.detail}`);
  }

  // Persist the run so the dashboard can render the live loop with tx links.
  appendLoopLog({
    at: Date.now(),
    signalId: signal.id,
    directionLabel: directionLabel(signal.direction),
    confidence: signal.confidence,
    reputationBps: reputation.accuracyBps,
    decisionSide: decision.side,
    decisionNotional: decision.notional,
    decisionRationale: decision.rationale,
    paid,
    settlementTx: typeof settlement === "object" && settlement
      ? (settlement as { transaction?: string }).transaction
      : undefined,
    settlementExplorerUrl: undefined,
    swapVia: swap.via,
    swapTx: swap.txHash,
    swapExplorerUrl: swap.explorerUrl,
    swapDetail: swap.detail,
  });

  section("loop complete");
  log("ok", "Autonomous loop closed: signal → x402 payment → reputation-weighted action.");
}

runLoop().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
