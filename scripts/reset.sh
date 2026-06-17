#!/usr/bin/env bash
# Reset local verity demo state (does NOT touch on-chain data or keys).
# Clears the local signal store + loop output so a fresh demo starts clean.
#
# Usage: bash scripts/reset.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Resetting local verity state..."

rm -rf "$ROOT/loop-output"
echo "    removed loop-output/ (signal store, smoke artifacts)"

# Keep keys and .env; only clear runtime artifacts.
if [ -d "$ROOT/contracts/wasm" ]; then
  echo "    (kept contracts/wasm — re-run 'cargo odra build' to rebuild)"
fi

echo "==> Done. On-chain contract + reputation are unaffected."
echo "    To re-seed reputation history: npm run seed"
echo "    To publish a fresh signal:     npm run oracle:publish"
