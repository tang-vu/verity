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

## Deviations
- (none yet)
