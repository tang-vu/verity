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
 * Run: `npm run enable:staking`                    — first-time bring-up (5 steps).
 *      `npm run enable:staking -- --top-up 57600`  — re-bond after slashing:
 *        approve + stake only, leaving token/treasury/min-stake wiring untouched.
 *        Re-collateralising after a loss is the normal protocol lifecycle, not setup.
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

/** `--top-up <baseUnits>` → amount to bond on top of the existing stake. */
function parseTopUp(argv: string[]): number | undefined {
  const i = argv.indexOf("--top-up");
  if (i === -1) return undefined;
  const amount = Number(argv[i + 1]);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("--top-up needs a positive integer amount in stake base units, e.g. --top-up 57600");
  }
  return amount;
}

/**
 * Currently bonded collateral, read back from the dashboard's on-chain
 * reconstruction (it replays every stake/slash deploy from the explorer, so it
 * accounts for slashing that the local store never sees). Returns undefined if
 * unreachable — the caller then falls back to the local store and says so.
 */
async function fetchLiveBondedBaseUnits(): Promise<number | undefined> {
  const base = process.env.VERITY_DASHBOARD_URL ?? "https://web-eight-amber-iq6mjhp7bf.vercel.app";
  try {
    const res = await fetch(`${base}/api/oracle/reputation`, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { stake?: { bondedBaseUnits?: number } };
    const bonded = body.stake?.bondedBaseUnits;
    return typeof bonded === "number" ? bonded : undefined;
  } catch {
    return undefined;
  }
}

/** Re-bond collateral after slashing: approve + stake, no re-configuration. */
async function topUp(amountBaseUnits: number): Promise<void> {
  const config = loadConfig();
  const decimals = config.x402AssetDecimals;
  const display = `${stakeToDisplay(amountBaseUnits, decimals)} ${config.x402AssetSymbol}`;
  section(`verity — top up stake (+${display})`);

  const packageHash = require_(config, "signalOraclePackageHash", "Deploy SignalOracle first");
  const tokenPackageHash = require_(config, "x402AssetPackageHash", "Deploy X402Token first");
  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);

  const prior = loadStakeState();
  if (!prior) throw new Error("No stake state found — run `npm run enable:staking` first.");

  const liveBonded = await fetchLiveBondedBaseUnits();
  if (liveBonded === undefined) {
    log("warn", "Could not read live bonded amount; falling back to the local store, which does not track slashes.");
  } else {
    log("info", `Live bonded before top-up: ${stakeToDisplay(liveBonded, decimals)} ${config.x402AssetSymbol}`);
  }
  const bondedBefore = liveBonded ?? prior.bondedBaseUnits;

  const txs = [...prior.txs];
  const record = (label: string, r: { txHash: string; explorerUrl: string }) => {
    txs.push({ label, txHash: r.txHash, explorerUrl: r.explorerUrl, at: Date.now() });
    log("ok", `  ${label}: ${r.txHash}`);
    log("chain", `  ${r.explorerUrl}`);
  };

  log("chain", `1/2 approve (let the oracle contract pull ${display})...`);
  record("approve", await approveStakeOnChain({
    rpc, config, signer, tokenPackageHash, oraclePackageHash: packageHash, amountBaseUnits,
  }));

  log("chain", `2/2 stake (bond ${display})...`);
  record("stake", await stakeOnChain({ rpc, config, signer, packageHash, amountBaseUnits }));

  const bondedAfter = bondedBefore + amountBaseUnits;
  saveStakeState({ ...prior, bondedBaseUnits: bondedAfter, txs });

  section("stake topped up");
  log("ok", `Bonded ${stakeToDisplay(bondedBefore, decimals)} → ${stakeToDisplay(bondedAfter, decimals)} ${config.x402AssetSymbol}.`);
}

async function main(): Promise<void> {
  const amount = parseTopUp(process.argv);
  if (amount !== undefined) return topUp(amount);

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
