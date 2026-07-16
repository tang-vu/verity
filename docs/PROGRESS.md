# PROGRESS — decisions, assumptions, deviations

Living log. Newest entries on top. Sacrifice grammar for concision.

## 2026-07-16 — Web app made USABLE (judge feedback, final-round prep)

Judge: "improve the web app side, make it usable." Shipped:
- **Live on-chain data, zero secrets:** dashboard reconstructs signals/reputation/
  stake/slash/x402-revenue from the PUBLIC explorer API (`api.testnet.cspr.live`,
  no token) — full deploy history w/ parsed args per contract package. Grading/
  slash math mirrored 1:1 from `reputation_math.rs`/`staking_math.rs`; verified
  identical to snapshot (7 signals, 3/4=75%, bonded 1600, slashed 400) + live
  revenue (3 settlements) straight from the token contract. 30s cache, snapshot
  fallback if explorer API down. `web/app/lib/explorer-api.ts` + `live-oracle-state.ts`.
- **Real x402 paywall ON VERCEL:** `GET /api/x402/signal` → HTTP 402 challenge;
  X-PAYMENT verified locally (casper-js-sdk in Next route, `serverExternalPackages`)
  then settled via facilitator (needs `CSPR_CLOUD_ACCESS_TOKEN` env; else
  verified-deferred). CORS open so any agent can pay from anywhere.
- **One-click live purchase:** `POST /api/x402/demo-buy` — server-held demo consumer
  key (`CONSUMER_SECRET_KEY_PEM` env) runs 402→EIP-712 sign→X-PAYMENT→settle against
  the site's own paywall, returns step trace. Rate-limited 6/h/IP + 60/day.
- **UX:** x402 playground panel + curl snippet, "test in 3 steps" judge guide, Asset
  (CSPR vs PAXG·RWA) + Published columns, honest live/snapshot pill, public-friendly
  copy (no `npm run …` errors on prod), tables scroll-x on mobile. page.tsx split into
  components (signal-history-table, agent-loop-list, x402-playground, judge-testing-guide).
- web/ stays self-contained (Vercel builds from web/): x402 protocol ported to
  `web/app/lib/x402-*.ts`, public constants in `verity-public-config.ts`.
- **Premium redesign (same day, "make it wow"):** Instrument Serif wordmark/
  headline + Geist/Geist Mono data surface; graphite base, single verified-
  emerald accent, gold = collateral/RWA; asymmetric hero w/ count-up accuracy
  instrument + area chart, 5-metric ticker strip, bento panels, terminal-window
  x402 playground w/ sequential step reveal, ghost-numeral judge guide,
  timeline loop log, blueprint grid + grain, skeletons, reduced-motion.
  Verified via Playwright screenshots desktop+mobile. Commit `2e9fa80`.
- **Fresh signals published 2026-07-16:** #7 CSPR DOWN@55% (`f9efb759…`),
  #8 PAXG FLAT@65% (`d42d2448…`) — CoinGecko free tier 429s aggressively;
  publish scripts need retry spacing (~90s).
- **Facilitator gas outage found + fixed:** hosted facilitator's account
  (`0202b2d6…3449`) was at 0 CSPR → /settle failed "insufficient balance" →
  verified-deferred fallback. Testnet: refilled it ourselves with 100 CSPR from
  the consumer (`scripts/fund-x402-facilitator-gas.ts`, tx `3031517c…`). First
  browser-triggered LIVE settlement from prod right after: tx `adb026dc…`.
  Paywall now reports deferredReason (not_configured vs facilitator_error).
  Vercel env set via CLI: `CSPR_CLOUD_ACCESS_TOKEN`, `CONSUMER_SECRET_KEY_PEM`.

## 2026-07-05 — LIVE bring-up of v2 (staking) on testnet

Deployed SignalOracle **v2** (`13b217e5…`, staking) and drove the whole staking loop
on-chain. All real txs in DEPLOYMENT.md. Oracle bonded 2000 x402USD; a wrong resolve
**slashed 400 x402USD on-chain to the consumer treasury**; reputation 75%; live
CSPR/USD (`d9fb786f`) + PAXG-gold RWA (`a11dcebb`) LLM signals published.

Two blockers hit + fixed during bring-up:
1. **Redeploy over a non-upgradable v1** → `CannotOverrideKeys` (user error 64641).
   Fix: `deploy-via-sdk` now sets `odra_cfg_allow_key_override=true`.
