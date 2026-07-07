# MCP server + dashboard upgrades (buildathon scoring)

Goal: raise Final-Round judging scores (Innovation, Long-term impact, UX) without touching the live v2 contract.

## Phase 1 — verity MCP server ✅ target
- `oracle-agent/src/mcp-server.ts` — stdio MCP server, 4 no-arg tools:
  - `verity_get_reputation` (free) — on-chain accuracy + bonded/slashed collateral
  - `verity_get_signal_history` (free) — audit trail
  - `verity_get_payment_requirements` (free) — machine-readable x402 price quote
  - `verity_buy_latest_signal` (PAID) — full x402 flow: probe 402 → sign EIP-712 → pay → signal
- Reuses `@verity/shared` stores + `payAndFetch`; no console.log on stdout (stdio protocol).
- `scripts/smoke-mcp.ts` — e2e proof: in-process paywalled express server + real MCP client over stdio buys the signal.
- Scripts: `oracle:mcp`, `smoke:mcp`. Dep: `@modelcontextprotocol/sdk` added to oracle-agent.

## Phase 2 — dashboard chart + revenue panel
- `web/app/lib/dashboard-data.ts` — extract types + helpers from page.tsx (modularization).
- `web/app/components/reputation-history-chart.tsx` — SVG cumulative-accuracy line over resolved signals.
- `web/app/components/x402-revenue-card.tsx` — paid queries, on-chain settlements, revenue.
- Snapshot generator + `/api/oracle/reputation` gain `x402: { priceBaseUnits, symbol, decimals }`.
- Regenerate `web/data/oracle-snapshot.json`.

## Phase 3 — docs
- README: MCP server section + toolkit table row + judging table row.

## Validation
- `npm run typecheck` · `npm run smoke:mcp` · `npm run smoke:x402` · `npm run test:agent` · `npm run web:build`

## Status
- [x] Phase 1  - [x] Phase 2  - [x] Phase 3 (check off on completion)

## Risks
- MCP SDK bundles its own zod v3 — avoided by declaring tools without input schemas (all tools are no-arg).
- Live dashboard on Vercel redeploys from main — web build verified locally before push.
