/**
 * Pitch slides 1–6: title, problem, solution, the autonomous loop, the
 * confidence-calibration fix, live proof.
 * Each slide is a render function receiving the live PitchStats.
 */
import type { ReactNode } from "react";
import type { PitchStats } from "./pitch-stats";

export interface PitchSlide {
  id: string;
  render: (stats: PitchStats) => ReactNode;
}

export const STORY_SLIDES: PitchSlide[] = [
  {
    id: "title",
    render: (s) => (
      <div>
        <p className="pitch-eyebrow">Casper Agentic Buildathon 2026 · Final Round · Innovation Track</p>
        <div className="pitch-wordmark">
          <span className="tick">✓</span>verity
        </div>
        <h1 className="pitch-h" style={{ marginTop: 26 }}>
          The <em>trust layer</em> for the machine economy, on Casper.
        </h1>
        <p className="pitch-lede">
          A reputation-staked x402 signal oracle — and an autonomous DeFi agent that pays it per
          signal and sizes its trades by the oracle&apos;s <strong>verifiable on-chain record</strong>.
        </p>
        <p className="sub mono" style={{ marginTop: 30 }}>
          {s.live ? "● numbers on these slides are live from casper-test" : "○ snapshot numbers — refresh to go live"}
        </p>
      </div>
    ),
  },
  {
    id: "problem",
    render: () => (
      <div>
        <p className="pitch-eyebrow">The problem</p>
        <h1 className="pitch-h">
          Agents are starting to trade on data bought from <em>other agents</em>.
        </h1>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell">
            <h3>No track record</h3>
            <p>An API&apos;s past accuracy is a marketing claim, not a verifiable fact.</p>
          </div>
          <div className="pitch-cell">
            <h3>No skin in the game</h3>
            <p>A wrong feed costs the consumer everything and the publisher nothing.</p>
          </div>
          <div className="pitch-cell">
            <h3>No price of trust</h3>
            <p>Machines can&apos;t negotiate credibility — they need it quoted, on-chain.</p>
          </div>
        </div>
        <p className="pitch-punch">Whose word can a machine trust — and what does that word cost?</p>
      </div>
    ),
  },
  {
    id: "solution",
    render: () => (
      <div>
        <p className="pitch-eyebrow">The solution</p>
        <h1 className="pitch-h">
          verity makes an oracle&apos;s word cost <em>exactly</em> its accuracy.
        </h1>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell hot">
            <span className="no">1</span>
            <h3>On-chain reputation</h3>
            <p>
              Every published call is later graded against reality by the contract. Accuracy lives
              on-chain — not in a pitch deck.
            </p>
          </div>
          <div className="pitch-cell gold-cell">
            <span className="no">2</span>
            <h3>Slashable collateral</h3>
            <p>
              The oracle bonds real x402USD behind its feed. A wrong call is slashed 20% into a
              consumer-protection treasury.
            </p>
          </div>
          <div className="pitch-cell hot">
            <span className="no">3</span>
            <h3>x402 pay-per-signal</h3>
            <p>
              HTTP 402 + EIP-712 authorization, settled on Casper by the hosted facilitator. Truth,
              sold by the query.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "loop",
    render: (s) => (
      <div>
        <p className="pitch-eyebrow">How it works — no human in the loop</p>
        <h1 className="pitch-h">One autonomous loop, four real transactions.</h1>
        <div className="pitch-grid cols-4">
          <div className="pitch-cell">
            <span className="no">1</span>
            <h3>Discover</h3>
            <p>The consumer agent finds the oracle over MCP — 82 Casper tools, zero config.</p>
          </div>
          <div className="pitch-cell">
            <span className="no">2</span>
            <h3>Pay</h3>
            <p>Hits the 402 paywall, signs EIP-712, the facilitator settles CEP-18 on-chain.</p>
          </div>
          <div className="pitch-cell">
            <span className="no">3</span>
            <h3>Weight</h3>
            <p>
              Trade size = accuracy × confidence, gated by bonded collateral. A poor oracle
              can&apos;t move capital.
            </p>
          </div>
          <div className="pitch-cell">
            <span className="no">4</span>
            <h3>Execute</h3>
            <p>Reputation-weighted swap via the CSPR.trade MCP server. Every hash on cspr.live.</p>
          </div>
        </div>
        <p className="pitch-lede" style={{ marginTop: 24 }}>
          Position size is a pure function of the chain:{" "}
          <strong>accuracy × confidence</strong>, gated by live bonded collateral. Today that
          accuracy is <strong>{s.accuracyPct}%</strong>, graded across {s.resolvedSignals} resolved
          calls — and the next slide is what we found wrong with the other half of that formula.
        </p>
      </div>
    ),
  },
  {
    id: "calibration",
    render: (s) => (
      <div>
        <p className="pitch-eyebrow">The bug we found in our own mechanic</p>
        <h1 className="pitch-h">
          Two of those three inputs were graded. <em>Confidence wasn&apos;t.</em>
        </h1>
        <div className="pitch-grid cols-3">
          <div className="pitch-cell">
            <h3>Accuracy</h3>
            <p>Graded by the contract, against reality. Can&apos;t be faked.</p>
          </div>
          <div className="pitch-cell gold-cell">
            <h3>Collateral</h3>
            <p>Slashed on-chain for wrong calls. Can&apos;t be faked.</p>
          </div>
          <div className="pitch-cell hot">
            <h3>Confidence</h3>
            <p>
              A number the oracle writes about <strong>itself</strong>&nbsp;— and it multiplied
              the position 1:1. Stamp 95% on everything, move more of the buyer&apos;s money, free.
            </p>
          </div>
        </div>
        <p className="pitch-lede" style={{ marginTop: 24 }}>
          So we grade it too. Every resolved call is scored against what was claimed on it, and the
          consumer discounts stated confidence by that record —{" "}
          <strong>overstating certainty shrinks the capital you can move next time</strong>.
        </p>
        <p className="pitch-punch">
          This oracle: claimed {s.claimedPct}%, delivered {s.deliveredPct}% over {s.resolvedSignals}{" "}
          graded calls · Brier {s.brier} → {s.calibrationVerdict.toLowerCase()}, {s.haircutPct}%
          haircut.
        </p>
      </div>
    ),
  },
  {
    id: "proof",
    render: (s) => (
      <div>
        <p className="pitch-eyebrow">{s.live ? "Live from casper-test — right now" : "From the on-chain snapshot"}</p>
        <div className="pitch-figure">
          {s.accuracyPct}
          <span className="unit">% accuracy</span>
        </div>
        <div className="pitch-grid cols-4" style={{ marginTop: 30 }}>
          <div className="pitch-cell">
            <h3 className="mono">{s.totalSignals} signals</h3>
            <p>published on-chain · CSPR/USD + PAXG gold (RWA)</p>
          </div>
          <div className="pitch-cell">
            <h3 className="mono">
              {s.correctSignals}/{s.resolvedSignals} correct
            </h3>
            <p>graded by the contract against later reality</p>
          </div>
          <div className="pitch-cell gold-cell">
            <h3 className="mono">{s.bondedDisplay} bonded</h3>
            <p>x402USD at risk · {s.slashedDisplay} already slashed for a miss</p>
          </div>
          <div className="pitch-cell hot">
            <h3 className="mono">{s.settledCount} settlements</h3>
            <p>real x402 payments · {s.revenueDisplay} x402USD revenue</p>
          </div>
        </div>
        <p className="pitch-lede" style={{ marginTop: 24 }}>
          Every number is <strong>reconstructed live from the public explorer API</strong> — judges
          can audit each one, transaction by transaction.
        </p>
      </div>
    ),
  },
];
