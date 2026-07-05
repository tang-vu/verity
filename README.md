# verity

**A reputation-staked x402 signal oracle and an autonomous DeFi agent that trusts it only as far as its on-chain track record.** Built on Casper for the Casper Agentic Buildathon 2026.

> The machine economy needs machine-verifiable trust. verity makes an oracle's word worth *exactly* its on-chain accuracy — and builds a consumer agent that pays for that word over x402 and sizes its trade by that reputation. No human in the loop.

**🔗 Live dashboard:** https://web-eight-amber-iq6mjhp7bf.vercel.app · **Demo video:** https://youtu.be/wp5KoLqxDU4 · **Repo:** https://github.com/tang-vu/verity

---

## The problem

Agent-to-agent commerce is coming, but agents have no native way to decide *whose data to trust*. Today an AI agent buying a signal from another agent has to take the seller's word for it. That doesn't scale to a machine economy: a paid API can be confidently wrong forever and never pay a price.

verity closes that loop with **on-chain reputation as collateral for truth**:

1. A **Producer (Oracle) agent** fetches real market data, uses an LLM to produce a directional signal + calibrated confidence + reasoning, and writes it to a Casper smart contract. The contract maintains a per-oracle **accuracy score** that updates every time a past signal is *resolved* against reality.
2. The latest signal sits behind an **x402 paywall** — pay-per-query with a cryptographic payment proof, settled on Casper via the hosted x402 facilitator.
3. A **Consumer (DeFi) agent** discovers the oracle over MCP, pays the x402 fee, reads the signal, **weights its action by the oracle's on-chain reputation**, and executes a swap/rebalance on Casper testnet via the CSPR.trade MCP server.

**The novel mechanic — reputation as *slashable collateral*:** the oracle bonds real capital (x402USD) behind its calls. A wrong resolution **slashes** 20% of that bond on-chain, and the slashed capital flows to a consumer-protection treasury — *bad data literally pays out to the agents it could have misled*. The consumer, in turn, weights its capital-at-risk by the oracle's on-chain accuracy **and refuses to act at all unless the oracle has real collateral bonded**. A poor, unproven, or undercollateralized oracle simply *cannot* move capital. This is trust-minimized, machine-priced, collateral-backed truth.

## Mapping to Casper's machine-economy thesis

Casper's AI toolkit is built so autonomous agents can transact with cryptographic guarantees. verity exercises the whole stack as a coherent, real economy:

| Casper machine-economy primitive | How verity uses it |
|---|---|
| **Smart contracts as trust anchors** | `SignalOracle` (Odra) stores signals, a tamper-proof accuracy score, *and* the oracle's bonded, slashable stake — all verifiable on-chain. |
| **x402 micropayments** | The signal is a paid, machine-bought product — HTTP 402 → signed payment → on-chain settlement. |
| **x402 Facilitator (sponsored testnet)** | The facilitator verifies + settles the CEP-18 payment and pays the gas, so agents transact without managing nodes. |
| **MCP for agent discovery + action** | Consumer discovers via Casper MCP and *acts* via the CSPR.trade MCP server. |
| **Typed-data signing (EIP-712)** | Payments are EIP-712 `transfer_with_authorization` over a CEP-18 token — gasless, verifiable authorization. |
| **Reputation = slashable on-chain collateral** | The oracle bonds x402USD; wrong calls are slashed to a treasury. The consumer's trust (and capital) is a pure function of the oracle's verifiable history *and* live collateral. |
| **RWA feed** | The same rails carry a **PAXG (tokenized gold)** signal — a genuine real-world asset — alongside CSPR/USD. |

## Buildathon alignment (Casper Agentic Buildathon 2026)

verity is built directly against the organizers' **Example Build Direction #2 — "RWA Oracle Agents with Verifiable On-Chain Identity"**:

> *"Create an agent that scrapes off-chain data, runs a risk assessment model, and posts verified data on-chain via Casper's native x402 implementation. The agent maintains a verifiable on-chain identity and reputation score based on historical accuracy, creating a trust-minimized RWA oracle."*

verity implements exactly this — off-chain data → LLM assessment → on-chain post → x402-paid access → an on-chain reputation score updated by historical accuracy — and adds the consumer side that **acts** on that reputation.

How it maps to the Final-Round judging criteria:

