/**
 * Thin server-side client for the PUBLIC Casper testnet explorer API
 * (api.testnet.cspr.live — the same backend the cspr.live explorer frontend
 * queries, no access token required). It returns full deploy history for a
 * contract package with parsed runtime args, which is everything the dashboard
 * needs to reconstruct the oracle's on-chain state live.
 */

export interface DeployArg {
  cl_type: unknown;
  parsed: unknown;
}

export interface ExplorerDeploy {
  deploy_hash: string;
  block_height: number;
  caller_public_key: string;
  caller_hash: string;
  contract_package_hash: string;
  args: Record<string, DeployArg> | null;
  error_message: string | null;
  status: string;
  timestamp: string; // ISO-8601
  contract_entrypoint: { name: string } | null;
}

const API_BASE = process.env.EXPLORER_API_BASE ?? "https://api.testnet.cspr.live";
const PAGE_LIMIT = 100;
const MAX_PAGES = 10; // 1000 deploys is far beyond current activity

/** All deploys ever executed against a contract package (newest first). */
export async function fetchPackageDeploys(packageHash: string): Promise<ExplorerDeploy[]> {
  const all: ExplorerDeploy[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API_BASE}/deploys?contract_package_hash=${packageHash}&limit=${PAGE_LIMIT}&page=${page}`;
    const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`explorer API ${res.status} for contract package ${packageHash}`);
    const body = (await res.json()) as { item_count: number; data: ExplorerDeploy[] };
    all.push(...(body.data ?? []));
    if (all.length >= body.item_count || (body.data ?? []).length === 0) break;
  }
  return all;
}

/** Deploy executed without a revert (explorer reports error_message on revert). */
export function deploySucceeded(d: ExplorerDeploy): boolean {
  return d.error_message == null && d.status === "processed";
}

export function entryPointName(d: ExplorerDeploy): string {
  return d.contract_entrypoint?.name ?? "";
}

export function argString(d: ExplorerDeploy, name: string): string {
  return String(d.args?.[name]?.parsed ?? "");
}

export function argNumber(d: ExplorerDeploy, name: string): number {
  const n = Number(d.args?.[name]?.parsed ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function deployTimeMs(d: ExplorerDeploy): number {
  return Date.parse(d.timestamp);
}

/** Stable chronological order (timestamp is second-resolution, so tie-break). */
export function byChainOrder(a: ExplorerDeploy, b: ExplorerDeploy): number {
  return (
    deployTimeMs(a) - deployTimeMs(b) ||
    a.block_height - b.block_height ||
    a.deploy_hash.localeCompare(b.deploy_hash)
  );
}
