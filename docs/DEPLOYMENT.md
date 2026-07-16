# DEPLOYMENT — Casper testnet (`casper-test`)

Authoritative record of on-chain artifacts. Explorer base: https://testnet.cspr.live
**Status: FULL STACK LIVE (v2 — staking) — SignalOracle v2 with staking/slashing deployed, oracle bonded 2000 x402USD collateral, reputation 75%, a WRONG call SLASHED 400 x402USD on-chain to the consumer treasury, live CSPR/USD + PAXG (RWA) LLM signals published, x402 settled on-chain. ✅**

> v1 (pre-staking) SignalOracle was `e6a502b9…f79167`; superseded by v2 below (same
> `verity_signal_oracle_package_hash` named key, re-installed with staking).

## Accounts (funded ✅)

| Role | Public key | Account hash |
|---|---|---|
| Producer (oracle) | `016a6a79b53698c0a5205988e4a2d42dc0aea30735f5d41b55e65a2764e72c0cdc` | `971c1bd6ad47eff8cd815d53082a66e1246bf0ce09969c3dfca771c6a71d247d` |
| Consumer (DeFi agent) | `01f06b02c33c1408b7f61758ba39a8f513bf556a390db5b0a71ceabf457520c343` | `82ec56fef048bec1bec5811f123c1460615ba1514b6b1b886ce3c5b97a15d780` |

- Producer: https://testnet.cspr.live/account/016a6a79b53698c0a5205988e4a2d42dc0aea30735f5d41b55e65a2764e72c0cdc
- Consumer: https://testnet.cspr.live/account/01f06b02c33c1408b7f61758ba39a8f513bf556a390db5b0a71ceabf457520c343

## Contract: SignalOracle v2 (staking) ✅ DEPLOYED

| Field | Value |
|---|---|
| Package hash | `13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0` |
| Install/deploy tx | `58aad317976027848dd7d48ce066650a9792464f27c9b80705e204eb2f08e895` |
| WASM | `contracts/wasm/SignalOracle.wasm` (253 KB, MVP-lowered) |

- Contract package: https://testnet.cspr.live/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0
- Deploy tx: https://testnet.cspr.live/transaction/58aad317976027848dd7d48ce066650a9792464f27c9b80705e204eb2f08e895

## Seeded reputation history ✅ (real publish+resolve on v2, 3 correct / 1 wrong → 75%)

| Signal # | Outcome | Publish tx | Resolve tx |
|---|---|---|---|
| 1 | CORRECT | `9ded64d76af3e59df4d85392098eae68b17a1ec9ccd3178975620dfd79908592` | `01b7daffbd0728bc467d5982e8863af06307d8605b8010d80dcf20e6118095d1` |
| 2 | CORRECT | `f712b53dba092188f66e420365bbfacea0f454dc1cfe5ed39c3f19247e43b4c5` | `5286b8cfae8511fd06902a80b08f75d2ba99d86a94f35e410ab18d2c8eee6f61` |
| 3 | CORRECT | `773547f22e146f90215b47e612aacb223a2bd5becf108a649a7ee2ce98457f85` | `66aac67236ff6b6f2d9b532cdd747f6a8a94786af47ffce3c047755a7edbc340` |
| 4 | WRONG (→ slash) | `3929aac6add28523f87b4ac9e02c9e2f59c6e940937e2256fdf9cc9e6c11aa98` | `4ae1e222a9234c0a3cd9d3c437af247d352ea0359f99fa98fc748b1b4ba79f11` |

## Live LLM signals ✅ (real CoinGecko data → DeepSeek → on-chain)

| id | Call | Asset | Publish tx |
|---|---|---|---|
| 5 | FLAT @ 45% | CSPR/USD | `d9fb786f3f5b35649d7f4a12054e14df83702f20a15de322560dff64d298071f` |
| 6 | FLAT @ 65% | **PAXG (tokenized gold — RWA)** | `a11dcebba120bb2f20bad80fb1b2ce26bfc715afadb532fdf6d0b3d352219dcd` |

- CSPR signal: https://testnet.cspr.live/transaction/d9fb786f3f5b35649d7f4a12054e14df83702f20a15de322560dff64d298071f
- PAXG signal: https://testnet.cspr.live/transaction/a11dcebba120bb2f20bad80fb1b2ce26bfc715afadb532fdf6d0b3d352219dcd

## x402 payment token (X402Token) ✅ DEPLOYED + settling on-chain

| Field | Value |
|---|---|
| Package hash | `4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc` |
| Install/deploy tx | `657fb6ded4f8b359be3bd439590861e8671a35daf723396d2d114929c919badc` |
| Consumer funding tx (x402USD) | `1f22f222524417a923f6f3fdadeb5f9fde4766efeea2b051d78ada92a9af758c` |
| Contract | `contracts/src/x402_token.rs` (CEP-18 + CEP-3009 + CEP-2612) |

