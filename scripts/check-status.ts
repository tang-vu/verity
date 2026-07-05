/**
 * Pre-flight status: producer/consumer CSPR balances + configured package hashes,
 * so a live bring-up (deploy → enable:staking → seed) is only attempted when the
 * producer can actually pay for it. Reads .env via loadConfig (no secrets printed).
 *
 * Run: `npm run status`.
 */
import { loadConfig, loadPrivateKey, log, makeRpcClient, section } from "@verity/shared";
import pkg from "casper-js-sdk";
const { PurseIdentifier } = pkg as unknown as typeof import("casper-js-sdk");

async function cspr(rpc: ReturnType<typeof makeRpcClient>, pub: import("casper-js-sdk").PublicKey): Promise<number> {
  try {
    const r = await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(pub));
    return Number(BigInt(r.balance?.toString?.() ?? "0") / 1_000_000_000n);
  } catch (e) {
    log("warn", `balance query failed: ${e instanceof Error ? e.message : e}`);
    return -1;
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  section("verity — status");

  const rpc = makeRpcClient(cfg);
  const producer = loadPrivateKey(cfg.producerSecretKeyPath);
  const consumer = loadPrivateKey(cfg.consumerSecretKeyPath);

  const pBal = await cspr(rpc, producer.publicKey);
  const cBal = await cspr(rpc, consumer.publicKey);

  log("info", `Producer ${producer.publicKey.toHex().slice(0, 10)}…  balance: ${pBal} CSPR`);
  log("info", `Consumer ${consumer.publicKey.toHex().slice(0, 10)}…  balance: ${cBal} CSPR`);
  log("info", `SIGNAL_ORACLE_PACKAGE_HASH: ${cfg.signalOraclePackageHash ?? "(unset)"}`);
  log("info", `X402_ASSET_PACKAGE_HASH:    ${cfg.x402AssetPackageHash ?? "(unset)"}`);
  log("info", `CSPR_CLOUD_ACCESS_TOKEN:    ${cfg.csprCloudAccessToken ? "set" : "(unset)"}`);
  log("info", `DEEPSEEK/LLM key:           ${cfg.llmApiKey ? "set" : "(unset)"}`);
  log("info", `RPC: ${cfg.nodeRpcUrl}`);

  const ready = pBal >= 50 && !!cfg.x402AssetPackageHash;
  log(ready ? "ok" : "warn", ready
    ? "Ready for live staking bring-up (deploy:sdk → enable:staking → seed)."
    : "Not ready: fund the producer (>=50 CSPR) and/or set X402_ASSET_PACKAGE_HASH.");
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
