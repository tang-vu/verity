# verity — Community Vote & Socials Kit

Everything needed to run the **CSPR.fans community-vote path** (top-3 voted projects
skip the jury and advance straight to the Final Round) and to satisfy the jury's
**"long-term launch plans with socials in place"** criterion.

**You (human) still need to:** create the real accounts (X/Twitter, Telegram),
register the project on CSPR.fans, and paste the copy below. Handles are placeholders
until you claim them — update them in one place: the repo `.env`
(`NEXT_PUBLIC_TWITTER_URL`, `NEXT_PUBLIC_CSPR_FANS_URL`) and this file.

Live surfaces already in place: dashboard `https://web-eight-amber-iq6mjhp7bf.vercel.app`,
repo `https://github.com/tang-vu/verity`, demo `…/releases/tag/v1.0.0`.

---

## 0. Handles / links checklist (claim these)

| Channel | Handle (proposed) | Status |
|---|---|---|
| X / Twitter | `@verity_oracle` | ⬜ claim |
| Telegram (announce) | `t.me/verity_oracle` | ⬜ claim |
| CSPR.fans project | `verity` | ⬜ register |
| GitHub | `tang-vu/verity` | ✅ live |
| Demo video (YouTube) | upload the 2–3 min cut | ⬜ upload, then link |

> After claiming, set in `.env`: `NEXT_PUBLIC_TWITTER_URL`, `NEXT_PUBLIC_CSPR_FANS_URL`,
> `NEXT_PUBLIC_DEMO_URL`, then `npm run web:snapshot && npm run web:build` and redeploy.

---

## 1. CSPR.fans project submission

**Project name:** verity

**One-liner (≤ 80 chars):**
> The trust layer for the machine economy — a reputation-staked oracle on Casper.

**Tagline:**
> An oracle's word is worth *exactly* its on-chain accuracy — and a wrong call slashes its bond.

**Short description (elevator, ~60 words):**
> verity is a reputation-staked x402 signal oracle plus an autonomous DeFi agent that
> trusts it only as far as its verifiable, on-chain track record. The oracle bonds real
> collateral (x402USD) behind every call; wrong calls are slashed on-chain. The agent
> pays per signal over x402 and sizes its trade by that reputation. No human in the loop.

**Full description:**
> Agent-to-agent commerce is coming, but agents have no native way to decide *whose data
> to trust*. A paid API can be confidently wrong forever and never pay a price. verity
> closes that loop by making truth machine-priced and collateral-backed:
>
> 1. A **Producer (Oracle) agent** fetches real market data (CoinGecko — CSPR/USD and
>    **PAXG tokenized gold**, a real-world asset), uses an LLM (DeepSeek) to produce a
>    calibrated directional signal, and writes it to a Casper (Odra) smart contract that
>    maintains a tamper-proof **accuracy score** and holds the oracle's **bonded stake**.
> 2. The latest signal sits behind an **x402 paywall** — pay-per-query, settled on Casper
>    by the hosted facilitator.
> 3. A **Consumer (DeFi) agent** discovers the oracle over MCP, pays the x402 fee, and
>    **sizes its trade by the oracle's on-chain reputation — but only if the oracle has
>    real collateral at risk.** An undercollateralized or unproven oracle cannot move
>    capital.
>
> The novel mechanic: **reputation as slashable collateral.** A wrong call burns 20% of
> the oracle's bond, which flows to a consumer-protection treasury — bad data literally
> pays out to the agents it could have misled. Reputation is non-transferable and slow to
> build, so honest, long-lived oracles accrue durable, on-chain pricing power.
>
> Built for the Casper Agentic Buildathon 2026, matching **Build Direction #2 — RWA Oracle
> Agents with verifiable on-chain identity** — and extended with the consumer side that
> *acts* on that reputation. Every step produces a real testnet tx with a cspr.live link.

**Why vote for verity (the ask):**
> If you believe the agent economy needs machine-verifiable, collateral-backed trust —
> not just another price feed — vote verity into the Final Round. It exercises the whole
> Casper AI stack (Odra, x402, facilitator, MCP, EIP-712, LLM) as one coherent, real
> economy, and it's live on testnet today.

**Tags:** Agentic AI · DeFi · RWA · Oracle · x402 · Casper · MCP

---

## 2. X / Twitter launch thread

**Bio:**
> Reputation-staked oracle for the machine economy, on @Casper_Network. An oracle's word
> is worth exactly its slashable, on-chain accuracy. Built for the Agentic Buildathon.

