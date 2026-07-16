/**
 * Step-by-step testing instructions for buildathon judges — the final-round
 * checklist asks for "intuitive UI workflows … concise step-by-step testing
 * instructions". Serif ghost numerals, hairline dividers, no card chrome.
 */
import { contractExplorerUrl, ORACLE_PACKAGE_HASH } from "../lib/verity-public-config";

const MCP_SNIPPET = `{ "mcpServers": { "verity": { "command": "npm", "args": ["run", "oracle:mcp"] } } }`;

export function JudgeTestingGuide() {
  return (
    <div className="section">
      <p className="klabel">how to test verity in three steps</p>
      <div className="guide-grid">
        <div className="guide-step">
          <div className="guide-no">01</div>
          <h3>Verify the data is real</h3>
          <p className="sub">
            Every number on this page is reconstructed live from Casper testnet on load. Click any tx
            hash — publish, resolve, stake and slash transactions all sit on{" "}
            <a href={contractExplorerUrl(ORACLE_PACKAGE_HASH)} target="_blank" rel="noreferrer">
              the SignalOracle package
            </a>{" "}
            on cspr.live.
          </p>
        </div>
        <div className="guide-step">
          <div className="guide-no">02</div>
          <h3>Buy the signal over x402</h3>
          <p className="sub">
            One click in the <a href="#try-it">terminal above</a> runs the full paid flow with a real
            on-chain settlement — or <span className="mono">curl -i /api/x402/signal</span> to see the
            raw HTTP 402 challenge any agent receives.
          </p>
        </div>
        <div className="guide-step">
          <div className="guide-no">03</div>
          <h3>Plug it into your own agent</h3>
          <p className="sub">
            verity ships an MCP server — reputation, history and payment requirements are free tools;
            buying the signal runs the same x402 flow. One line in any MCP host:
          </p>
          <pre style={{ margin: "8px 0 0" }}>{MCP_SNIPPET}</pre>
        </div>
      </div>
      <p className="sub" style={{ marginTop: 16, maxWidth: "78ch" }}>
        The economics in one line: the oracle bonds real collateral, a <b style={{ color: "var(--down)" }}>wrong
        call is slashed 20%</b> on-chain into a consumer-protection treasury, and the consumer agent sizes
        its trade by the oracle&apos;s verifiable accuracy — trust priced by track record, not promises.
      </p>
    </div>
  );
}
