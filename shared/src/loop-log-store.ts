/**
 * Append-only log of autonomous loop runs (one entry per consumer cycle), so the
 * dashboard can render the live agent-to-agent loop with clickable tx links.
 * Stored alongside the signal store under loop-output/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export interface LoopLogEntry {
  at: number; // ms epoch
  signalId: number;
  directionLabel: string;
  confidence: number;
  reputationBps: number;
  decisionSide: string; // BUY | SELL | HOLD
  decisionNotional: number;
  decisionRationale: string;
  paid: boolean;
  settlementTx?: string;
  settlementExplorerUrl?: string;
  swapVia: string;
  swapTx?: string;
  swapExplorerUrl?: string;
  swapDetail: string;
}

function logPath(): string {
  return resolve(process.env.VERITY_LOOPLOG_PATH ?? "./loop-output/loop-log.json");
}

export function loadLoopLog(): LoopLogEntry[] {
  const path = logPath();
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf8")) as LoopLogEntry[];
  } catch {
    return [];
  }
}

export function appendLoopLog(entry: LoopLogEntry): void {
  const path = logPath();
  mkdirSync(dirname(path), { recursive: true });
  const all = loadLoopLog();
  all.push(entry);
  writeFileSync(path, JSON.stringify(all, null, 2));
}