**Pinned tweet:**
> Most oracles can be confidently wrong forever and never pay a price.
>
> verity fixes that: our oracle bonds real collateral behind every call. Wrong → slashed
> on-chain. A DeFi agent pays per signal (x402) and sizes its trade by that reputation.
>
> Live on @Casper_Network testnet 👇
> [dashboard link]

**Thread (1/9 … 9/9):**

> 1/ Agent-to-agent commerce is coming. But agents have no native way to decide *whose
> data to trust*. Today a paid API can be wrong forever and never pay a price. That
> doesn't scale to a machine economy.
>
> Meet verity — the trust layer for the agent economy on @Casper_Network. 🧵

> 2/ The core idea: an oracle's word should be worth *exactly* its verifiable, on-chain
> accuracy — and it should have real money on the line.
>
> So verity oracles **bond collateral** (x402USD) behind every signal.

> 3/ A wrong call gets **slashed** — 20% of the bond, on-chain, automatically — and the
> slashed capital flows to a consumer-protection treasury.
>
> Bad data literally pays out to the agents it misled. 🩸

> 4/ The Producer agent pulls real market data (CoinGecko: CSPR/USD + **PAXG tokenized
> gold**, an RWA), asks an LLM (DeepSeek) for a calibrated call, and writes it to a
> Casper smart contract (Odra) that tracks accuracy + stake.

> 5/ The latest signal sits behind an **x402 paywall** — HTTP 402 → EIP-712 signed
> payment → settled on Casper by the hosted facilitator. Machine-bought data, per query.

> 6/ A Consumer DeFi agent discovers the oracle over **MCP**, pays the x402 fee, reads the
> signal, and sizes its trade:
>
> notional = maxSize × on-chain_accuracy × confidence
>
> …gated on the oracle having real collateral at risk. No human in the loop.

> 7/ The result: an undercollateralized or unproven oracle *cannot* move much capital.
> Trust is machine-priced and collateral-backed. Reputation is non-transferable and slow
> to build → honest oracles accrue durable on-chain pricing power.

> 8/ It's all real. Every step produces a live testnet tx you can verify on cspr.live:
> contract deploy, signals, x402 settlement, and slashes.
>
> Toolkit used, end-to-end: Odra · x402 · facilitator · MCP · EIP-712 · LLM.

> 9/ verity is built for the #CasperAgenticBuildathon (Build Direction #2 — RWA oracle
> agents with verifiable reputation).
>
> ⭐ Vote for us on CSPR.fans: [link]
> 🖥️ Live dashboard: [link]
> 💻 Open source: github.com/tang-vu/verity

---

## 3. Telegram / Discord announcement

> **verity — the trust layer for the machine economy, live on Casper testnet** 🔮
>
> We built a reputation-staked oracle where an oracle's word is worth *exactly* its
> on-chain accuracy — and it bonds real collateral that gets **slashed** when it's wrong.
> A DeFi agent pays per signal over x402 and sizes its trade by that reputation. Fully
> autonomous, no human in the loop.
>
> ✅ Odra smart contract on testnet (staking + slashing + reputation)
> ✅ x402 pay-per-signal, settled on-chain by the facilitator
> ✅ MCP discovery + CSPR.trade execution
> ✅ CSPR/USD **and** PAXG (tokenized gold — RWA) feeds
> ✅ Every step is a real cspr.live tx
>
> Built for the Casper Agentic Buildathon 2026 (Build Direction #2).
>
> ⭐ Vote on CSPR.fans: [link]
> 🖥️ Dashboard: https://web-eight-amber-iq6mjhp7bf.vercel.app
> 💻 GitHub: https://github.com/tang-vu/verity
> ▶️ Demo: [link]

---

## 4. Posting cadence (last 2 days before deadline)

1. **Now:** claim handles, register on CSPR.fans, pin the pinned tweet, post the thread.
2. **+6h:** post the demo video natively (X + Telegram); reply it under the thread.
3. **Daily:** one "proof" post — screenshot a real slash tx / reputation change on cspr.live.
4. **Vote reminders:** short daily nudge with the CSPR.fans link in Casper community
   channels (Discord/Telegram) — lead with the slashing hook, not "please vote".
5. **Deadline day:** final push post + thank-you.

## Open questions (need human input)
- Confirm the real X/Telegram handles once claimed → update `.env` + this file.
- CSPR.fans exact submission URL once the project is registered.
- YouTube link for the 2–3 min demo once uploaded.
