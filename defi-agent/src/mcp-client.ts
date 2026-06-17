/**
 * Minimal MCP (Model Context Protocol) client over Streamable HTTP, used by the
 * DeFi agent to (a) DISCOVER the oracle/chain via the Casper MCP server and
 * (b) EXECUTE swaps via the CSPR.trade MCP server. Connections are best-effort:
 * if a server is unreachable, callers fall back so the loop still closes.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export interface McpToolInfo {
  name: string;
  description?: string;
}

export interface McpSession {
  client: Client;
  tools: McpToolInfo[];
  close: () => Promise<void>;
}

/** Connect to an MCP server, returning the session + its advertised tools. */
export async function connectMcp(opts: {
  url: string;
  label: string;
  accessToken?: string;
  timeoutMs?: number;
}): Promise<McpSession> {
  const headers: Record<string, string> = {};
  if (opts.accessToken) headers.Authorization = opts.accessToken;

  const transport = new StreamableHTTPClientTransport(new URL(opts.url), {
    requestInit: { headers },
  });
  const client = new Client({ name: `verity-${opts.label}`, version: "0.1.0" });

  const timeout = opts.timeoutMs ?? 15_000;
  await withTimeout(client.connect(transport), timeout, `connect ${opts.label}`);

  const listed = await withTimeout(client.listTools(), timeout, `listTools ${opts.label}`);
  const tools: McpToolInfo[] = (listed.tools ?? []).map((t) => ({
    name: t.name,
    description: t.description,
  }));

  return {
    client,
    tools,
    close: async () => {
      try {
        await client.close();
      } catch {
        /* ignore */
      }
    },
  };
}

/** Call an MCP tool and return the parsed result content. */
export async function callMcpTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<unknown> {
  const result = await withTimeout(
    session.client.callTool({ name, arguments: args }),
    timeoutMs,
    `callTool ${name}`
  );
  return result;
}

/** Find the first advertised tool whose name matches any of the candidates. */
export function pickTool(session: McpSession, candidates: string[]): string | undefined {
  const names = session.tools.map((t) => t.name.toLowerCase());
  for (const c of candidates) {
    const hit = session.tools.find((t) => t.name.toLowerCase() === c.toLowerCase());
    if (hit) return hit.name;
  }
  // Fuzzy: any tool containing a candidate substring.
  for (const c of candidates) {
    const idx = names.findIndex((n) => n.includes(c.toLowerCase()));
    if (idx >= 0) return session.tools[idx]!.name;
  }
  return undefined;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`MCP timeout after ${ms}ms: ${what}`)), ms)
    ),
  ]);
}
