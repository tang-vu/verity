# verity — the trust layer for the machine economy, on Casper

**An oracle bonds real collateral behind its word — worth exactly its on-chain accuracy, and slashed on-chain when it's wrong.** verity is a reputation-staked x402 signal oracle plus an autonomous DeFi agent that trusts it only as far as its verifiable, on-chain track record. Built for the Casper Agentic Buildathon 2026 — matching **Build Direction #2** (RWA Oracle Agents with verifiable on-chain reputation) almost exactly.

## The problem

Agent-to-agent commerce is coming, but agents have no native way to decide *whose data to trust*. Today an AI agent buying a signal from another agent has to take the seller's word for it — a paid data feed can be confidently wrong forever and never pay a price. That doesn't scale to a machine economy.

## How it works

verity is two cooperating autonomous agents and two smart contracts on Casper testnet:

1. **Oracle Agent (producer)** — fetches real market data (CoinGecko — CSPR/USD **and PAXG, tokenized gold, a genuine real-world asset**), uses an LLM (DeepSeek) to produce a directional signal with a *calibrated* confidence + reasoning, and writes it on-chain. The `SignalOracle` Odra contract stores each signal, maintains a **tamper-proof reputation score**, and holds the oracle's **bonded collateral (x402USD)**. The latest signal sits behind an **x402 paywall**.

2. **DeFi Agent (consumer)** — autonomously **discovers** the oracle via MCP, **pays** the x402 fee (settled on-chain by the Casper facilitator), reads the signal, **weights its action by the oracle's on-chain reputation — and refuses any oracle without real collateral at risk** — then executes a **swap** on Casper DeFi via the **CSPR.trade MCP**. No human in the loop; every step prints a real tx hash with a cspr.live link.

## The novel mechanic — reputation as *slashable collateral*

The oracle bonds real capital (x402USD) behind its calls. A wrong resolution **slashes 20% of that bond on-chain**, routed to a consumer-protection treasury — *bad data literally pays out to the agents it could have misled*. The consumer's capital-at-risk is then a pure function of that verifiable reputation:

> **notional = max_size × on-chain_accuracy × signal_confidence** — gated on the oracle holding real bonded collateral.

A poor, unproven, or **undercollateralized** oracle literally *cannot move capital*. Reputation is non-transferable and slow to build, so honest, long-lived oracles accrue durable on-chain pricing power. Truth becomes machine-priced, trust-minimized, and collateral-backed.

## Live on Casper testnet (`casper-test`) — all real transactions

