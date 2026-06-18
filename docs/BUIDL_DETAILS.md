# verity — the trust layer for the machine economy, on Casper

**An oracle's word is worth exactly its on-chain accuracy.** verity is a reputation-staked x402 signal oracle plus an autonomous DeFi agent that trusts it only as far as its verifiable, on-chain track record. Built for the Casper Agentic Buildathon 2026 — and matching **Build Direction #2** (RWA Oracle Agents with verifiable on-chain reputation) almost exactly.

## The problem

Agent-to-agent commerce is coming, but agents have no native way to decide *whose data to trust*. Today an AI agent buying a signal from another agent has to take the seller's word for it — a paid data feed can be confidently wrong forever and never pay a price. That doesn't scale to a machine economy.

## How it works

verity is two cooperating autonomous agents and two smart contracts on Casper testnet:

1. **Oracle Agent (producer)** — fetches real market data (CoinGecko), uses an LLM (DeepSeek) to produce a directional signal with a *calibrated* confidence + reasoning, and writes it on-chain. The `SignalOracle` Odra contract stores each signal and maintains a **tamper-proof reputation score** for the oracle that updates as past signals resolve against reality. The latest signal sits behind an **x402 paywall**.

2. **DeFi Agent (consumer)** — autonomously **discovers** the oracle via MCP, **pays** the x402 fee (settled on-chain by the Casper facilitator), reads the signal, **weights its action by the oracle's on-chain reputation**, then executes a **swap** on Casper DeFi via the **CSPR.trade MCP** — no human in the loop. Every step prints a real tx hash with a cspr.live link.

## The novel mechanic

The consumer's capital-at-risk is a pure function of the oracle's verifiable reputation:

> **notional = max_size × on-chain_accuracy × signal_confidence**

A poor or unproven oracle literally *cannot move much capital*; an oracle below the reputation gate is ignored entirely. This makes truth machine-priced and trust-minimized — reputation is non-transferable and slow to build, so honest, long-lived oracles accrue durable on-chain pricing power.

## Live on Casper testnet (`casper-test`) — all real transactions

| What | On-chain proof |
|---|---|
| SignalOracle contract (Odra) | [`e6a502b9…f79167`](https://testnet.cspr.live/contract-package/e6a502b9c5002c921a6d4612588abcff1157689db2eabbba1ed8b62f51f79167) |
| X402Token (CEP-18 + CEP-3009 + CEP-2612) | [`4373bc32…c128cc`](https://testnet.cspr.live/contract-package/4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc) |
| Live LLM signal (CoinGecko → DeepSeek → on-chain) | [`d1fa67bc…`](https://testnet.cspr.live/transaction/d1fa67bc38701082915427877d8a26e24df32c49291db92b02fd07a5adb5e3a6) |
| x402 settled on-chain (`transfer_with_authorization`) | [`0ee181dc…`](https://testnet.cspr.live/transaction/0ee181dc4b5356dd5ef0fbcdc15a783023144605e361202b869de5246896f99b) |
| On-chain reputation | **75%** — 3/4 resolved correct, from 8 publish/resolve txs |

## Casper AI toolkit — every piece used, all real (not mocked)

| Toolkit piece | How verity uses it |
|---|---|
| **Odra** smart contracts | `SignalOracle` (signals + reputation) and `X402Token` deployed on testnet |
| **x402** | Pay-per-signal: HTTP 402 → EIP-712 signed authorization → on-chain settlement |
| **x402 Facilitator** | Verifies the payment and submits the CEP-18 transfer on-chain (pays gas) |
| **Casper MCP** (82 tools) | The consumer discovers the oracle / chain state |
| **CSPR.trade MCP** (23 tools) | The consumer executes the reputation-weighted swap |
| **Typed-data signing (EIP-712)** | `transfer_with_authorization` over a CEP-18 token — gasless, verifiable |
| **LLM** (DeepSeek) | Generates the calibrated, strict-JSON market signal |

## Architecture

```
 real data (CoinGecko)            Casper testnet
        │              ┌───────────────────────────────────┐
        ▼              │  SignalOracle (Odra)               │
  ┌───────────┐  write │   signals[] + reputation(bps)      │
  │ ORACLE    │───────▶│  X402Token (CEP-18/3009/2612)      │
  │ agent+LLM │        └───────────────────────────────────┘
  │ + x402    │ HTTP402        ▲ read rep      ▲ settle CEP-18
  │  server   │◀───────┐       │               │ (facilitator)
  └───────────┘ X-PAYMENT│  ┌───────────┐   ┌──────────────┐
        │ signal         └──│ CONSUMER  │   │ x402         │
        └──────────────────▶│ DeFi agent│──▶│ Facilitator  │
                            │ weight by │   └──────────────┘
                            │ reputation│──▶ CSPR.trade MCP → swap
                            └───────────┘
```

## Tech stack

- **Contracts:** Rust + Odra 2.8 (`SignalOracle`, `X402Token`), tested with `odra_test` (17 tests), deployed to testnet.
- **Agents / x402 / MCP / dashboard:** TypeScript + Node. Official `@casper-ecosystem/casper-eip-712`, `casper-js-sdk` v5, MCP SDK, DeepSeek (OpenAI-compatible).
- **Dashboard:** Next.js — live reputation chart, signal history (each row links to its cspr.live tx), and the autonomous loop log.

## Demo video

A 63-second walkthrough — the autonomous `agent:loop` running live, then the dashboard with on-chain reputation, signals, and the loop log. *(Embed your YouTube link here.)*

## Long-term launch plan

verity is the first member of an **x402 "verifiable data products" family** — paid, machine-bought data feeds whose price is backed by on-chain reputation.

- **Who pays:** autonomous DeFi agents, trading bots, treasury managers, and other oracles wanting a reputation-weighted second opinion. Every read is a micropayment.
- **Roadmap:** (1) now — single oracle/consumer, CSPR/USD, testnet · (2) multi-oracle marketplace with staking/slashing so oracles post bond against accuracy · (3) RWA feeds (tokenized treasury/commodity valuations) on mainnet x402 · (4) open SDK so any agent can publish or consume reputation-staked feeds.
- **Moat:** reputation is non-transferable and slow to build — a durable, on-chain trust primitive.

## Links

- **GitHub (open-source, MIT):** https://github.com/tang-vu/verity
- **Release + demo video:** https://github.com/tang-vu/verity/releases/tag/v1.0.0
- **Full deployment record:** [`docs/DEPLOYMENT.md`](https://github.com/tang-vu/verity/blob/main/docs/DEPLOYMENT.md)

*All code original and newly developed for the Casper Agentic Buildathon 2026.*
