/**
 * One-command demo: spins up the oracle x402 server in-process, then runs the
 * full autonomous consumer loop against it (discover → pay x402 → weight by
 * reputation → swap), printing every tx hash + explorer link. For the video.
 *
 * Modes:
 *   - Full (default): real testnet — requires deployed contract + funded keys +
 *     secrets. Publishes a fresh signal first if none exist.
 *   - Offline (`--offline` or when SIGNAL_ORACLE_PACKAGE_HASH is unset): uses the
 *     existing local signal store + verified-deferred x402 so the loop still
 *     closes end-to-end for a dry-run / CI without funds.
 *
 * Run: `npm run demo` (add `-- --offline` to force the no-funds path).
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import {
  computeReputation,
  loadConfig,
  loadSignals,
  log,
  section,
} from "@verity/shared";

const offline = process.argv.includes("--offline");

async function waitForHealth(url: string, timeoutMs = 15_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "inherit", shell: true });
    p.on("close", (code) => resolve(code ?? 1));
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — one-command demo");
  log("info", offline ? "Mode: OFFLINE (no funds; local store + verified-deferred x402)" : "Mode: FULL (real testnet)");

  const signals = loadSignals();
  const rep = computeReputation(signals);
  log("info", `Local history: ${signals.length} signals, reputation ${(rep.accuracyBps / 100).toFixed(1)}%`);

  // In FULL mode, ensure there's at least one live signal to read.
  if (!offline && config.signalOraclePackageHash) {
    if (signals.length === 0) {
      log("bot", "No signals yet — publishing a fresh one on-chain...");
      const code = await run("npm", ["run", "oracle:publish"]);
      if (code !== 0) log("warn", "publish failed; continuing with whatever is in the store");
    }
  } else if (!offline) {
    log("warn", "SIGNAL_ORACLE_PACKAGE_HASH unset — falling back to OFFLINE behaviour.");
  }

  // 1. Start the oracle server.
  log("info", "Starting oracle x402 server...");
  const server = spawn("npm", ["run", "oracle:serve"], { stdio: "inherit", shell: true });

  try {
    const healthy = await waitForHealth(config.oracleServerUrl);
    if (!healthy) throw new Error(`oracle server did not become healthy at ${config.oracleServerUrl}`);
    log("ok", "Oracle server is up.");

    // 2. Run the autonomous loop.
    section("running autonomous loop");
    const code = await run("npm", ["run", "agent:loop"]);
    if (code !== 0) throw new Error(`agent loop exited with code ${code}`);

    section("demo complete");
    log("ok", "Full loop ran: signal → x402 payment → reputation-weighted action.");
    log("info", "Tx hashes + explorer links are printed above and in docs/DEPLOYMENT.md.");
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
