/**
 * verity MCP server — exposes the reputation-staked oracle to ANY MCP-capable
 * agent (Claude, GPT, custom bots). This is the "open SDK" vision running now:
 * an agent discovers verity's tools, checks the oracle's on-chain track record
 * and live collateral for free, then BUYS the latest signal through the full
 * x402 flow (402 → EIP-712 signature → X-PAYMENT → unlocked data).
 *
 *   verity_get_reputation           free  — accuracy + bonded/slashed collateral
 *   verity_get_signal_history       free  — full audit trail (each row = real tx)
 *   verity_get_payment_requirements free  — machine-readable x402 price quote
 *   verity_buy_latest_signal        PAID  — pays x402 and returns the signal
 *
 * Transport is stdio, so hosts launch it directly:
 *   { "command": "npm", "args": ["run", "oracle:mcp"] }
 *
 * IMPORTANT: stdout belongs to the MCP protocol — diagnostics go to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  buildRequirements,
  computeReputation,
  directionLabel,
  loadConfig,
  loadPrivateKey,
  loadSignals,
  loadStakeState,
  payAndFetch,
  statusLabel,
} from "@verity/shared";

const config = loadConfig();

/** Wrap a JSON value as MCP text content. */
function jsonContent(value: unknown, isError = false) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }], isError };
}

/** Run a tool body, converting thrown errors into MCP error results. */
async function guarded(fn: () => Promise<unknown> | unknown) {
  try {
    return jsonContent(await fn());
  } catch (err) {
    return jsonContent({ error: err instanceof Error ? err.message : String(err) }, true);
  }
}

const server = new McpServer({ name: "verity-oracle", version: "0.1.0" });

server.registerTool(
  "verity_get_reputation",
  {
    title: "Get oracle reputation + collateral",
    description:
      "FREE. The oracle's verifiable on-chain track record: accuracy (basis points, 0-10000), " +
      "resolved/correct counts, and its bonded x402USD collateral (slashable on wrong calls). " +
      "Refuse to act on signals unless collateral is bonded above the minimum stake.",
  },
  async () =>
    guarded(() => {
      const signals = loadSignals();
      const pkg = config.signalOraclePackageHash ?? config.signalOracleContractHash ?? null;
      return {
        reputation: computeReputation(signals),
        stake: loadStakeState() ?? null,
        contract: pkg,
        explorer: pkg ? `${config.explorerBase}/contract-package/${pkg}` : null,
      };
    })
);

server.registerTool(
  "verity_get_signal_history",
  {
    title: "Get signal audit trail",
    description:
      "FREE. Every signal the oracle ever published, with resolution status " +
      "(CORRECT/WRONG/PENDING) and the real Casper testnet transaction hashes behind each row.",
  },
  async () =>
    guarded(() => {
      const signals = loadSignals().map((s) => ({
        ...s,
        directionLabel: directionLabel(s.direction),
        statusLabel: statusLabel(s.status),
      }));
      return { count: signals.length, signals };
    })
);

server.registerTool(
  "verity_get_payment_requirements",
  {
    title: "Get x402 price quote",
    description:
      "FREE. The machine-readable x402 payment requirements for the paid signal endpoint: " +
      "price, CEP-18 asset, payee, and network. This is what a paying agent signs over (EIP-712).",
  },
  async () =>
    guarded(() => ({
      x402Version: 1,
      accepts: [buildRequirements(config, `${config.oracleServerUrl}/signal/latest`)],
    }))
);

server.registerTool(
  "verity_buy_latest_signal",
  {
    title: "Buy the latest signal (x402)",
    description:
      `PAID (${config.x402Price} ${config.x402AssetSymbol} base units via x402). Executes the full ` +
      "machine payment: probes the oracle endpoint, receives HTTP 402, signs an EIP-712 " +
      "transfer_with_authorization with the consumer key, retries with X-PAYMENT, and returns " +
      "the unlocked signal + reputation + settlement proof. Requires `npm run oracle:serve` running.",
  },
  async () =>
    guarded(async () => {
      const signer = loadPrivateKey(config.consumerSecretKeyPath);
      const result = await payAndFetch<Record<string, unknown>>({
        url: `${config.oracleServerUrl}/signal/latest`,
        config,
        signer,
      });
      return { paid: result.paid, settlement: result.settlement ?? null, ...result.data };
    })
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
  console.error(`[verity-mcp] serving 4 tools over stdio (oracle: ${config.oracleServerUrl})`);
}

main().catch((err) => {
  console.error(`[verity-mcp] fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