| Judging criterion | Where verity delivers |
|---|---|
| **Working smart contracts** | `SignalOracle` (Odra) deployed on `casper-test`, transaction-producing (publish/resolve/**stake**/**slash**/withdraw). 26 tests (contract + agent). |
| **Use of AI / agentic systems** | Two autonomous agents: an LLM oracle and a DeFi consumer that pays, reasons over reputation + collateral, and trades with no human in the loop. |
| **Innovation & originality** | Reputation as *slashable collateral*: the oracle bonds capital that a wrong call burns on-chain (to a consumer-protection treasury); the consumer refuses undercollateralized oracles outright. |
| **Real-world applicability (DeFi/RWA)** | A trust-minimized data-feed market carrying both CSPR/USD and a **PAXG tokenized-gold (RWA)** feed on the same publish→resolve→reputation→x402 rails. |
| **Technical execution** | Rust+Odra contract, TS agents, official x402 + MCP + EIP-712 toolkit pieces, tested end-to-end. |
| **User experience & design** | Live Next.js dashboard: reputation chart, signal history, agent-loop log — every number links to a real cspr.live tx. |
| **Long-term launch plans** | x402 "verifiable data products" family with a staged roadmap (below). |
| **Long-term impact** | Open SDK so any agent can publish/consume reputation-staked feeds — a self-pricing data economy on Casper. |

**Submission checklist:** ✅ working prototype on Casper Testnet with a transaction-producing on-chain component · ✅ open-source GitHub repo with README · ✅ demo video (~77s walkthrough, `loop-output/verity-demo.mp4`). Community voting runs via **CSPR.fans**.

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
| **Odra contract** (signals + reputation + staking) | `contracts/src/signal_oracle.rs`, `contracts/src/types.rs`, `contracts/src/reputation_math.rs` |
| **Staking + slashing** (slashable collateral) | `contracts/src/signal_oracle.rs` (`stake`/`withdraw_stake`/slash-on-resolve), `contracts/src/staking_math.rs` |
| **Stake bring-up + on-chain audit trail** | `scripts/enable-staking.ts`, `shared/src/stake-store.ts` |
| **Contract tests** (`odra_test`) | `contracts/tests/signal_oracle_test.rs` (15 integration incl. 6 staking; 8 unit; 26 total) |
| **x402 paywall server** | `shared/src/x402-paywall-middleware.ts`, `oracle-agent/src/serve.ts` |
| **x402 paying client** | `shared/src/x402-payment-client.ts` |
| **x402 Facilitator client** (verify/settle) | `shared/src/facilitator-client.ts` |
| **x402 payment token** (CEP-18 + CEP-3009 `transfer_with_authorization` + CEP-2612) | `contracts/src/x402_token.rs` (Odra `odra-modules`) |
| **EIP-712 typed-data signing** | `shared/src/eip712-casper.ts` (official `@casper-ecosystem/casper-eip-712`) |
| **MCP client** (discovery + CSPR.trade) | `defi-agent/src/mcp-client.ts`, `defi-agent/src/cspr-trade-executor.ts` |
| **Reputation-weighted decision** (novel mechanic) | `defi-agent/src/reputation-weighted-action.ts` |
| **LLM signal generation** (DeepSeek, OpenAI-compatible) | `oracle-agent/src/llm-signal.ts`, `prompts/signal-generation.md` |
| **On-chain writes** (casper-js-sdk v5) | `shared/src/casper-client.ts`, `shared/src/oracle-contract-client.ts` |

## Tech stack & why

- **Contracts:** Rust + **Odra 2.8.1** (`cargo-odra`, wasm32, `odra_test`). Idiomatic Casper contract layer.
- **Agents / x402 / MCP / dashboard:** **TypeScript / Node**. The official x402 *facilitator is a hosted CSPR.cloud HTTP service* consumed over the wire regardless of language; the Casper MCP, CSPR.trade MCP, and EIP-712 SDKs are all TS-native. (The official Go x402 reference informed the wire protocol; see `docs/PROGRESS.md`.)
- **LLM:** DeepSeek API (`deepseek-chat` by default; OpenAI-compatible `/chat/completions`, JSON mode), strict-JSON validated signals. Any OpenAI-compatible endpoint works via `LLM_BASE_URL`/`LLM_MODEL`.
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

# 3. Build + test the contracts, then build the deployable wasm
cd contracts && cargo test && cd ..
npm run build:wasm        # SignalOracle.wasm + X402Token.wasm (Windows-safe)

# 4. Deploy to testnet
npm run deploy:sdk         # SignalOracle → writes SIGNAL_ORACLE_PACKAGE_HASH
npm run deploy:x402-token  # X402Token (CEP-18+3009+2612) → X402_ASSET_PACKAGE_HASH
                           # + funds the consumer so it can pay the paywall on-chain

# 5. Bond the oracle's collateral (stake token, treasury, min-stake gate, stake),
#    then seed reputation history (its deliberate miss produces a real on-chain
#    slash), and publish live signals — CSPR/USD and the PAXG (tokenized-gold) RWA feed.
npm run enable:staking
npm run seed
npm run oracle:publish
npm run oracle:publish-rwa

