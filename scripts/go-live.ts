/**
 * One-command testnet bring-up: checks the producer is funded, then runs the
 * full deploy → seed → publish chain, printing every tx hash + cspr.live link.
 * After it finishes, `npm run demo` closes the autonomous loop.
 *
 * Each step is a separate `npm run` (fresh process) so .env updates written by
 * one step (package hashes) are picked up by the next. Stops on the first failure.
 *
 * Run: `npm run go-live`
 */
import { spawn } from "node:child_process";
import { loadConfig, makeRpcClient, log, section } from "@verity/shared";
import pkg from "casper-js-sdk";
const { PublicKey, PurseIdentifier } = pkg as unknown as typeof import("casper-js-sdk");

function run(script: string): Promise<number> {
  return new Promise((resolve) => {
    log("info", `→ npm run ${script}`);
    const p = spawn("npm", ["run", script], { stdio: "inherit", shell: true });
    p.on("close", (code) => resolve(code ?? 1));
  });
}

async function producerCspr(): Promise<number> {
  const cfg = loadConfig();
  if (!cfg.producerPublicKeyHex) return 0;
  try {
    const rpc = makeRpcClient(cfg);
    const pub = PublicKey.fromHex(cfg.producerPublicKeyHex);
    const r = await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(pub));
    return Number(BigInt(r.balance?.toString?.() ?? "0") / 1_000_000_000n);
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  section("verity — go live on Casper testnet");

  const cspr = await producerCspr();
  log("info", `Producer balance: ${cspr} CSPR`);
  if (cspr < 50) {
    log("err", "Producer has < 50 CSPR. Fund it first, then re-run:");
    log("err", "  Send CSPR to the producer public key (see docs/DEPLOYMENT.md), then `npm run go-live`.");
    process.exit(1);
  }

  // Ordered pipeline; each step must succeed before the next. Staking is enabled
  // before seeding so the seed's deliberate miss produces a real on-chain slash;
  // the RWA feed publishes a second, tokenized-gold signal at the end.
  const steps = [
    "build:wasm",
    "deploy:sdk",
    "deploy:x402-token",
    "enable:staking",
    "seed",
    "oracle:publish",
    "oracle:publish-rwa",
  ];
  for (const step of steps) {
    const code = await run(step);
    if (code !== 0) {
      log("err", `Step "${step}" failed (exit ${code}). Fix and re-run go-live (completed steps are idempotent-ish).`);
      process.exit(code);
    }
  }

  section("go-live complete");
  log("ok", "Contract + x402 token deployed, reputation seeded, live signal published on-chain.");
  log("info", "All tx hashes + explorer links are printed above — copy them into docs/DEPLOYMENT.md.");
  log("info", "Now close the autonomous loop for the demo:  npm run demo");
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