| What | On-chain proof |
|---|---|
| SignalOracle v2 (Odra, staking) | [`13b217e5…14ffd0`](https://testnet.cspr.live/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0) |
| X402Token (CEP-18 + CEP-3009 + CEP-2612) | [`4373bc32…c128cc`](https://testnet.cspr.live/contract-package/4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc) |
| Oracle bonds **2000 x402USD** collateral | [`46a5d9b1…`](https://testnet.cspr.live/transaction/46a5d9b1a1f1dea027ae1bdca25f55e427879e7cdbc08714c753b11ac5ff0c78) |
| **On-chain SLASH** — a wrong call burns **400 x402USD** → consumer treasury | [`4ae1e222…`](https://testnet.cspr.live/transaction/4ae1e222a9234c0a3cd9d3c437af247d352ea0359f99fa98fc748b1b4ba79f11) |
| Live LLM signal — CSPR/USD (FLAT @ 45%) | [`d9fb786f…`](https://testnet.cspr.live/transaction/d9fb786f3f5b35649d7f4a12054e14df83702f20a15de322560dff64d298071f) |
| Live LLM signal — **PAXG tokenized gold (RWA, FLAT @ 65%)** | [`a11dcebb…`](https://testnet.cspr.live/transaction/a11dcebba120bb2f20bad80fb1b2ce26bfc715afadb532fdf6d0b3d352219dcd) |
| x402 settled on-chain (facilitator `transfer_with_authorization`) | [`296f5f66…`](https://testnet.cspr.live/transaction/296f5f667c05364883b24ed680bcb47df68faa6fc85dead2d45e7742cfb110f8) |
| On-chain reputation | **75%** — 3/4 resolved correct |

## Casper AI toolkit — every piece used, all real (not mocked)

| Toolkit piece | How verity uses it |
|---|---|
| **Odra** smart contracts | `SignalOracle` (signals + reputation + **staking/slashing**) and `X402Token`, deployed on testnet |
| **x402** | Pay-per-signal: HTTP 402 → EIP-712 signed authorization → on-chain settlement |
| **x402 Facilitator** | Verifies the payment and submits the CEP-18 transfer on-chain (pays gas) |
| **Casper MCP** (82 tools) | The consumer discovers the oracle / chain state |
| **CSPR.trade MCP** | The consumer executes the reputation-weighted swap |
| **Typed-data signing (EIP-712)** | `transfer_with_authorization` over a CEP-18 token — gasless, verifiable |
| **LLM** (DeepSeek) | Generates the calibrated, strict-JSON market signal |

## Architecture

    real data (CoinGecko)               Casper testnet
          │                 ┌──────────────────────────────────────┐
          ▼                 │  SignalOracle (Odra)                  │
    ┌───────────┐   write   │   signals[] + reputation(bps)         │
    │ ORACLE    │──────────▶│   + bonded stake / on-chain slashing  │
    │ agent+LLM │           │  X402Token (CEP-18 / 3009 / 2612)     │
    │ + x402    │  HTTP 402  └──────────────────────────────────────┘
    │  server   │◀───────┐        ▲ read rep+stake     ▲ settle CEP-18
    └───────────┘ X-PAYMENT│   ┌───────────┐        ┌──────────────┐
          │ signal         └───│ CONSUMER  │        │ x402         │
          └───────────────────▶│ DeFi agent│───────▶│ Facilitator  │
                               │ weight by │        └──────────────┘
                               │ rep + bond│──▶ CSPR.trade MCP → swap
                               └───────────┘

## Tech stack

- **Contracts:** Rust + Odra 2.8 (`SignalOracle` with staking/slashing, `X402Token`), **26 tests** (contract + agent, incl. cross-contract collateral flow), deployed to testnet.
- **Agents / x402 / MCP / dashboard:** TypeScript + Node. Official `@casper-ecosystem/casper-eip-712`, `casper-js-sdk` v5, MCP SDK, DeepSeek (OpenAI-compatible).
- **Dashboard:** Next.js — on-chain reputation, a **bonded-collateral card**, signal history (each row links to its cspr.live tx), and the autonomous loop log.

## Demo video

**▶️ https://youtu.be/wp5KoLqxDU4** — a ~77-second walkthrough: on-chain proof (SignalOracle v2 with staking, the real on-chain slash, the PAXG/RWA signal) → the autonomous `agent:loop` running live (x402 payment + reputation + bonded-collateral gate) → the live dashboard. MiMo TTS voiceover + burned-in captions.

## Long-term launch plan

verity is the first member of an **x402 "verifiable data products" family** — paid, machine-bought data feeds whose price is backed by on-chain reputation.

- **Who pays:** autonomous DeFi agents, trading bots, treasury managers, and other oracles wanting a reputation-weighted second opinion. Every read is a micropayment.
- **Roadmap:** (1) **now** — oracle + consumer; CSPR/USD **and PAXG (RWA)**; **staking + on-chain slashing live**; testnet · (2) multi-oracle marketplace, consumers pick by reputation *and* live bond · (3) more RWA feeds (tokenized treasury/commodity NAVs) on mainnet x402 · (4) open SDK so any agent can publish or consume reputation-staked feeds.
- **Moat:** reputation is non-transferable and slow to build — a durable, on-chain trust primitive.

## Links

- **Live dashboard:** https://web-eight-amber-iq6mjhp7bf.vercel.app
- **Public roadmap (on the live site):** https://web-eight-amber-iq6mjhp7bf.vercel.app/#launch-plan
- **X / Twitter:** https://x.com/tangvu_dev
- **Demo video:** https://youtu.be/wp5KoLqxDU4
- **GitHub (open-source, MIT):** https://github.com/tang-vu/verity
- **Full deployment record (all tx hashes):** [`docs/DEPLOYMENT.md`](https://github.com/tang-vu/verity/blob/main/docs/DEPLOYMENT.md)

*All code original and newly developed for the Casper Agentic Buildathon 2026.*