# 6. Run the oracle server + the full autonomous loop
npm run oracle:serve      # terminal A
npm run agent:loop        # terminal B
```

> On Linux/macOS you can use `cargo odra build` instead of `npm run build:wasm`.

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

1. **`DEEPSEEK_API_KEY`** — https://platform.deepseek.com/api_keys (any OpenAI-compatible LLM works)
2. **A funded testnet account** — `npm run keygen` generates the keypairs and prints the public keys; fund both at https://testnet.cspr.live/tools/faucet.
3. **`CSPR_CLOUD_ACCESS_TOKEN`** — sign up at https://console.cspr.build/sign-up and create an access token (authorizes the hosted x402 facilitator + RPC + MCP). Optional: skip it and point `CASPER_NODE_RPC_URL` at a public testnet peer; x402 then runs in verified-deferred mode.

The contract, agents, and local x402 round-trip all run/test without these; they're required only for real testnet transactions.

## Live testnet links

verity is **live on Casper testnet** — the full loop ran end-to-end with real transactions. Every hash is verifiable on [testnet.cspr.live](https://testnet.cspr.live); the complete record is in **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.

| What | On-chain proof |
|---|---|
| **SignalOracle v2** (Odra, staking) | [`13b217e5…14ffd0`](https://testnet.cspr.live/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0) |
| **X402Token** (CEP-18 + CEP-3009 + CEP-2612) | [`4373bc32…c128cc`](https://testnet.cspr.live/contract-package/4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc) |
| **Oracle bonded collateral** (2000 x402USD `stake`) | [`46a5d9b1…`](https://testnet.cspr.live/transaction/46a5d9b1a1f1dea027ae1bdca25f55e427879e7cdbc08714c753b11ac5ff0c78) |
| **On-chain SLASH** (400 x402USD, a wrong call → consumer treasury) | [`4ae1e222…`](https://testnet.cspr.live/transaction/4ae1e222a9234c0a3cd9d3c437af247d352ea0359f99fa98fc748b1b4ba79f11) |
| **Live LLM signal — CSPR/USD** (CoinGecko → DeepSeek → on-chain) | [`d9fb786f…`](https://testnet.cspr.live/transaction/d9fb786f3f5b35649d7f4a12054e14df83702f20a15de322560dff64d298071f) |
| **Live LLM signal — PAXG (tokenized gold, RWA)** | [`a11dcebb…`](https://testnet.cspr.live/transaction/a11dcebba120bb2f20bad80fb1b2ce26bfc715afadb532fdf6d0b3d352219dcd) |
| **x402 settled on-chain** (facilitator `transfer_with_authorization`) | [`0ee181dc…`](https://testnet.cspr.live/transaction/0ee181dc4b5356dd5ef0fbcdc15a783023144605e361202b869de5246896f99b) |
| **On-chain reputation** | 75% — 3/4 resolved correct on v2 |
| **Live dashboard** | https://web-eight-amber-iq6mjhp7bf.vercel.app |

**Demo video (~77s):** https://youtu.be/wp5KoLqxDU4 — on-chain proof (staking, the on-chain slash, RWA) → real `agent:loop` terminal run → live dashboard, with MiMo TTS voiceover + captions.

## Long-term launch plan

verity is the first member of an **x402 "verifiable data products" family** — paid, machine-bought data feeds whose price is backed by on-chain reputation.

- **Who pays:** autonomous DeFi agents, trading bots, treasury-management agents, and other oracles that want a reputation-weighted second opinion. Every read is a micropayment.
- **Positioning:** not "an oracle" but a *trust layer for the machine economy* — any data product (price, risk, sentiment, RWA valuation) can plug into the same publish→resolve→reputation→x402 rails.
- **Roadmap:**
  1. **Now (buildathon):** single oracle + consumer; CSPR/USD **and PAXG tokenized-gold (RWA)** feeds; **staking + slashing live** — the oracle bonds x402USD and wrong calls are slashed on-chain to a consumer-protection treasury; testnet.
  2. **Q3:** multi-oracle marketplace; consumers pick by reputation *and* live bond; staking extended with per-oracle bond sizing and withdrawal timelocks.
  3. **Q4:** more RWA feeds (tokenized treasury/commodity NAVs) on the same collateral rails; mainnet x402 settlement.
  4. **2027:** open SDK so any agent can publish a reputation-staked feed and any agent can consume it — a self-pricing data economy.
- **Moat:** reputation is non-transferable and slow to build, so honest long-lived oracles accrue durable, on-chain pricing power.
- **Socials & presence (in place for launch):**
  - X / Twitter: `@verity_oracle` *(handle to be confirmed)*
  - GitHub: https://github.com/tang-vu/verity
  - Demo video: see `docs/DEMO_SCRIPT.md`
  - Community: Casper Discord / Telegram (CSPR.fans for buildathon voting)

## License

MIT — see [LICENSE](./LICENSE). All code original, written for the Casper Agentic Buildathon 2026.
