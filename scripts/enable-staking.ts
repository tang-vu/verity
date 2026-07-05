/**
 * Turn on the oracle's collateral: wire the x402USD stake token, point slashing
 * at a consumer-protection treasury, set the publish gate, then bond the oracle's
 * stake on-chain. After this, every wrong resolution automatically slashes real
 * capital (see `npm run seed`, whose deliberate miss produces a live slash tx).
 *
 * Prereqs: SignalOracle + X402Token deployed (SIGNAL_ORACLE_PACKAGE_HASH,
 * X402_ASSET_PACKAGE_HASH in .env), funded producer key. The producer deployed the
 * token so it holds the supply it bonds here.
 *
 * Run: `npm run enable:staking`.
 */
import {
  approveStakeOnChain,
  loadConfig,
  loadPrivateKey,
  loadStakeState,
  log,
  makeRpcClient,
  require_,
  saveStakeState,
  section,
  setMinStakeOnChain,
  setStakeTokenOnChain,
  setTreasuryOnChain,
  stakeOnChain,
  stakeToDisplay,
  StakeState,
} from "@verity/shared";

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — enable staking (bond collateral behind the oracle)");

  const packageHash = require_(config, "signalOraclePackageHash", "Deploy SignalOracle first");
  const tokenPackageHash = require_(config, "x402AssetPackageHash", "Deploy X402Token first (npm run deploy:x402-token)");
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);
  const ctx = { rpc, config, signer, packageHash };

  const oracleAcct = signer.publicKey.accountHash().toHex();
  const treasuryKey = loadPrivateKey(config.consumerSecretKeyPath)
    .publicKey.accountHash()
    .toPrefixedString(); // account-hash-… : slashed collateral flows to the consumer

  const stakeUnits = config.oracleStakeBaseUnits;
  const minUnits = config.minStakeBaseUnits;

  const txs: StakeState["txs"] = [];
  const record = (label: string, r: { txHash: string; explorerUrl: string }) => {
    txs.push({ label, txHash: r.txHash, explorerUrl: r.explorerUrl, at: Date.now() });
    log("ok", `  ${label}: ${r.txHash}`);
    log("chain", `  ${r.explorerUrl}`);
  };

  log("chain", "1/5 set_stake_token (x402USD as collateral asset)...");
  record("set_stake_token", await setStakeTokenOnChain({ ...ctx, tokenPackageHash }));

  log("chain", `2/5 set_treasury (slashed collateral → consumer ${treasuryKey.slice(0, 24)}…)...`);
  record("set_treasury", await setTreasuryOnChain({ ...ctx, treasuryKey }));

  log("chain", `3/5 set_min_stake (${stakeToDisplay(minUnits, config.x402AssetDecimals)} ${config.x402AssetSymbol} gate)...`);
  record("set_min_stake", await setMinStakeOnChain({ ...ctx, minStakeBaseUnits: minUnits }));

  log("chain", `4/5 approve (let the oracle contract pull ${stakeToDisplay(stakeUnits, config.x402AssetDecimals)} ${config.x402AssetSymbol})...`);
  record("approve", await approveStakeOnChain({
    rpc, config, signer, tokenPackageHash, oraclePackageHash: packageHash, amountBaseUnits: stakeUnits,
  }));

  log("chain", `5/5 stake (bond ${stakeToDisplay(stakeUnits, config.x402AssetDecimals)} ${config.x402AssetSymbol})...`);
  record("stake", await stakeOnChain({ ...ctx, amountBaseUnits: stakeUnits }));

  const state: StakeState = {
    oracle: oracleAcct,
    stakeTokenPackageHash: tokenPackageHash,
    stakeSymbol: config.x402AssetSymbol,
    decimals: config.x402AssetDecimals,
    bondedBaseUnits: stakeUnits,
    minStakeBaseUnits: minUnits,
    slashedBaseUnits: loadStakeState()?.slashedBaseUnits ?? 0,
    treasury: treasuryKey,
    txs,
    updatedAt: Date.now(),
  };
  saveStakeState(state);

  section("staking live");
  log("ok", `Oracle bonded ${stakeToDisplay(stakeUnits, config.x402AssetDecimals)} ${config.x402AssetSymbol}. Wrong calls now slash on-chain.`);
  log("info", "Next: `npm run seed` (its deliberate miss produces a real slash tx), then `npm run oracle:publish`.");
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
