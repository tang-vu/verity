/**
 * Seed historical RESOLVED signals so the oracle's on-chain reputation is
 * non-zero and has visible history at demo time. Each seed is a REAL on-chain
 * publish + resolve (real tx hashes); outcomes are chosen deterministically so
 * the resulting accuracy is meaningful (default 4 signals: 3 correct, 1 wrong =
 * 75%). Synthetic prices are used (documented as seed data — no LLM call).
 *
 * Prereqs: deployed contract (SIGNAL_ORACLE_PACKAGE_HASH) + funded producer key.
 * Run: `npm run seed`.
 */
import {
  appendSignal,
  Direction,
  loadConfig,
  loadPrivateKey,
  loadStakeState,
  log,
  makeRpcClient,
  nextSignalId,
  publishSignalOnChain,
  require_,
  resolveSignalOnChain,
  saveStakeState,
  section,
  SignalStatus,
  StoredSignal,
  usdToMicro,
} from "@verity/shared";

/** Mirror the contract's on-chain slash (SLASH_BPS = 20%) into the local store. */
function recordSlash(resolveTxHash: string, explorerUrl: string): void {
  const state = loadStakeState();
  if (!state) return;
  const slash = Math.floor((state.bondedBaseUnits * 2000) / 10000);
  if (slash <= 0) return;
  state.bondedBaseUnits -= slash;
  state.slashedBaseUnits += slash;
  state.txs.push({ label: "slash", txHash: resolveTxHash, explorerUrl, at: Date.now() });
  saveStakeState(state);
}

interface Seed {
  direction: Direction;
  confidence: number;
  priceAtPublishUsd: number;
  priceAtResolveUsd: number;
  reasoning: string;
}

// Designed so 3 resolve CORRECT and 1 WRONG -> 7500 bps accuracy.
const SEEDS: Seed[] = [
  { direction: Direction.Up, confidence: 78, priceAtPublishUsd: 0.0142, priceAtResolveUsd: 0.0155, reasoning: "Seed: accumulation + funding flip; called UP, price rose." },
  { direction: Direction.Down, confidence: 71, priceAtPublishUsd: 0.0168, priceAtResolveUsd: 0.0151, reasoning: "Seed: rejected resistance; called DOWN, price fell." },
  { direction: Direction.Up, confidence: 64, priceAtPublishUsd: 0.0149, priceAtResolveUsd: 0.0161, reasoning: "Seed: volume breakout; called UP, price rose." },
  { direction: Direction.Up, confidence: 69, priceAtPublishUsd: 0.0158, priceAtResolveUsd: 0.0144, reasoning: "Seed: continuation expected; called UP, price fell (miss)." },
];

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — seed resolved signals");

  const packageHash = require_(config, "signalOraclePackageHash", "Deploy first; set SIGNAL_ORACLE_PACKAGE_HASH");
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);
  const publisher = signer.publicKey.accountHash().toHex();

  for (const seed of SEEDS) {
    const id = nextSignalId();
    const publishMicro = usdToMicro(seed.priceAtPublishUsd);
    const resolveMicro = usdToMicro(seed.priceAtResolveUsd);

    log("chain", `Seeding signal #${id} (publish)...`);
    const pubTx = await publishSignalOnChain({
      rpc, config, signer, packageHash,
      asset: config.signalAsset,
      direction: seed.direction,
      confidence: seed.confidence,
      horizonHours: 24,
      priceAtPublishMicro: publishMicro,
      reasoning: seed.reasoning,
    });
    log("ok", `  published #${id}: ${pubTx.txHash}`);

    log("chain", `Seeding signal #${id} (resolve)...`);
    const resTx = await resolveSignalOnChain({
      rpc, config, signer, packageHash, id, priceAtResolveMicro: resolveMicro,
    });
    const correct =
      seed.direction === Direction.Up
        ? resolveMicro > publishMicro
        : seed.direction === Direction.Down
        ? resolveMicro < publishMicro
        : Math.abs(resolveMicro - publishMicro) * 10000 <= publishMicro * 50;
    log("ok", `  resolved #${id} (${correct ? "CORRECT" : "WRONG"}): ${resTx.txHash}`);
    if (!correct) recordSlash(resTx.txHash, resTx.explorerUrl);

    const stored: StoredSignal = {
      id,
      asset: config.signalAsset,
      symbol: "CSPR",
      direction: seed.direction,
      confidence: seed.confidence,
      horizonHours: 24,
      priceAtPublish: publishMicro,
      priceUsdAtPublish: seed.priceAtPublishUsd,
      reasoning: seed.reasoning,
      keyFactors: ["seed"],
      publishedAt: Date.now(),
      publisher,
      publishTxHash: pubTx.txHash,
      publishExplorerUrl: pubTx.explorerUrl,
      status: correct ? SignalStatus.Correct : SignalStatus.Wrong,
      resolvedAt: Date.now(),
      priceAtResolve: resolveMicro,
      priceUsdAtResolve: seed.priceAtResolveUsd,
      correct,
      resolveTxHash: resTx.txHash,
      resolveExplorerUrl: resTx.explorerUrl,
    };
    appendSignal(stored);
  }

  section("seed complete");
  log("ok", `${SEEDS.length} resolved signals seeded on-chain. Reputation now has history.`);
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