2. **`-32016 Invalid transaction`** on most calls — real reason (via raw RPC):
   *"timestamp that has not yet occurred"*. Build host clock ran ~5s ahead of the node,
   which has near-zero future tolerance; the first call slipped through, later ones
   didn't. Fix: `callContract` stamps txs `now-60s` (within TTL). This ALSO unblocked
   the cross-contract CLKey calls (`approve`/`stake`) — earlier CLKey "rejections" were
   this skew, not a Key-encoding problem. Lesson: the contract-package spender Key
   (`hash-<pkg>`) is fine; Odra normalizes it to `Address::Contract`.

Deploy auto-read of the package hash failed (legacy account exposes 0 named keys via
the entity API); recovered it from the deploy tx effects (the `contractPackage` write).
Added `scripts/check-status.ts` (`npm run status`) for balance/hash pre-flight.

## 2026-07-05 — Staking/slashing + RWA feed + landing/marketing (deadline-extension push)

Buildathon deadline extended to 2026-07-07 → maximize win odds on both advancement
paths (CSPR.fans top-3 vote + jury on 8 criteria).

**Staking + slashing (Innovation upgrade).** `SignalOracle` now holds *slashable
collateral* behind the oracle's word. Design decisions:
- **Stake asset = x402USD (CEP-18), not native CSPR.** Native staking needs a
  cargo-purse/session proxy (Odra payable), unreachable via casper-js-sdk
  `ContractCallBuilder` on Windows. CEP-18 stake is callable with the existing
  `callContract` machinery, is real collateral, and ties to the same asset consumers
  pay in. Oracle `approve`s the SignalOracle package, then `stake(amount)` pulls via
  `transfer_from`.
- **Cross-contract call via a custom `#[odra::external_contract] StakeToken` trait**
  (not `Cep18ContractRef`) — arg names must match the *deployed* X402Token (`to` for
  `transfer`; `owner`/`recipient` for `transfer_from`); Cep18ContractRef sends
  `recipient` for transfer → MissingArg. Custom trait avoids redeploying the token.
- **Slash = 20% of remaining bond per wrong resolve**, routed to a treasury (set to
  the consumer → "bad data pays its victims"). Withdraw locked while any signal pending
  (`pending_count`). `min_stake` default 0 → **all 9 original tests unchanged**
  (backward compatible); new tests set it > 0.
- Pure `staking_math.rs` + 6 cross-contract host tests (deploy X402Token + SignalOracle).
  **26 tests pass** (8 unit incl. 3 staking-math, 15 integration incl. 6 staking, 3 token).
  Wasm builds clean (252 KB, MVP-lowered) — redeploy artifact ready.
- Consumer: `decideAction` gains an optional collateral gate (HOLD if bond < floor,
  regardless of accuracy). Stake surfaced via oracle server payload + `stake-store` +
  dashboard collateral card. 7 agent tests pass.
- Bring-up: `npm run enable:staking` (set_stake_token → set_treasury → set_min_stake →
  approve → stake), then seed's deliberate miss produces a real on-chain slash. Wired
  into `go-live`.

**RWA feed.** CoinGecko already lists **PAXG (Pax Gold — tokenized physical gold)**, a
genuine RWA, with the same market_data shape → the whole `market-data.ts` pipeline
reuses unchanged. `publish-signal --rwa` (npm `oracle:publish-rwa`) publishes a PAXG
signal; contract stores `asset` as a string so **no contract change for RWA**. Directly
satisfies Build Direction #2's "RWA oracle" framing.

**Landing/dashboard + marketing.** Dashboard upgraded with hero + CTA (Vote on
CSPR.fans / GitHub / demo / socials) + a bonded-collateral card + RWA mention; OG
metadata. Full community-vote & socials kit in `docs/marketing/` (CSPR.fans copy, X
launch thread, TG/Discord announcement, handles checklist, cadence).

**Still human-gated (B1):** the live redeploy (funded producer key + CSPR.cloud token)
and the real X/Telegram/CSPR.fans account creation. One verify-live item: the `approve`
spender **Key form** for a contract spender (`hash-<pkg>`) — confirm on the first funded
`enable:staking` run; fallback is package/entity key form.

## 2026-06-17 — Phase 0 scaffold

**Stack decision.** Contracts = Rust + Odra. Agents + x402 server/client + MCP +
dashboard = TypeScript/Node. Rationale:
- Official `make-software/casper-x402` reference is **Go**, but the x402
  **facilitator is a hosted CSPR.cloud service** (`https://x402-facilitator.cspr.cloud`,
  endpoints `/supported /verify /settle`) consumed over HTTP — language-agnostic.
