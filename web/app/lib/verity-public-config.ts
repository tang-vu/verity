/**
 * Public (non-secret) constants of the live verity testnet deployment, all
 * overridable via env. These are the same values documented in the README and
 * verifiable on testnet.cspr.live — nothing here is sensitive.
 */

const e = process.env;

/** SignalOracle v2 contract package (Odra, staking + slashing live). */
export const ORACLE_PACKAGE_HASH =
  e.SIGNAL_ORACLE_PACKAGE_HASH ?? "13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0";

/** X402Token (CEP-18 + CEP-3009 transfer_with_authorization) package. */
export const X402_TOKEN_PACKAGE_HASH =
  e.X402_ASSET_PACKAGE_HASH ?? "4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc";

/** Oracle (producer) account hash — the x402 payee and signal publisher. */
export const PRODUCER_ACCOUNT_HASH =
  e.PRODUCER_ACCOUNT_HASH ?? "971c1bd6ad47eff8cd815d53082a66e1246bf0ce09969c3dfca771c6a71d247d";

export const EXPLORER_BASE = e.NEXT_PUBLIC_EXPLORER_BASE ?? "https://testnet.cspr.live";

// x402 pricing of the paid signal endpoint (CEP-18 base units; 2 decimals).
export const X402_PRICE = e.X402_PRICE ?? "10";
export const X402_ASSET_NAME = e.X402_ASSET_NAME ?? "x402USD";
export const X402_ASSET_SYMBOL = e.X402_ASSET_SYMBOL ?? "x402";
export const X402_ASSET_VERSION = e.X402_ASSET_VERSION ?? "1";
export const X402_ASSET_DECIMALS = Number(e.X402_ASSET_DECIMALS ?? 2);
export const X402_NETWORK = e.X402_NETWORK ?? "casper:casper-test";
export const FACILITATOR_URL = e.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud";

// Public presence — the project's own channels. Overridable so the handle can
// change without a code edit.
export const GITHUB_URL = e.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/tang-vu/verity";
export const X_URL = e.NEXT_PUBLIC_X_URL ?? "https://x.com/tangvu_dev";
export const X_HANDLE = e.NEXT_PUBLIC_X_HANDLE ?? "@tangvu_dev";
export const DEMO_URL = e.NEXT_PUBLIC_DEMO_URL ?? "https://youtu.be/wp5KoLqxDU4";

export function txExplorerUrl(hash: string): string {
  return `${EXPLORER_BASE}/transaction/${hash}`;
}

export function contractExplorerUrl(packageHash: string): string {
  return `${EXPLORER_BASE}/contract-package/${packageHash}`;
}
