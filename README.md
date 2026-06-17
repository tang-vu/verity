# verity

**A reputation-staked x402 signal oracle and an autonomous DeFi agent that trusts it only as far as its on-chain track record.** Built on Casper for the Casper Agentic Buildathon 2026.

> The machine economy needs machine-verifiable trust. verity makes an oracle's word worth *exactly* its on-chain accuracy — and builds a consumer agent that pays for that word over x402 and sizes its trade by that reputation. No human in the loop.

---

## The problem

Agent-to-agent commerce is coming, but agents have no native way to decide *whose data to trust*. Today an AI agent buying a signal from another agent has to take the seller's word for it. That doesn't scale to a machine economy: a paid API can be confidently wrong forever and never pay a price.

verity closes that loop with **on-chain reputation as collateral for truth**:

1. A **Producer (Oracle) agent** fetches real market data, uses an LLM to produce a directional signal + calibrated confidence + reasoning, and writes it to a Casper smart contract. The contract maintains a per-oracle **accuracy score** that updates every time a past signal is *resolved* against reality.
2. The latest signal sits behind an **x402 paywall** — pay-per-query with a cryptographic payment proof, settled on Casper via the hosted x402 facilitator.
3. A **Consumer (DeFi) agent** discovers the oracle over MCP, pays the x402 fee, reads the signal, **weights its action by the oracle's on-chain reputation**, and executes a swap/rebalance on Casper testnet via the CSPR.trade MCP server.

**The novel mechanic:** the oracle's word is only worth its verifiable, on-chain reputation, and the consumer's capital-at-risk scales linearly with that number. A poor or unproven oracle simply *cannot* move much capital. This is trust-minimized, machine-priced truth.

## Mapping to Casper's machine-economy thesis

Casper's AI toolkit is built so autonomous agents can transact with cryptographic guarantees. verity exercises the whole stack as a coherent, real economy:

| Casper machine-economy primitive | How verity uses it |
|---|---|
| **Smart contracts as trust anchors** | `SignalOracle` (Odra) stores signals *and* a tamper-proof accuracy score anyone can verify. |
| **x402 micropayments** | The signal is a paid, machine-bought product — HTTP 402 → signed payment → on-chain settlement. |
| **x402 Facilitator (sponsored testnet)** | The facilitator verifies + settles the CEP-18 payment and pays the gas, so agents transact without managing nodes. |
| **MCP for agent discovery + action** | Consumer discovers via Casper MCP and *acts* via the CSPR.trade MCP server. |
| **Typed-data signing (EIP-712)** | Payments are EIP-712 `transfer_with_authorization` over a CEP-18 token — gasless, verifiable authorization. |
| **Reputation = on-chain collateral** | The consumer's trust (and capital) is a pure function of the oracle's verifiable history. |

## Buildathon alignment (Casper Agentic Buildathon 2026)

verity is built directly against the organizers' **Example Build Direction #2 — "RWA Oracle Agents with Verifiable On-Chain Identity"**:

> *"Create an agent that scrapes off-chain data, runs a risk assessment model, and posts verified data on-chain via Casper's native x402 implementation. The agent maintains a verifiable on-chain identity and reputation score based on historical accuracy, creating a trust-minimized RWA oracle."*

verity implements exactly this — off-chain data → LLM assessment → on-chain post → x402-paid access → an on-chain reputation score updated by historical accuracy — and adds the consumer side that **acts** on that reputation.

How it maps to the Final-Round judging criteria:

| Judging criterion | Where verity delivers |
|---|---|
| **Working smart contracts** | `SignalOracle` (Odra) deployed on `casper-test`, transaction-producing (publish/resolve). 14/14 tests. |
| **Use of AI / agentic systems** | Two autonomous agents: an LLM oracle and a DeFi consumer that pays, reasons over reputation, and trades with no human in the loop. |
| **Innovation & originality** | Reputation-as-collateral: the consumer's capital-at-risk scales with the oracle's *verifiable* on-chain accuracy. |
| **Real-world applicability (DeFi/RWA)** | A trust-minimized data-feed market; the same rails extend to RWA valuations (see roadmap). |
| **Technical execution** | Rust+Odra contract, TS agents, official x402 + MCP + EIP-712 toolkit pieces, tested end-to-end. |
| **User experience & design** | Live Next.js dashboard: reputation chart, signal history, agent-loop log — every number links to a real cspr.live tx. |
| **Long-term launch plans** | x402 "verifiable data products" family with a staged roadmap (below). |
| **Long-term impact** | Open SDK so any agent can publish/consume reputation-staked feeds — a self-pricing data economy on Casper. |

