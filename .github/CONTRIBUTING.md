# Contributing to verity

Thanks for your interest! verity is a Casper Agentic Buildathon 2026 project:
a reputation-staked x402 signal oracle plus an autonomous DeFi agent on Casper
testnet.

## Getting Started

1. Read the [README](../README.md) — the **Quickstart** section covers
   prerequisites (Node 22+, Rust nightly, Casper testnet keys) and setup.
2. Repo layout:
   - `contracts/` — Odra (Rust) smart contracts: `SignalOracle`, `X402Token`
   - `oracle-agent/` — LLM oracle that publishes signals and serves them over x402
   - `defi-agent/` — consumer agent that pays per signal and sizes trades by reputation
   - `shared/` — shared TypeScript utilities (Casper SDK, x402, EIP-712)
   - `web/` — Next.js dashboard
   - `scripts/` — deploy / demo / ops scripts

## Development Workflow

```bash
npm ci                 # install workspaces
npm run typecheck      # TS typecheck (shared, oracle-agent, defi-agent, scripts)
npm run test:agent     # DeFi agent unit tests
cd contracts && cargo test   # 26 contract tests on OdraVM
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and PR.

## Pull Requests

- Branch from `main`; keep PRs focused on one change.
- Use [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`).
- Make sure `npm run typecheck`, `npm run test:agent`, and `cargo test` pass.
- Never commit keys, `.env` files, or other secrets — `keys/` is git-ignored
  on purpose.

## Reporting Bugs / Requesting Features

Use the issue templates. For security issues, see
[SECURITY.md](SECURITY.md) — do not open public issues with exploit details.