- Contract package: https://testnet.cspr.live/contract-package/4373bc321abc569b8d336d85bc37e9830a65f86f564cfe97edd32f4125c128cc

## x402 PAID READ — settled on-chain ✅ (facilitator submits transfer_with_authorization)

The DeFi agent paid the paywall; the Casper facilitator verified the EIP-712
authorization and **settled the CEP-18 transfer on-chain** (it pays the gas):

| Field | Value |
|---|---|
| Settlement tx | `0ee181dc4b5356dd5ef0fbcdc15a783023144605e361202b869de5246896f99b` |
| Payer | consumer (`0082ec56…`) |

- Settlement tx: https://testnet.cspr.live/transaction/0ee181dc4b5356dd5ef0fbcdc15a783023144605e361202b869de5246896f99b

## x402 facilitator + network

| Field | Value |
|---|---|
| Facilitator | `https://x402-facilitator.cspr.cloud` |
| CAIP-2 network | `casper:casper-test` |
| Hosted RPC | `https://node.testnet.cspr.cloud/rpc` (CSPR.cloud token) |

## Staking + slashing ✅ LIVE (real collateral, real on-chain slash)

The oracle bonded **2000.00 x402USD** collateral behind its word; a wrong call
**slashed 400.00 x402USD (20%) on-chain to the consumer treasury**, leaving 1600.00
bonded. Bond gate to publish: 500.00 x402USD.

| Step | On-chain tx |
|---|---|
| `set_stake_token` (x402USD as collateral) | `cd247c6845ddd9f4ed1fb8bcff05ddba4d51cf6f814974219be13d96f6031cbb` |
| `set_treasury` (→ consumer `0082ec56…`) | `cf747c58a8be6fae6d87a449be65ceb27839f02da2597354fe4905d77d0e0236` |
| `set_min_stake` (500 x402USD gate) | `2f8acc6666595a7f241c98008f43f3e41b8c330d4af6acbfb224e1e49eac6df5` |
| Oracle `approve` (x402USD → oracle pkg) | `2fc5a89c7b577a25dba0bb620400ce408489872048605a02af9cf53779232a00` |
| Oracle `stake` (bond 2000 x402USD) | `46a5d9b1a1f1dea027ae1bdca25f55e427879e7cdbc08714c753b11ac5ff0c78` |
| **On-chain slash** (400 x402USD, from signal #4's wrong resolve) | `4ae1e222a9234c0a3cd9d3c437af247d352ea0359f99fa98fc748b1b4ba79f11` |

Entry points on `SignalOracle` v2: `stake(amount)`, `withdraw_stake(amount)`,
`set_stake_token(token)`, `set_min_stake(amount)`, `set_treasury(treasury)`; views
`get_stake`, `min_stake`, `slashed_total`, `pending_count_of`, `stake_token`. Slash on
wrong resolve = 20% of the remaining bond → treasury.

> Node quirk resolved during bring-up: the CSPR.cloud node rejects any transaction
> whose timestamp "has not yet occurred". The build host clock ran ~5s ahead, so calls
> intermittently failed with `-32016`. `callContract` now stamps transactions 60s in the
> past (well within TTL), which fixed every call — including the cross-contract CLKey
> ones (`approve`/`stake`). Redeploys also pass `odra_cfg_allow_key_override=true` so a
> non-upgradable prior version can be replaced under the same named key.

## Web dashboard (Vercel) — live + interactive

Deployed from `web/` (self-contained, Vercel CLI: `cd web && vercel --prod`).

- **Live data needs NO secrets:** `/api/oracle/*` reconstructs signals/reputation/
  stake/revenue from the public explorer API (`api.testnet.cspr.live`), snapshot
  fallback in `web/data/oracle-snapshot.json`.
- **Real x402 paywall:** `GET /api/x402/signal` returns HTTP 402 + payment
  requirements; with `X-PAYMENT` it verifies the EIP-712 signature and settles via
  the facilitator.
- **Vercel env vars** (Project Settings → Environment Variables):

| Var | Purpose | Without it |
|---|---|---|
| `CSPR_CLOUD_ACCESS_TOKEN` | facilitator verify+settle (real on-chain settlement) | paywall runs verified-deferred (sig checked, no settle tx) |
| `CONSUMER_SECRET_KEY_PEM` | demo consumer key for the one-click "buy live" button (paste full PEM; testnet-only, low-value) | button returns 503, curl flow still works |

Local test: `CONSUMER_SECRET_KEY_PATH=<repo>/keys/consumer_secret_key.pem npm run web:dev`.

> Ops note: if paid buys start reporting "settlement deferred / facilitator_error",
> the hosted facilitator's gas account (`0202b2d6…3449`) may be dry again — refill on
> testnet with `node --import tsx scripts/fund-x402-facilitator-gas.ts 100`.
