/**
 * Executes the reputation-weighted action on Casper testnet DeFi via the
 * CSPR.trade MCP server. Discovers the relevant trade tool from the server's
 * advertised toolset and calls it with the decided side + notional.
 *
 * If the MCP server is unreachable or exposes no compatible tool, the executor
 * records the intended action (no tx) so the autonomous loop still closes and
 * the demo shows the full decision path — the floor is never broken.
 */
import { log } from "@verity/shared";
import { callMcpTool, connectMcp, McpSession, pickTool } from "./mcp-client.js";
import type { ActionDecision } from "./reputation-weighted-action.js";

export interface SwapResult {
  executed: boolean;
  via: "cspr-trade-mcp" | "skipped" | "unavailable";
  toolUsed?: string;
  txHash?: string;
  explorerUrl?: string;
  detail: string;
  raw?: unknown;
}

const SWAP_TOOL_CANDIDATES = [
  "swap",
  "execute_swap",
  "trade",
  "execute_trade",
  "place_order",
  "create_order",
  "market_order",
];

/** Pull a Casper tx/deploy hash out of an arbitrary MCP tool result. */
function extractTxHash(result: unknown): string | undefined {
  const text = JSON.stringify(result ?? {});
  const m = text.match(/\b([0-9a-fA-F]{64})\b/);
  return m?.[1];
}

export async function executeReputationWeightedSwap(opts: {
  mcpUrl: string;
  accessToken?: string;
  decision: ActionDecision;
  baseAsset: string;
  explorerBase: string;
}): Promise<SwapResult> {
  const { decision } = opts;

  if (decision.side === "HOLD" || decision.notional <= 0) {
    return {
      executed: false,
      via: "skipped",
      detail: `HOLD — ${decision.rationale}`,
    };
  }

  let session: McpSession | undefined;
  try {
    session = await connectMcp({
      url: opts.mcpUrl,
      label: "cspr-trade",
      accessToken: opts.accessToken,
    });
    log("info", `CSPR.trade MCP connected — ${session.tools.length} tools available`);
  } catch (err) {
    return {
      executed: false,
      via: "unavailable",
      detail: `CSPR.trade MCP unreachable (${
        err instanceof Error ? err.message : String(err)
      }); decision was ${decision.side} ${decision.notional} ${opts.baseAsset}`,
    };
  }

  try {
    const tool = pickTool(session, SWAP_TOOL_CANDIDATES);
    if (!tool) {
      return {
        executed: false,
        via: "unavailable",
        detail: `No swap tool among [${session.tools
          .map((t) => t.name)
          .join(", ")}]; decision ${decision.side} ${decision.notional}`,
      };
    }

    log("chain", `Executing ${decision.side} via CSPR.trade tool "${tool}"...`);
    const raw = await callMcpTool(session, tool, {
      side: decision.side.toLowerCase(),
      amount: String(decision.notional),
      asset: opts.baseAsset,
      network: "casper-test",
    });

    const txHash = extractTxHash(raw);
    return {
      executed: true,
      via: "cspr-trade-mcp",
      toolUsed: tool,
      txHash,
      explorerUrl: txHash ? `${opts.explorerBase}/transaction/${txHash}` : undefined,
      detail: `${decision.side} ${decision.notional} ${opts.baseAsset} via ${tool}`,
      raw,
    };
  } finally {
    await session.close();
  }
}
