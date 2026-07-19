/**
 * Pitch slides 6–10: skin in the game, Casper stack, judging criteria map,
 * launch plan, close. Static content — live numbers live in the story slides.
 */
import { X_HANDLE, X_URL } from "../lib/verity-public-config";
import type { PitchSlide } from "./pitch-slides-story";

const GITHUB = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/tang-vu/verity";
const EXPLORER = process.env.NEXT_PUBLIC_EXPLORER_BASE ?? "https://testnet.cspr.live";
const CONTRACT_URL = `${EXPLORER}/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0`;
const SLASH_TX_URL = `${EXPLORER}/transaction/4ae1e222a9234c0a3cd9d3c437af247d352ea0359f99fa98fc748b1b4ba79f11`;

export const CLOSE_SLIDES: PitchSlide[] = [
  {
    id: "slash",
    render: (s) => (
      <div>
        <p className="pitch-eyebrow">Skin in the game</p>
        <h1 className="pitch-h">
          When verity was wrong, it <span className="gold">paid</span> — on-chain.
        </h1>
        <p className="pitch-lede">
          The oracle bonded <strong>2,000 x402USD</strong> behind its feed. One resolved call missed
          — the contract slashed <strong>{s.slashedDisplay} x402USD</strong> straight into the
          consumer treasury.{" "}
          <a href={SLASH_TX_URL} target="_blank" rel="noreferrer">
            That slash is a real testnet transaction ↗
          </a>
        </p>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell gold-cell">
            <h3>Bad data pays its victims</h3>
            <p>Slashes route to a treasury owned by the consumer side — not burned, not pocketed.</p>
          </div>
          <div className="pitch-cell">
            <h3>No exit while pending</h3>
            <p>Collateral withdrawal is locked while any signal awaits grading. No hit-and-run.</p>
          </div>
          <div className="pitch-cell">
            <h3>Collateral floor</h3>
            <p>The consumer agent HOLDs if bonded stake falls below its floor — accuracy alone isn&apos;t enough.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "stack",
    render: () => (
      <div>
        <p className="pitch-eyebrow">Built deep on Casper</p>
        <h1 className="pitch-h">Every layer of the toolkit, used for real.</h1>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell">
            <h3>Odra smart contracts</h3>
            <p>SignalOracle (reputation + staking/slashing) — 26 passing tests, live on testnet.</p>
          </div>
          <div className="pitch-cell">
            <h3>x402 facilitator</h3>
            <p>CEP-18 + CEP-3009 gasless token; hosted CSPR.cloud facilitator settles every payment.</p>
          </div>
          <div className="pitch-cell">
            <h3>MCP everywhere</h3>
            <p>Discovers via Casper MCP, trades via CSPR.trade MCP — and ships its own verity MCP server.</p>
          </div>
          <div className="pitch-cell gold-cell">
            <h3>RWA feed</h3>
            <p>PAXG tokenized gold alongside CSPR/USD — build direction #2, verbatim.</p>
          </div>
          <div className="pitch-cell">
            <h3>casper-js-sdk v5</h3>
            <p>Deploys, contract calls, EIP-712 signing — the full agent path in TypeScript.</p>
          </div>
          <div className="pitch-cell hot">
            <h3>Open to any agent</h3>
            <p>4 MCP tools let ANY agent audit reputation free and buy the signal over x402.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "criteria",
    render: () => (
      <div>
        <p className="pitch-eyebrow">Scorecard</p>
        <h1 className="pitch-h">Eight criteria, eight receipts.</h1>
        <div className="pitch-grid cols-4">
          <div className="pitch-cell"><h3>Technical execution</h3><p>Live contracts, 26 tests, real settlements — not a mock anywhere.</p></div>
          <div className="pitch-cell"><h3>Innovation</h3><p>First reputation-staked x402 oracle: trust priced by slashable record.</p></div>
          <div className="pitch-cell"><h3>Agentic AI</h3><p>LLM oracle + autonomous consumer close a full loop, no human step.</p></div>
          <div className="pitch-cell"><h3>DeFi / RWA</h3><p>PAXG gold feed + reputation-weighted swaps on CSPR.trade.</p></div>
          <div className="pitch-cell"><h3>UX & design</h3><p>Live dashboard: one-click real x402 purchase in the browser.</p></div>
          <div className="pitch-cell"><h3>Working contracts</h3><p>Publish, grade, stake, slash — all verifiable on cspr.live.</p></div>
          <div className="pitch-cell"><h3>Launch plan</h3><p>Testnet → mainnet path with x402 credits funding real usage.</p></div>
          <div className="pitch-cell"><h3>Long-term impact</h3><p>A trust primitive every agent marketplace will need.</p></div>
        </div>
      </div>
    ),
  },
  {
    id: "launch",
    render: () => (
      <div>
        <p className="pitch-eyebrow">Where this goes</p>
        <h1 className="pitch-h">
          From one honest oracle to a <em>market</em> for machine trust.
        </h1>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell hot">
            <span className="no">now</span>
            <h3>Live on testnet</h3>
            <p>Oracle + agent + dashboard + MCP server running today; every claim auditable.</p>
          </div>
          <div className="pitch-cell">
            <span className="no">next</span>
            <h3>Mainnet + credits</h3>
            <p>Deploy to mainnet, spend x402 credits on real signal volume, grow the feed set.</p>
          </div>
          <div className="pitch-cell">
            <span className="no">then</span>
            <h3>Open oracle registry</h3>
            <p>Any publisher bonds collateral and sells data; consumers rank by slashable accuracy.</p>
          </div>
        </div>
        <p className="pitch-punch">Reputation you can slash is the only reputation machines can price.</p>
      </div>
    ),
  },
  {
    id: "close",
    render: () => (
      <div>
        <div className="pitch-wordmark">
          <span className="tick">✓</span>verity
        </div>
        <h1 className="pitch-h" style={{ marginTop: 26 }}>
          An oracle&apos;s word, <em>priced by its record</em>.
        </h1>
        <div className="cta" style={{ marginTop: 28 }}>
          <a className="btn primary" href="/">⚡ Live dashboard</a>
          <a className="btn" href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
          <a className="btn" href={X_URL} target="_blank" rel="noreferrer">𝕏 {X_HANDLE}</a>
          <a className="btn" href={CONTRACT_URL} target="_blank" rel="noreferrer">Contract on cspr.live ↗</a>
        </div>
        <p className="sub mono" style={{ marginTop: 26 }}>
          one command runs the whole machine economy: <span style={{ color: "var(--accent)" }}>npm run demo</span>
        </p>
      </div>
    ),
  },
];
