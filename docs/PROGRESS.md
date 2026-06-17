# PROGRESS — decisions, assumptions, deviations

Living log. Newest entries on top. Sacrifice grammar for concision.

## 2026-06-17 — Phase 0 scaffold

**Stack decision.** Contracts = Rust + Odra. Agents + x402 server/client + MCP +
dashboard = TypeScript/Node. Rationale:
- Official `make-software/casper-x402` reference is **Go**, but the x402
  **facilitator is a hosted CSPR.cloud service** (`https://x402-facilitator.cspr.cloud`,
  endpoints `/supported /verify /settle`) consumed over HTTP — language-agnostic.
- Casper MCP + CSPR.trade MCP + Anthropic SDK are TS-native.
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

## Assumptions
- A1: Buildathon participants can obtain a CSPR.cloud access token (free tier) that
  authorizes the hosted facilitator + hosted RPC + MCP. Documented in DEPLOYMENT.md.
- A2: x402 payment asset = a testnet CEP-18 token. If the buildathon provides a canonical
  x402 demo token package hash, use it; else `scripts/deploy-x402-token` mints one.
- A3: Facilitator pays settlement gas (per facilitator API "facilitator paying gas"),
  so testnet settlement is effectively sponsored for the resource server/payee.

## Open human inputs (see §SECRETS / DEPLOYMENT.md)
- ANTHROPIC_API_KEY
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