**Submission checklist:** ✅ working prototype on Casper Testnet with a transaction-producing on-chain component · ✅ open-source GitHub repo with README · ⏳ demo video (`docs/DEMO_SCRIPT.md`). Community voting runs via **CSPR.fans**.

## Architecture

```
                 ┌─────────────────────────────────────────────────────────┐
                 │                   Casper testnet (casper-test)            │
                 │   ┌───────────────────────────────────────────────────┐ │
                 │   │  SignalOracle contract (Rust + Odra)               │ │
                 │   │   • signals[]  (id, dir, confidence, prices, ...)  │ │
                 │   │   • reputation{accuracy_bps, correct/resolved}     │ │
                 │   └───────────────────────────────────────────────────┘ │
                 └───────▲───────────────────────────▲─────────────▲────────┘
              publish/   │ resolve         read state │             │ settle CEP-18
              resolve tx │ (real tx)                  │             │ (x402 facilitator)
                         │                            │             │
   real market     ┌─────┴───────┐            ┌───────┴────────┐   ┌┴───────────────┐
   data (CoinGecko)│  PRODUCER   │            │   CONSUMER     │   │ x402 Facilitator│
        │          │ Oracle Agent│            │  DeFi Agent    │   │  (CSPR.cloud)   │
        └─────────▶│  + LLM      │            │                │   └─────────────────┘
                   │  + x402     │  HTTP 402  │  1 discover(MCP)│
                   │   server    │◀───────────│  2 pay x402     │
                   │             │  X-PAYMENT │  3 weight by rep│
                   │ /signal/    │───────────▶│  4 swap via     │
                   │  latest 🔒  │   signal   │   CSPR.trade MCP│──▶ Casper DEX
                   └─────────────┘            └────────────────┘    (real action tx)
```

Full autonomous loop: **signal → x402 payment → reputation-weighted action**, every step producing a real on-chain tx hash with a cspr.live link.

## Where each toolkit piece lives in the code

| Piece | File(s) |
|---|---|
| **Odra contract** (signals + reputation) | `contracts/src/signal_oracle.rs`, `contracts/src/types.rs`, `contracts/src/reputation_math.rs` |
| **Contract tests** (`odra_test`) | `contracts/tests/signal_oracle_test.rs` (14 passing) |
| **x402 paywall server** | `shared/src/x402-paywall-middleware.ts`, `oracle-agent/src/serve.ts` |
| **x402 paying client** | `shared/src/x402-payment-client.ts` |
| **x402 Facilitator client** (verify/settle) | `shared/src/facilitator-client.ts` |
| **EIP-712 typed-data signing** | `shared/src/eip712-casper.ts` (official `@casper-ecosystem/casper-eip-712`) |
| **MCP client** (discovery + CSPR.trade) | `defi-agent/src/mcp-client.ts`, `defi-agent/src/cspr-trade-executor.ts` |
| **Reputation-weighted decision** (novel mechanic) | `defi-agent/src/reputation-weighted-action.ts` |
| **LLM signal generation** (Anthropic) | `oracle-agent/src/llm-signal.ts`, `prompts/signal-generation.md` |
| **On-chain writes** (casper-js-sdk v5) | `shared/src/casper-client.ts`, `shared/src/oracle-contract-client.ts` |

## Tech stack & why