- Casper MCP + CSPR.trade MCP are TS-native; LLM via OpenAI-compatible HTTP (DeepSeek).
- Node is the only runtime preinstalled on the build host; Rust installed on demand.
- Official repo ships a TS/React signing reference (`examples/csprclick-x402`).

**x402 wire protocol (from the Go reference + facilitator API).** Pay-per-query =
EIP-712 typed-data `transfer_with_authorization` of a CEP-18 token. Flow: client
GETs protected resource → server returns `402` + payment requirements → client signs
authorization, resends with payment header → server calls facilitator `/verify` then
`/settle` (facilitator pays gas + submits the CEP-18 transfer) → server returns data.

**Reputation model.** On-chain accuracy score in basis points (0-10000). Updated when
a past signal is RESOLVED: correct → score moves toward 10000, wrong → toward 0, via
an EMA-style update so recent accuracy dominates. Stored per-oracle in the contract.

**Signal domain.** Crypto price direction (default subject: CSPR/USD via CoinGecko —
free, no key). Horizon configurable. Real data point, real LLM call, real on-chain write.

## 2026-06-18 — Buildathon docs/links verified

Checked official buildathon page + toolkit links (all live):
- verity matches **Example Build Direction #2** (RWA Oracle Agents w/ verifiable
  on-chain identity + reputation by historical accuracy) almost verbatim → made
  explicit in README "Buildathon alignment" section + mapped all 8 judging criteria.
- $100k of the $150k pool is **x402 ecosystem credits** → x402 centrality confirmed.
- Submission needs: testnet prototype w/ on-chain tx ✅, OSS repo+README ✅, demo video ⏳.
- Community voting runs via **CSPR.fans** (Telegram mini-app, top-3 → finals).
- Real deadline 2026-06-30 (eval Jul 1-5). Added socials placeholder to launch plan.

## 2026-06-18 — x402 payment token shipped

- Added `X402Token` (`contracts/src/x402_token.rs`) = CEP-18 + CEP-3009
  (`transfer_with_authorization`) + CEP-2612, via `odra-modules` (feature eip712).
  Mirrors Odra's official gasless CEP-18; metadata aligned with `.env`
  (x402USD / x402 / 2 decimals). Host tests added.
