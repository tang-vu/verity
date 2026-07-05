# verity — Buildathon Final Push (deadline 2026-07-07)

Extension gives ~2 days. Qualification already met; goal = maximize WIN odds on the
two advancement paths (CSPR.fans top-3 vote OR jury on 8 criteria).

## Workstreams (all approved by user; redeploy OK)

| # | Workstream | Criteria it lifts | Status |
|---|---|---|---|
| 1 | Staking + slashing (x402USD collateral) | Innovation, Working contracts, Tech exec | ✅ code+tests (26 pass, wasm built); live redeploy user-gated |
| 2 | RWA signal feed (PAXG tokenized gold via CoinGecko) | Real-world DeFi+RWA | ✅ `oracle:publish-rwa`; no contract change needed |
| 3 | Landing page + live dashboard | UX/Design, Long-term launch | ✅ hero+CTA+collateral card+RWA; web build green |
| 4 | Marketing assets (X thread, CSPR.fans copy, TG, brand) | Socials in place, community vote | ✅ `docs/marketing/community-vote-and-socials-kit.md`; account creation user-gated |
| 5 | Demo video 2–3 min (regenerate) | UX/Design, walkthrough req | ⏳ pipeline exists; regenerate after live redeploy |

## 1. Staking + slashing — design (real collateral, TS-callable)

Native CSPR needs a cargo-purse/session proxy (not reachable via casper-js-sdk
`ContractCallBuilder`), so stake is the **x402USD CEP-18** token instead — same
asset consumers pay in, callable with the existing `callContract` machinery.

- `stake(amount)` → `transfer_from(oracle → contract)` via `Cep18ContractRef`; records `stakes[oracle]`.
- `publish_signal` gated on `stakes[caller] >= min_stake` (default 0 → back-compat).
- `resolve_signal` WRONG → slash `SLASH_BPS` (20%) of stake, transfer to `treasury`
  (set to consumer: "bad data pays its victims"); `slashed_total` accrues.
- `withdraw_stake` locked while `pending_count[oracle] > 0`.
- Owner setters: `set_stake_token`, `set_min_stake`, `set_treasury`.
- Views: `get_stake`, `min_stake`, `slashed_total`, `pending_count_of`, `stake_token`.
- Pure `staking_math.rs` (slash math) + host tests deploy X402Token + SignalOracle.

Consumer side: read on-chain stake, gate + surface it in the decision (capital-at-risk
now backed by real, slashable collateral — not just an accuracy number).

## Live bring-up (one redeploy)
Redeploy SignalOracle → `set_stake_token(x402USD)` → `set_treasury(consumer)` →
`set_min_stake(X)` → oracle `approve` + `stake` → seed publish/resolve (incl. a WRONG
one to show a real on-chain slash) → publish live LLM signal (CSPR + PAXG).

## Open questions
- CSPR.fans project registration + real social handles = user action (assets prepared here).
