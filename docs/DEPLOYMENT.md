# DEPLOYMENT — Casper testnet (`casper-test`)

Authoritative record of on-chain artifacts. Explorer base: https://testnet.cspr.live
**Status: FULL STACK LIVE — SignalOracle + X402Token deployed, reputation 75%, LLM signal published, x402 settled on-chain, autonomous loop closed. ✅**

## Accounts (funded ✅)

| Role | Public key | Account hash |
|---|---|---|
| Producer (oracle) | `016a6a79b53698c0a5205988e4a2d42dc0aea30735f5d41b55e65a2764e72c0cdc` | `971c1bd6ad47eff8cd815d53082a66e1246bf0ce09969c3dfca771c6a71d247d` |
| Consumer (DeFi agent) | `01f06b02c33c1408b7f61758ba39a8f513bf556a390db5b0a71ceabf457520c343` | `82ec56fef048bec1bec5811f123c1460615ba1514b6b1b886ce3c5b97a15d780` |

- Producer: https://testnet.cspr.live/account/016a6a79b53698c0a5205988e4a2d42dc0aea30735f5d41b55e65a2764e72c0cdc
- Consumer: https://testnet.cspr.live/account/01f06b02c33c1408b7f61758ba39a8f513bf556a390db5b0a71ceabf457520c343

## Contract: SignalOracle ✅ DEPLOYED

| Field | Value |
|---|---|
| Package hash | `e6a502b9c5002c921a6d4612588abcff1157689db2eabbba1ed8b62f51f79167` |
| Install/deploy tx | `197a3e7fb7d7bbcb57b2ef2d3f5955efc2df0edd1b9044bbc49a6410f2f4e8ab` |
| WASM | `contracts/wasm/SignalOracle.wasm` (218 KB, MVP-lowered) |

- Contract package: https://testnet.cspr.live/contract-package/e6a502b9c5002c921a6d4612588abcff1157689db2eabbba1ed8b62f51f79167
- Deploy tx: https://testnet.cspr.live/transaction/197a3e7fb7d7bbcb57b2ef2d3f5955efc2df0edd1b9044bbc49a6410f2f4e8ab

## Seeded reputation history ✅ (real publish+resolve, 3 correct / 1 wrong → 75%)

| Signal # | Outcome | Publish tx | Resolve tx |
|---|---|---|---|
| 1 | CORRECT | `ca8125b60e20c579bac3aba3ddfd5baca42f0cc27e5b87d4e5847450b1b1b549` | `fa401695431a9a77d694b043db7de0a7be20ddc8ab6caf4a36d42a49e924277d` |
| 2 | CORRECT | `9b4297dd3f4a1d9b8790015233b99262b18c5d9065bdcd46e238d82206a4874a` | `48a89a6b05af4af094a677da765b9132fce35480603f13b7b08db465693c70e5` |
| 3 | CORRECT | `5cba06fed2c70b04732be18a9f1a141e45480ba3364f4c88e4b5995738e4d781` | `882e86914350753362f2b9d17d901478145b91d5cd07bea2132184eb32a074b2` |
| 4 | WRONG | `b83ac0d423897326b7d8de23425f8e697ff3fdd553db1cc19ad9a5f3efacfb8c` | `eb6c26eda218f06018bf73a00ede23706314542b67ed42107b4bf4a3c8f555dd` |

## Live LLM signal ✅ (real CoinGecko data → DeepSeek → on-chain)

| Field | Value |
|---|---|
| Signal id | 0 |
| Call | FLAT @ 55% (CSPR/USD, 24h horizon) |
| Publish tx | `d1fa67bc38701082915427877d8a26e24df32c49291db92b02fd07a5adb5e3a6` |

- Publish tx: https://testnet.cspr.live/transaction/d1fa67bc38701082915427877d8a26e24df32c49291db92b02fd07a5adb5e3a6

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