- `scripts/build-wasm.ps1`: builds every contract to wasm via `ODRA_MODULE=<name>
  cargo build` (Windows-safe; bypasses cargo-odra's Unix-`cp` post-step, invokes
  cargo through `cmd /c` so PS 5.1 doesn't treat cargo stderr as fatal). Both
  SignalOracle.wasm (310 KB) + X402Token.wasm (395 KB) build clean.
- `scripts/deploy-x402-token.ts`: deploys the token, writes `X402_ASSET_PACKAGE_HASH`,
  funds the consumer so it can pay the paywall on-chain (resolves BLOCKER B4 in code).
- Added unit tests for the reputation-weighted decision (5/5 pass) —
  `npm run test:agent`. npm scripts now use `powershell` (no `pwsh`/PS7 on host).

## 2026-06-18 — LLM switched to DeepSeek

- Oracle LLM now uses **DeepSeek** (OpenAI-compatible `/chat/completions`, model
  `deepseek-chat`, JSON mode) via plain fetch — no SDK dep (dropped
  `@anthropic-ai/sdk`). Config: `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` /
  `DEEPSEEK_BASE_URL` (or generic `LLM_*`). env-config exposes `llmApiKey/llmModel/llmBaseUrl`.
- **Verified live:** real CoinGecko CSPR snapshot → DeepSeek → valid strict-JSON
  signal (zod-validated). End-to-end LLM path works with the user's key, no chain needed.

## 2026-06-18 — LIVE on testnet (SignalOracle + reputation + LLM signal)

Real on-chain deployment achieved (all hashes in DEPLOYMENT.md):
- SignalOracle deployed (`e6a502b9…`), 218 KB MVP wasm. Builder-Merit-qualifying.
- Reputation seeded with 8 real txs (4 publish + 4 resolve) → 75% (3/4 correct).
- Live LLM signal #0 published on-chain: real CoinGecko CSPR data → DeepSeek
  (FLAT @ 55%, calibrated) → tx `d1fa67bc…`. Execution verified success.

Debugging chain (each fixed + verified):
1. **bulk-memory**: nightly wasm rejected by Casper node. Fixed via wasm-opt
   `--llvm-memory-copy-fill-lowering` (lower to MVP); validated offline by grep WAT.
2. **MissingArg (64658)**: Odra deploy needs all 4 cfg args incl `odra_cfg_is_upgrade=false`.
3. **named keys empty**: producer is a legacy account → keys under `legacyAccount.namedKeys`.
4. **CWD .env / key paths**: `npm run --workspace` runs from the workspace dir; env-config
   now loads `.env` + resolves key paths via repo root (repo-root.ts).
5. **callContract** now checks `executionResult.errorMessage` (reverts no longer pass silently).

Cost note: 3 early deploys failed on the bulk-memory bug (~850 CSPR burned before the
offline-validate gate was added). X402Token deploy pending (~600 CSPR gas; out-of-gas at 250).
x402 runs verified-deferred meanwhile (smoke-tested).

## Assumptions
- A1: Buildathon participants can obtain a CSPR.cloud access token (free tier) that
  authorizes the hosted facilitator + hosted RPC + MCP. Documented in DEPLOYMENT.md.
- A2: x402 payment asset = a testnet CEP-18 token. If the buildathon provides a canonical
  x402 demo token package hash, use it; else `scripts/deploy-x402-token` mints one.
- A3: Facilitator pays settlement gas (per facilitator API "facilitator paying gas"),
  so testnet settlement is effectively sponsored for the resource server/payee.

## Open human inputs (see §SECRETS / DEPLOYMENT.md)
- DEEPSEEK_API_KEY (provided)
- Funded testnet account (faucet) for the generated producer + consumer keys
- CSPR_CLOUD_ACCESS_TOKEN

## 2026-06-18 — Phase 1 verified + Phase 2/3 built

**Phase 1 floor verified (no funds needed):**
- Contract: 14/14 tests pass (`cargo test`) — 5 reputation-math + 9 integration.
- Deployable wasm builds (310 KB, valid `\0asm`) via `cargo odra build`.
- x402 full round-trip passes offline (`npm run smoke:x402`): 402 → EIP-712 sign →
  pay → 200, signature verified by the paywall. This is the trickiest integration.
- Keypairs generated; `.env` bootstrap works.

**Phase 2 (loop) built:** DeFi agent discovers via MCP, pays x402, weights by
on-chain reputation (`reputation-weighted-action.ts`), swaps via CSPR.trade MCP.
Seed script publishes 4 resolved signals on-chain (3 correct, 1 wrong → 75%).

**Phase 3 (polish) built:** Next.js dashboard (signals, reputation chart, live loop
log w/ tx links); `npm run demo` one-command runner; `scripts/reset.sh`.

**Phase 4 (post-submission, 2026-07-07) built:** verity MCP server
(`oracle-agent/src/mcp-server.ts`) — 4 stdio tools so ANY MCP agent can discover
the oracle, audit reputation/collateral free, and buy the signal via real x402
(e2e proof: `npm run smoke:mcp`). Dashboard: reputation-history SVG chart
(cumulative accuracy per resolve) + x402 revenue card; page.tsx modularized into
`web/app/lib/dashboard-data.ts` + `web/app/components/*`. Major deps upgraded
(express 5, zod 4, dotenv 17, TS 6, Next 16).

## Deviations
- **D1 — Windows deploy path.** Odra's Rust `--features livenet` deployer pulls
  `casper-types 6.1.0` which uses Unix-only APIs (`libc::sysconf`,
  `OpenOptions::mode`) and won't compile on Windows. Primary deploy is now
  `npm run deploy:sdk` (casper-js-sdk `SessionBuilder` + the built wasm + Odra
  install args). Rust deployer retained for Linux/macOS. See BLOCKERS B2.
- **D2 — cargo-odra `cp` on Windows.** `cargo odra build`'s final copy step shells
  out to Unix `cp`; we copy the wasm from target/ ourselves. See BLOCKERS B3.
- **D3 — Rust toolchain.** Odra 2.8.1 macros need nightly (`box_patterns`); pinned
  `nightly-x86_64-pc-windows-gnu` (GNU host avoids MSVC Build Tools). Added
  `.cargo/config.toml` with `--allow-undefined` so wasm-ld emits Casper host
  imports instead of erroring.
- **D4 — x402 verified-deferred mode.** Without a configured CEP-18 token hash +
  CSPR.cloud token, the paywall verifies the EIP-712 signature locally (real crypto
  proof) and defers on-chain settlement; flips to full facilitator settlement
  automatically once both are set. No code change to enable. See BLOCKERS B4.
- **D5 — casper-js-sdk ESM interop.** SDK is a CJS bundle; Node ESM can't see its
  named exports. Added `shared/src/casper-sdk.ts` shim (default-import re-export);
  all SDK usage routes through it. Also: x402 signatures use
  `signAndAddAlgorithmBytes` (65-byte) — what `verifySignature`/facilitator expect.
