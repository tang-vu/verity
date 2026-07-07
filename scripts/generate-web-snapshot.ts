/**
 * Snapshot the current testnet data (signals, reputation, loop log) into
 * web/data/oracle-snapshot.json so the dashboard runs standalone on Vercel —
 * no oracle server needed. All values are real on-chain testnet data; the
 * dashboard becomes a read-only snapshot. Re-run to refresh after new activity.
 *
 * Run: node --import tsx scripts/generate-web-snapshot.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeReputation,
  directionLabel,
  loadConfig,
  loadLoopLog,
  loadSignals,
  loadStakeState,
  statusLabel,
} from "@verity/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig();
const signals = loadSignals();
const pkg = cfg.signalOraclePackageHash ?? cfg.signalOracleContractHash ?? null;

const snapshot = {
  generatedAt: new Date().toISOString(),
  signals: signals.map((s) => ({ ...s, directionLabel: directionLabel(s.direction), statusLabel: statusLabel(s.status) })),
  reputation: computeReputation(signals),
  stake: loadStakeState() ?? null,
  x402: { priceBaseUnits: cfg.x402Price, symbol: cfg.x402AssetSymbol, decimals: cfg.x402AssetDecimals },
  contract: pkg,
  explorer: pkg ? `${cfg.explorerBase}/contract-package/${pkg}` : null,
  loopLog: loadLoopLog().slice().reverse(),
};

const outDir = resolve(root, "web/data");
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, "oracle-snapshot.json");
writeFileSync(out, JSON.stringify(snapshot, null, 2));
console.log(`snapshot written: ${out}`);
console.log(`  ${snapshot.signals.length} signals · reputation ${(snapshot.reputation.accuracyBps / 100).toFixed(1)}% · ${snapshot.loopLog.length} loop runs`);
