/**
 * Step-by-step testing instructions for buildathon judges — the final-round
 * checklist asks for "intuitive UI workflows … concise step-by-step testing
 * instructions". Everything here is doable in under two minutes.
 */
import { contractExplorerUrl, ORACLE_PACKAGE_HASH } from "../lib/verity-public-config";

const MCP_SNIPPET = `{ "mcpServers": { "verity": { "command": "npm", "args": ["run", "oracle:mcp"] } } }`;

export function JudgeTestingGuide() {
  return (
    <div className="card full">
      <h2>How to test verity in 3 steps</h2>
      <ol className="guide">
        <li>
          <strong>Verify the data is real.</strong>{" "}
          <span className="sub">
            Every number on this page is reconstructed live from Casper testnet. Click any tx hash — the
            publish/resolve/stake/slash transactions are on{" "}
            <a href={contractExplorerUrl(ORACLE_PACKAGE_HASH)} target="_blank" rel="noreferrer">
              the SignalOracle contract package
            </a>{" "}
            on cspr.live.
          </span>
        </li>
        <li>
          <strong>Buy the signal over x402.</strong>{" "}
          <span className="sub">
            Use the <a href="#try-it">Try it live</a> button (one click, real on-chain settlement) or{" "}
            <span className="mono">curl -i /api/x402/signal</span> to see the raw HTTP 402 challenge any
            agent would receive.
          </span>
        </li>
        <li>
          <strong>Plug it into your own agent.</strong>{" "}
          <span className="sub">
            verity ships an MCP server (4 tools: reputation, history, payment requirements — free; buy
            signal — paid via x402). Clone the repo and add to any MCP host:
          </span>
          <pre className="curl">{MCP_SNIPPET}</pre>
        </li>
      </ol>
      <p className="sub" style={{ margin: 0 }}>
        The economics in one line: the oracle bonds real collateral; a <strong>wrong call is slashed
        20%</strong> on-chain to a consumer-protection treasury, and the consumer agent sizes its trade by
        the oracle&apos;s verifiable accuracy — trust priced by track record, not promises.
      </p>
    </div>
  );
}