- **Contracts:** Rust + **Odra 2.8.1** (`cargo-odra`, wasm32, `odra_test`). Idiomatic Casper contract layer.
- **Agents / x402 / MCP / dashboard:** **TypeScript / Node**. The official x402 *facilitator is a hosted CSPR.cloud HTTP service* consumed over the wire regardless of language; the Casper MCP, CSPR.trade MCP, EIP-712, and Anthropic SDKs are all TS-native. (The official Go x402 reference informed the wire protocol; see `docs/PROGRESS.md`.)
- **LLM:** Anthropic API (`claude-sonnet-4-6` by default), strict-JSON validated signals.
- **Dashboard:** Next.js, live testnet data + reputation chart + agent-loop log with clickable tx links.

## Quickstart

```bash
# 0. Install toolchains: Node 20+, Rust nightly (Odra needs it), a C toolchain
#    (Windows: WinLibs/MSYS2 gcc). Then:
npm install

# 1. Generate the two agent keypairs (prints public keys + faucet steps)
npm run keygen
npm run init-env          # writes .env with the generated public keys

# 2. Paste the 3 human secrets into .env (see "Secrets" below) and FUND both
#    accounts at https://testnet.cspr.live/tools/faucet

# 3. Build + test the contract, then deploy to testnet
cd contracts && cargo test && cargo odra build && cd ..
npm run deploy:sdk        # installs the wasm, writes SIGNAL_ORACLE_PACKAGE_HASH

# 4. Seed reputation history (real on-chain publish+resolve), publish a live signal
npm run seed
npm run oracle:publish

# 5. Run the oracle server + the full autonomous loop
npm run oracle:serve      # terminal A
npm run agent:loop        # terminal B
```

No-funds sanity check (validates the full x402 sign⇄verify round-trip locally):

```bash
npm run smoke:x402
```

## Run the demo

```bash
npm run demo              # one command: signal → x402 pay → reputation-weighted action
npm run web:dev           # dashboard at http://localhost:3000
```

See **`docs/DEMO_SCRIPT.md`** for the 2–3 min video walkthrough.

## Secrets (the only human inputs)

Set these in `.env` (see `.env.example`):

1. **`ANTHROPIC_API_KEY`** — https://console.anthropic.com/settings/keys
2. **A funded testnet account** — `npm run keygen` generates the keypairs and prints the public keys; fund both at https://testnet.cspr.live/tools/faucet.
3. **`CSPR_CLOUD_ACCESS_TOKEN`** — https://console.cspr.cloud (authorizes the hosted x402 facilitator + RPC + MCP).

The contract, agents, and local x402 round-trip all run/test without these; they're required only for real testnet transactions.

## Live testnet links

Deployed contract + transaction hashes are recorded in **`docs/DEPLOYMENT.md`** with cspr.live links (filled at deploy time).

## Long-term launch plan

verity is the first member of an **x402 "verifiable data products" family** — paid, machine-bought data feeds whose price is backed by on-chain reputation.

- **Who pays:** autonomous DeFi agents, trading bots, treasury-management agents, and other oracles that want a reputation-weighted second opinion. Every read is a micropayment.
- **Positioning:** not "an oracle" but a *trust layer for the machine economy* — any data product (price, risk, sentiment, RWA valuation) can plug into the same publish→resolve→reputation→x402 rails.
- **Roadmap:**
  1. **Now (buildathon):** single oracle, single consumer, CSPR/USD direction, testnet.
  2. **Q3:** multi-oracle marketplace; consumers pick by reputation; staking/slashing so oracles post bond against accuracy.
  3. **Q4:** RWA feeds (tokenized treasury/commodity valuations) with the same reputation collateral; mainnet x402 settlement.
  4. **2027:** open SDK so any agent can publish a reputation-staked feed and any agent can consume it — a self-pricing data economy.
- **Moat:** reputation is non-transferable and slow to build, so honest long-lived oracles accrue durable, on-chain pricing power.
- **Socials & presence (in place for launch):**
  - X / Twitter: `@verity_oracle` *(handle to be confirmed)*
  - GitHub: https://github.com/tang-vu/verity
  - Demo video: see `docs/DEMO_SCRIPT.md`
  - Community: Casper Discord / Telegram (CSPR.fans for buildathon voting)

## License

MIT — see [LICENSE](./LICENSE). All code original, written for the Casper Agentic Buildathon 2026.
