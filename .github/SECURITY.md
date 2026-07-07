# Security Policy

## Scope

verity is a Casper **testnet** project built for the Casper Agentic Buildathon 2026.
It consists of Odra smart contracts (`contracts/`), TypeScript agents
(`oracle-agent/`, `defi-agent/`, `shared/`), and a Next.js dashboard (`web/`).
No mainnet funds are at risk, but we still take vulnerability reports seriously.

## Reporting a Vulnerability

- **Preferred:** open a private report via
  [GitHub Security Advisories](https://github.com/tang-vu/verity/security/advisories/new).
- Alternatively, open a GitHub issue **without** exploit details and ask for a
  private channel.

Please include reproduction steps, affected component (contract, agent, web),
and impact. Expect an acknowledgement within 72 hours.

## Supported Versions

Only the latest commit on `main` (the buildathon submission) is supported.

## Known Non-Issues

- Keys under `keys/` are git-ignored; only a `.gitkeep` placeholder is tracked.
- Contracts hold testnet CSPR / test tokens only.
