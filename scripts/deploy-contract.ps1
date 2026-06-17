# Deploy the SignalOracle contract to Casper testnet via Odra livenet.
#
# Prereqs: producer key generated (npm run keygen) AND funded at the faucet;
# .env populated with CASPER_NODE_RPC_URL / CSPR_CLOUD_ACCESS_TOKEN.
#
# Steps: build wasm -> ensure wasm/SignalOracle.wasm -> run livenet deploy bin
#        -> capture DEPLOYED_ADDRESS -> write SIGNAL_ORACLE_CONTRACT_HASH to .env.
#
# Usage:  pwsh scripts/deploy-contract.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$contracts = Join-Path $root "contracts"
$envFile = Join-Path $root ".env"

# --- Load .env -----------------------------------------------------------------
if (-not (Test-Path $envFile)) { throw ".env not found. Copy .env.example to .env and fill it in." }
$envMap = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$') { $envMap[$Matches[1]] = $Matches[2] }
}

function Req($key) {
  if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
    throw "Missing $key in .env"
  }
  return $envMap[$key]
}

# --- Map verity .env -> Odra livenet env vars ---------------------------------
# Odra livenet node address has no /rpc suffix; strip it if present.
$node = (Req "CASPER_NODE_RPC_URL") -replace '/rpc/?$', ''
$env:ODRA_CASPER_LIVENET_NODE_ADDRESS = $node
$env:ODRA_CASPER_LIVENET_CHAIN_NAME = (Req "CASPER_CHAIN_NAME")
$env:ODRA_CASPER_LIVENET_SECRET_KEY_PATH = (Req "PRODUCER_SECRET_KEY_PATH")
if ($envMap.ContainsKey("CSPR_CLOUD_ACCESS_TOKEN") -and $envMap["CSPR_CLOUD_ACCESS_TOKEN"]) {
  $env:CSPR_CLOUD_AUTH_TOKEN = $envMap["CSPR_CLOUD_ACCESS_TOKEN"]
}

# --- Ensure gcc on PATH (Casper host deps need a C compiler) -------------------
$gccbin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.MSVCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
if (Test-Path $gccbin) { $env:Path = "$gccbin;$env:Path" }

Set-Location $contracts

# --- 1. Build wasm (tolerate cargo-odra's missing `cp` on Windows) ------------
Write-Host "==> Building contract wasm..." -ForegroundColor Cyan
cargo odra build 2>&1 | Write-Host
$wasmOut = Join-Path $contracts "wasm\SignalOracle.wasm"
if (-not (Test-Path $wasmOut)) {
  # cargo-odra copies via `cp` which is absent on Windows; copy manually.
  $raw = Get-ChildItem -Recurse -Filter "verity_signal_oracle_build_contract.wasm" |
    Where-Object { $_.FullName -like "*release*" } | Select-Object -First 1
  if (-not $raw) { throw "wasm not produced; check the build output above." }
  New-Item -ItemType Directory -Force -Path (Split-Path $wasmOut) | Out-Null
  Copy-Item $raw.FullName $wasmOut -Force
  Write-Host "    (copied raw wasm -> wasm/SignalOracle.wasm)" -ForegroundColor DarkGray
}
Write-Host "    wasm ready: $wasmOut" -ForegroundColor Green

# --- 2. Deploy via livenet -----------------------------------------------------
Write-Host "==> Deploying to $($env:ODRA_CASPER_LIVENET_CHAIN_NAME)..." -ForegroundColor Cyan
$deployOut = cargo run --bin deploy_signal_oracle --features livenet 2>&1 | Tee-Object -Variable lines | Out-String
Write-Host $deployOut

# --- 3. Capture the deployed address ------------------------------------------
$addrLine = ($deployOut -split "`n") | Where-Object { $_ -match 'DEPLOYED_ADDRESS=' } | Select-Object -First 1
if (-not $addrLine) { throw "Deploy did not print DEPLOYED_ADDRESS; inspect output above." }
$address = ($addrLine -replace '.*DEPLOYED_ADDRESS=', '').Trim()
$hashHex = $address -replace '^hash-', '' -replace '^contract-', '' -replace '^entity-contract-', ''

Write-Host "`n==> Deployed SignalOracle: $address" -ForegroundColor Green
Write-Host "    contract hash: $hashHex" -ForegroundColor Green
Write-Host "    explorer: $($envMap['CASPER_EXPLORER_BASE'])/contract/$hashHex" -ForegroundColor Green

# --- 4. Persist to .env --------------------------------------------------------
$content = Get-Content $envFile -Raw
if ($content -match '(?m)^SIGNAL_ORACLE_CONTRACT_HASH=.*$') {
  $content = $content -replace '(?m)^SIGNAL_ORACLE_CONTRACT_HASH=.*$', "SIGNAL_ORACLE_CONTRACT_HASH=$hashHex"
} else {
  $content += "`nSIGNAL_ORACLE_CONTRACT_HASH=$hashHex`n"
}
Set-Content -Path $envFile -Value $content -Encoding utf8
Write-Host "==> Wrote SIGNAL_ORACLE_CONTRACT_HASH to .env" -ForegroundColor Green
Write-Host "    Record the deploy tx hash from the output above in docs/DEPLOYMENT.md" -ForegroundColor Yellow
