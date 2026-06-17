/**
 * Oracle Agent — publish one signal end-to-end:
 *   real market data (CoinGecko) -> LLM signal (Claude) -> on-chain write
 *   (SignalOracle.publish_signal) -> local audit store with tx hash + link.
 *
 * Run: `npm run oracle:publish` (or `tsx oracle-agent/src/publish-signal.ts`).
 * Requires ANTHROPIC_API_KEY, a funded producer key, and SIGNAL_ORACLE_CONTRACT_HASH.
 */
import {
  appendSignal,
  directionLabel,
  loadConfig,
  loadPrivateKey,
  log,
  makeRpcClient,
  nextSignalId,
  publishSignalOnChain,
  require_,
  section,
  SignalStatus,
  StoredSignal,
  usdToMicro,
} from "@verity/shared";
import { fetchMarketSnapshot } from "./market-data.js";
import { generateSignal } from "./llm-signal.js";

const DEFAULT_HORIZON_HOURS = 24;

export async function publishOnce(): Promise<StoredSignal> {
  const config = loadConfig();
  section("verity oracle — publish signal");

  // 1. Real-world data.
  log("info", `Fetching market snapshot for ${config.signalAsset} (${config.signalVsCurrency})...`);
  const snapshot = await fetchMarketSnapshot(config.signalAsset, config.signalVsCurrency);
  log("ok", `Spot ${snapshot.price} ${snapshot.vsCurrency}, 24h ${snapshot.change24hPct.toFixed(2)}%`);

  // 2. LLM signal.
  const apiKey = require_(config, "anthropicApiKey", "Set ANTHROPIC_API_KEY in .env");
  log("bot", `Generating signal with ${config.anthropicModel}...`);
  const signal = await generateSignal({
    apiKey,
    model: config.anthropicModel,
    snapshot,
    horizonHours: DEFAULT_HORIZON_HOURS,
  });
  log(
    "ok",
    `Signal: ${directionLabel(signal.direction)} @ ${signal.confidence}% — ${signal.reasoning}`
  );

  // 3. On-chain write.
  const packageHash = require_(
    config,
    "signalOraclePackageHash",
    "Deploy the contract first (npm run deploy:contract) and set SIGNAL_ORACLE_PACKAGE_HASH"
  );
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);
  const priceMicro = usdToMicro(snapshot.price);
  const id = nextSignalId();

  log("chain", `Publishing signal #${id} on-chain...`);
  const tx = await publishSignalOnChain({
    rpc,
    config,
    signer,
    packageHash,
    asset: snapshot.asset,
    direction: signal.direction,
    confidence: signal.confidence,
    horizonHours: signal.horizonHours,
    priceAtPublishMicro: priceMicro,
    reasoning: signal.reasoning,
  });
  log("ok", `Published. tx: ${tx.txHash}`);
  log("chain", tx.explorerUrl);

  // 4. Audit store.
  const stored: StoredSignal = {
    id,
    asset: snapshot.asset,
    symbol: snapshot.symbol,
    direction: signal.direction,
    confidence: signal.confidence,
    horizonHours: signal.horizonHours,
    priceAtPublish: priceMicro,
    priceUsdAtPublish: snapshot.price,
    reasoning: signal.reasoning,
    keyFactors: signal.keyFactors,
    publishedAt: snapshot.timestampMs,
    publisher: signer.publicKey.accountHash().toHex(),
    publishTxHash: tx.txHash,
    publishExplorerUrl: tx.explorerUrl,
    status: SignalStatus.Pending,
  };
  appendSignal(stored);
  return stored;
}

// Execute when run directly.
publishOnce().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
