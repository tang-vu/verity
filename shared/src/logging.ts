/**
 * Tiny structured console logger + cspr.live explorer link helpers, so every
 * on-chain action the agents take prints a clickable proof link for the demo.
 */

const ICONS: Record<string, string> = {
  info: "•",
  ok: "✓",
  warn: "!",
  err: "✗",
  chain: "⛓",
  pay: "$",
  bot: "🤖",
};

export type LogKind = keyof typeof ICONS;

export function log(kind: LogKind, message: string): void {
  const icon = ICONS[kind] ?? "•";
  // eslint-disable-next-line no-console
  console.log(`${icon} ${message}`);
}

export function section(title: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${title} ===`);
}

/** Explorer link for a v2 transaction hash (casper-js-sdk v5 uses transactions). */
export function txLink(explorerBase: string, txHash: string): string {
  return `${explorerBase}/transaction/${txHash}`;
}

/** Explorer link for a legacy deploy hash. */
export function deployLink(explorerBase: string, deployHash: string): string {
  return `${explorerBase}/deploy/${deployHash}`;
}

export function accountLink(explorerBase: string, accountHashOrKey: string): string {
  return `${explorerBase}/account/${accountHashOrKey}`;
}

export function contractLink(explorerBase: string, contractHash: string): string {
  return `${explorerBase}/contract/${contractHash}`;
}
