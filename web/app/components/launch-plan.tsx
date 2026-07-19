/**
 * Launch plan — what ships next, how the thing makes money, and where to follow
 * the project. Deliberately concrete: every "now" item is verifiable on this
 * page or on cspr.live, so the forward-looking column reads as a continuation
 * rather than a wish list.
 */
import { GITHUB_URL, X_HANDLE, X_URL, X402_ASSET_NAME, X402_PRICE } from "../lib/verity-public-config";

type Phase = {
  when: string;
  state: "live" | "next" | "planned";
  title: string;
  items: string[];
};

const PHASES: Phase[] = [
  {
    when: "now",
    state: "live",
    title: "Live on Casper testnet",
    items: [
      "SignalOracle v2 with bonded collateral, on-chain grading and 20% slashing",
      "Autonomous LLM oracle + consumer agent closing the loop with no human step",
      "Paid signal API over x402, settled by the hosted CSPR.cloud facilitator",
      "MCP server so any agent can audit the record free and buy a call",
    ],
  },
  {
    when: "next",
    state: "next",
    title: "Mainnet beta",
    items: [
      "Deploy SignalOracle + x402 asset to Casper mainnet, same contracts",
      "Stablecoin-denominated pricing and a published uptime/latency page",
      "Widen the feed set: more RWA pairs alongside CSPR/USD and PAXG",
      "Spend buildathon x402 credits on real consumer volume, not demo traffic",
    ],
  },
  {
    when: "then",
    state: "planned",
    title: "Open publisher registry",
    items: [
      "Any publisher bonds collateral and lists a feed; consumers rank by slashable accuracy",
      "Consumer-protection treasury pays out to agents burned by a wrong call",
      "Reputation reads exposed as a free public good — only the data itself is paid",
    ],
  },
  {
    when: "later",
    state: "planned",
    title: "A portable trust layer",
    items: [
      "Client SDK + subscription tiers on top of the per-call primitive",
      "Reputation portable across agent marketplaces beyond price feeds",
    ],
  },
];

export function LaunchPlan() {
  return (
    <div className="section" id="launch-plan">
      <p className="klabel">launch plan · this is a project, not a demo</p>
      <div className="lp-grid">
        {PHASES.map((p) => (
          <div key={p.when} className={`lp-phase ${p.state}`}>
            <div className="lp-head">
              <span className="lp-when">{p.when}</span>
              <span className={`lp-state ${p.state}`}>
                {p.state === "live" ? "shipped" : p.state === "next" ? "in progress" : "planned"}
              </span>
            </div>
            <h3>{p.title}</h3>
            <ul className="lp-items">
              {p.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="lp-foot">
        <p className="sub" style={{ margin: 0, maxWidth: "62ch" }}>
          <b style={{ color: "var(--ink)" }}>How it earns:</b> every signal is sold per call over x402 —{" "}
          <span className="mono">{`${X402_PRICE} ${X402_ASSET_NAME}`}</span> today, settled on-chain to the producer account. The registry adds a take rate on other
          publishers&apos; sales; reputation reads stay free forever.
        </p>
        <div className="lp-social">
          <span className="sub dim">Follow the build</span>
          <a className="btn" href={X_URL} target="_blank" rel="noreferrer">
            X · {X_HANDLE} ↗
          </a>
          <a className="btn" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub ↗
          </a>
        </div>
      </div>
    </div>
  );
}
