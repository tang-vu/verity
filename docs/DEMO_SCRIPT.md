# DEMO_SCRIPT — 2–3 min video walkthrough

Goal: show a real Casper testnet tx landing on cspr.live and the autonomous
agent-to-agent loop closing: **signal → x402 payment → reputation-weighted action**.

## Pre-roll setup (off-camera)

```bash
npm install
npm run keygen && npm run init-env       # generate + register keypairs
# paste DEEPSEEK_API_KEY + CSPR_CLOUD_ACCESS_TOKEN into .env
# fund both public keys at https://testnet.cspr.live/tools/faucet
cd contracts && cargo test && cargo odra build && cd ..
npm run deploy:sdk                        # deploy contract, writes package hash to .env
npm run seed                              # 4 resolved signals -> 75% reputation (real txs)
npm run web:dev                           # dashboard on http://localhost:3000
```

## On-camera (target ~2:30)

**0:00–0:20 — The thesis (dashboard open)**
> "This is verity. The big number is an oracle's reputation — its accuracy, recorded
> on-chain on Casper. Every signal it has ever made was later graded against reality.
> A DeFi agent is about to pay this oracle for a signal and risk capital in proportion
> to that number. No human in the loop."
- Point at the **reputation card (75%)** and the **signal history table** — each row
  links to a real testnet tx.

**0:20–0:50 — A fresh signal hits the chain**
```bash
npm run oracle:publish
```
> "The oracle agent pulls live CSPR market data, asks Claude for a calibrated
> directional call, and writes it on-chain."
- Show the terminal printing the **publish tx hash**. Click the cspr.live link.
- **Cut to cspr.live**: show the transaction succeeded on `casper-test`.
- Back to dashboard: the new signal appears at the top (auto-refresh).

**0:50–1:50 — The autonomous loop**
```bash
npm run oracle:serve    # (already running)
npm run agent:loop
```
Narrate each printed step as it appears:
> 1. "The consumer **discovers** the oracle over MCP."
> 2. "It hits the paywall — **HTTP 402** — signs an EIP-712 payment authorization,
>    and pays over **x402**. The Casper facilitator settles it on-chain."
> 3. "It reads the signal AND the oracle's **on-chain reputation**, and weights its
>    trade: notional = reputation × confidence. A poor oracle couldn't move capital."
> 4. "It executes the **reputation-weighted swap** via the CSPR.trade MCP server."
- Show the **x402 settlement tx** and the **swap tx** hashes; click one cspr.live link.

**1:50–2:20 — Close the loop on the dashboard**
- Switch to the dashboard **agent-loop panel**: the run is listed with the decision
  (`BUY/SELL/HOLD`), the reputation it used, and clickable tx links.
> "That's the whole machine economy in one loop: one agent sold a signal, another
> paid for it and acted on it, and the price of trust was set entirely by verifiable
> on-chain reputation."

**2:20–2:30 — One-liner outro**
> "verity — the trust layer for the agent economy, on Casper. One command runs the
> whole thing: `npm run demo`."

## Fallback (no funds / flaky network)

Everything except real txs runs offline:
```bash
npm run smoke:x402     # proves the x402 sign⇄verify round-trip end-to-end
npm run demo -- --offline
```
Use this to rehearse narration; switch to the funded path for the final take so real
tx hashes appear on cspr.live.

## Shot checklist
- [ ] cspr.live showing a `casper-test` tx as **Success**
- [ ] terminal printing publish + x402 settle + swap tx hashes
- [ ] dashboard reputation number + signal table with tx links
- [ ] dashboard agent-loop panel showing the closed loop
