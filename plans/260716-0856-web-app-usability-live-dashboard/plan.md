# Web app usability — live dashboard + interactive x402 (judge feedback 2026-07-16)

**Trigger:** Buildathon judge: "Please improve the web app side, and make it usable."

## Problems (deployed Vercel app)
1. Serves static snapshot frozen 2026-07-07 (`web/data/oracle-snapshot.json`, `force-static` routes) — "auto-refresh 5s" misleading.
2. Zero interactivity — product story is "pay x402 → get signal" but nothing to try.
3. Dev-facing copy on public site ("run `npm run oracle:serve`").
4. No step-by-step testing instructions (final-round requirement).
5. Table missing Asset (CSPR vs PAXG/RWA) + time columns.

## Key discovery
`api.testnet.cspr.live` (explorer backend) is **public, no token**: full deploy history per
contract package **with parsed args** → the dashboard can reconstruct live on-chain state
server-side with zero secrets:
- `deploys?contract_package_hash=<oracle>` → publish_signal/resolve_signal/stake/set_* (18 txs)
- `deploys?contract_package_hash=<token>` → transfer_with_authorization (x402 settlements, `to`=producer)
- Grading mirrors contract exactly: `is_correct` (UP: resolve>publish; DOWN: <; FLAT: ±50bps),
  accuracy = correct/resolved bps (neutral 5000), slash = 20% of remaining stake per wrong resolve.
- Verified against snapshot: 7 signals, 3/4 = 75%, bonded 1600.00, slashed 400.00 ✓

## Scope (user approved Full P1+P2+P3)
- **P1 live data:** `web/app/lib/explorer-api.ts` + `live-oracle-state.ts` (reconstruction,
  30s cache, snapshot fallback). `/api/oracle/*` become dynamic.
- **P2 real x402 on Vercel:** `/api/x402/signal` — real paywall route (402 → EIP-712 local verify
  → facilitator verify+settle; verified-deferred without token). `/api/x402/demo-buy` — POST,
  server-side consumer key executes real buy against own paywall, step trace, rate-limited.
  UI playground (stepper + curl snippet). Deps added to web: casper-js-sdk, casper-eip-712.
- **P3 polish:** judge guide card ("test in 3 steps"), Asset/time columns, honest
  live/snapshot badge, public-friendly copy, live revenue card.

## Vercel env needed (user action)
- `CSPR_CLOUD_ACCESS_TOKEN` — facilitator settle (without it: verified-deferred).
- `CONSUMER_SECRET_KEY_PEM` — demo-buy button (without it: button hidden/503, curl path still works).

## Constraints
- web/ stays self-contained (Vercel CLI deploys from web/ dir — no ../shared imports).
- casper-js-sdk is CJS webpack bundle → default-import shim + `serverExternalPackages`.
- Signature must be 65-byte `signAndAddAlgorithmBytes`.
- Keep project functional at all times (judges may visit mid-change).

## Status
- [x] Scout + design
- [x] Live state module (verified: matches on-chain 7 signals / 75% / 1600 bonded / 400 slashed / 3 settlements)
- [x] Oracle routes live (30s cache, snapshot fallback verified)
- [x] x402 paywall route (402 challenge + local EIP-712 verify tested; settle needs Vercel token)
- [x] demo-buy + playground UI (full flow tested locally, verified-deferred mode)
- [x] Polish + docs (README, PROGRESS, DEPLOYMENT)
- [ ] Vercel deploy + env vars (`CSPR_CLOUD_ACCESS_TOKEN`, `CONSUMER_SECRET_KEY_PEM`) + live settle check
