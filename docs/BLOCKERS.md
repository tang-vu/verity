# BLOCKERS — precise record of what's gated and why

The floor stays intact regardless of these. Each item says exactly what's blocked,
the root cause, and the unblock step.

## B1 — Real testnet transactions need 3 human inputs (by design)

**Blocked:** publishing/resolving signals on-chain, x402 on-chain settlement,
CSPR.trade swap — i.e. anything that writes to `casper-test`.
**Root cause:** requires secrets only the human can provide (see `.env`):
`ANTHROPIC_API_KEY`, a **funded** account (faucet), `CSPR_CLOUD_ACCESS_TOKEN`.
**Unblock:** `npm run keygen && npm run init-env`, paste the 3 secrets, fund both
public keys at https://testnet.cspr.live/tools/faucet, then `npm run deploy:sdk`.
**Floor preserved:** contract is unit-tested (14/14), wasm builds, and the full
x402 sign⇄verify round-trip passes offline (`npm run smoke:x402`).

## B2 — Odra Rust livenet deployer doesn't compile on Windows

**Blocked:** `cargo run --bin deploy_signal_oracle --features livenet` on Windows.
**Root cause:** transitive `casper-types 6.1.0` uses Unix-only APIs
(`libc::sysconf`, `std::os::unix::fs::OpenOptionsExt::mode`) in its livenet path;
these don't exist on `x86_64-pc-windows-gnu`.
**Mitigation (implemented):** primary deploy path is `npm run deploy:sdk`
(casper-js-sdk `SessionBuilder` installing the pre-built wasm with the standard
Odra install args). Cross-platform, no Unix deps. The Rust deployer is retained
and works unchanged on Linux/macOS.
**Floor preserved:** the deployable artifact (`contracts/wasm/SignalOracle.wasm`)
is produced by the normal `cargo odra build`.

## B3 — `cargo odra build` post-step needs Unix `cp`

**Blocked:** the final copy/optimize step of `cargo odra build` panics on Windows
("program not found" for `cp`).
**Root cause:** cargo-odra 0.1.7 shells out to `cp`/`wasm-opt`/`wasm-strip`,
absent on a stock Windows box.
**Mitigation (implemented):** `scripts/deploy-contract.ps1` and the build flow
copy the compiled wasm from `target/wasm32-unknown-unknown/release/` into
`contracts/wasm/SignalOracle.wasm` directly. Optimization (size shrink) is
optional and not required for a valid deploy.
**Floor preserved:** valid wasm is produced and verified (magic bytes `00 61 73 6d`).

## B4 — x402 payment CEP-18 token package hash not yet set

**Blocked:** on-chain x402 *settlement* (the facilitator submitting a CEP-18
`transfer_with_authorization`).
**Root cause:** needs a testnet CEP-18 token package hash in `X402_ASSET_PACKAGE_HASH`
(the buildathon's canonical x402 demo token, or one we deploy).
**Mitigation (implemented):** paywall runs in **verified-deferred** mode — the
EIP-712 payment signature is cryptographically verified locally (proven by
`npm run smoke:x402`), and on-chain settlement engages automatically once the
token hash + `CSPR_CLOUD_ACCESS_TOKEN` are present. No code change needed to flip.
**Unblock:** set `X402_ASSET_PACKAGE_HASH` (+ token metadata) in `.env`.

## Open questions
- Does the buildathon publish a canonical testnet x402 demo CEP-18 token package
  hash? If so, paste it into `.env` / `docs/DEPLOYMENT.md`.
- Exact CSPR.trade MCP tool name + arg schema for a testnet swap — the executor
  discovers tools dynamically and adapts; confirmed names will be recorded once a
  live MCP session is run with a valid token.
