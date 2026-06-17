# Build every verity contract to wasm on Windows, bypassing cargo-odra's
# Unix-`cp` post-step. cargo-odra selects a contract via the ODRA_MODULE env var
# and emits a single build_contract bin; we set it per contract and copy the
# output ourselves (same approach cargo-odra uses internally, minus the cp panic).
#
# Usage: pwsh scripts/build-wasm.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$contracts = Join-Path $root "contracts"

# Contracts to build: struct name (= ODRA_MODULE value) -> output wasm filename.
$modules = @(
  @{ Name = "SignalOracle"; Out = "SignalOracle.wasm" },
  @{ Name = "X402Token";    Out = "X402Token.wasm" }
)

$gccbin = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\BrechtSanders.WinLibs.POSIX.MSVCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\mingw64\bin"
if (Test-Path $gccbin) { $env:Path = "$gccbin;$env:Path" }
$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"

Set-Location $contracts
$bin = "verity_signal_oracle_build_contract"
$rawWasm = Join-Path $contracts "target\wasm32-unknown-unknown\release\$bin.wasm"
$wasmDir = Join-Path $contracts "wasm"
New-Item -ItemType Directory -Force -Path $wasmDir | Out-Null

foreach ($m in $modules) {
  Write-Host "==> Building $($m.Name) -> wasm..." -ForegroundColor Cyan
  $env:ODRA_MODULE = $m.Name
  # Invoke via cmd /c so PowerShell 5.1 doesn't treat cargo's stderr (incl. the
  # normal "Finished" line) as a terminating error; rely on the exit code only.
  cmd /c "cargo build --target wasm32-unknown-unknown --bin $bin --release 2>&1"
  if ($LASTEXITCODE -ne 0) { throw "cargo build failed for $($m.Name)" }
  if (-not (Test-Path $rawWasm)) { throw "expected wasm not found: $rawWasm" }
  $dest = Join-Path $wasmDir $m.Out
  Copy-Item $rawWasm $dest -Force

  # Casper's node only runs MVP WebAssembly. Nightly Rust emits memory.copy/fill
  # (bulk-memory) and sign-ext ops that LLVM produces regardless of target-feature,
  # so we must actively LOWER them to MVP equivalents with wasm-opt (binaryen):
  # enable the features to read the binary, lower them to loops/MVP, then -Oz.
  cmd /c "npx --no-install wasm-opt --enable-bulk-memory --enable-sign-ext --enable-nontrapping-float-to-int --llvm-memory-copy-fill-lowering --signext-lowering --llvm-nontrapping-fptoint-lowering -Oz `"$dest`" -o `"$dest.opt`" 2>&1"
  if (($LASTEXITCODE -eq 0) -and (Test-Path "$dest.opt")) {
    Move-Item "$dest.opt" $dest -Force
    Write-Host "    lowered to MVP + optimized $($m.Out)" -ForegroundColor DarkGray
  } else {
    if (Test-Path "$dest.opt") { Remove-Item "$dest.opt" -Force }
    Write-Host "    WARNING: wasm-opt unavailable; wasm may contain post-MVP ops the node rejects" -ForegroundColor Yellow
  }
  $kb = [math]::Round((Get-Item $dest).Length / 1KB, 1)
  Write-Host "    saved $($m.Out) ($kb KB)" -ForegroundColor Green
}

Write-Host "==> All contract wasm built." -ForegroundColor Green
Get-ChildItem $wasmDir
