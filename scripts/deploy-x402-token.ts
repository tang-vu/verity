/**
 * Deploy the x402 payment token (X402Token = CEP-18 + CEP-3009 + CEP-2612) to
 * Casper testnet, then fund the consumer account so it can actually pay the x402
 * paywall on-chain (the facilitator settles via `transfer_with_authorization`).
 *
 * Writes X402_ASSET_PACKAGE_HASH (+ name/symbol/decimals already in .env) so the
 * paywall flips from "verified-deferred" to full on-chain settlement.
 *
 * Prereqs: `cargo odra build` (produces contracts/wasm/X402Token.wasm), a FUNDED
 * producer key, .env populated. Run: `npm run deploy:x402-token`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Args,
  callContract,
  CLValue,
  deployLink,
  EntityIdentifier,
  Key,
  loadConfig,
  loadPrivateKey,
  log,
  makeRpcClient,
  require_,
  section,
  SessionBuilder,
} from "@verity/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = resolve(root, "contracts/wasm/X402Token.wasm");
const PACKAGE_KEY_NAME = "verity_x402_token_package_hash";
const DEPLOY_PAYMENT_MOTES = 600_000_000_000; // X402Token (CEP-18+3009+2612) is larger; 250 was out-of-gas
// Fund the consumer with this many base units (2 decimals → 100,000.00 x402USD).
const CONSUMER_FUNDING = 10_000_000;

function persistEnv(key: string, value: string): void {
  const envPath = resolve(root, ".env");
  let content = readFileSync(envPath, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : content + `\n${key}=${value}`;
  writeFileSync(envPath, content);
}

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — deploy x402 payment token");

  const wasm = readFileSync(WASM_PATH);
  log("ok", `Loaded X402Token wasm (${(wasm.length / 1024).toFixed(0)} KB)`);

  const signer = loadPrivateKey(require_(config, "producerSecretKeyPath", "set PRODUCER_SECRET_KEY_PATH"));
  const rpc = makeRpcClient(config);

  // init(chain_name) — must equal the EIP-712 domain chain id the x402 client
  // signs with, i.e. X402_NETWORK (CAIP-2, e.g. "casper:casper-test").
  const args = Args.fromMap({
    odra_cfg_package_hash_key_name: CLValue.newCLString(PACKAGE_KEY_NAME),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(false),
    odra_cfg_is_upgradable: CLValue.newCLValueBool(false),
    odra_cfg_is_upgrade: CLValue.newCLValueBool(false),
    chain_name: CLValue.newCLString(config.x402Network),
  });

  const tx = new SessionBuilder()
    .from(signer.publicKey)
    .wasm(new Uint8Array(wasm))
    .installOrUpgrade()
    .runtimeArgs(args)
    .chainName(config.chainName)
    .payment(DEPLOY_PAYMENT_MOTES)
    .build();
  tx.sign(signer);

  log("chain", "Submitting x402 token install...");
  const result = await rpc.putTransaction(tx);
  const txHash = result.transactionHash.toHex();
  log("ok", `Deploy tx: ${txHash}`);
  log("chain", deployLink(config.explorerBase, txHash));
  await rpc.waitForTransaction(tx, 180_000);

  const info = await rpc.getTransactionByTransactionHash(txHash);
  const execErr = info.executionInfo?.executionResult?.errorMessage;
  if (execErr) {
    throw new Error(`x402 token install FAILED on-chain: ${execErr} (tx ${txHash})`);
  }
  log("ok", "x402 token installed successfully.");

  // Resolve package hash from the deployer entity's named keys.
  let packageHash: string | undefined;
  try {
    const entity = await rpc.getLatestEntity(EntityIdentifier.fromPublicKey(signer.publicKey));
    const namedKeys =
      entity.entity.addressableEntity?.namedKeys ?? entity.entity.legacyAccount?.namedKeys ?? [];
    const nk = namedKeys.find((k) => k.name === PACKAGE_KEY_NAME);
    if (nk) {
      packageHash = nk.key
        .toString()
        .replace(/^hash-/, "")
        .replace(/^package-/, "")
        .replace(/^contract-package-/, "");
    }
  } catch (err) {
    log("warn", `Could not auto-read named keys (${err instanceof Error ? err.message : err}).`);
  }

  if (!packageHash) {
    log("warn", `Open ${config.explorerBase}/deploy/${txHash}, copy the "${PACKAGE_KEY_NAME}"`);
    log("warn", "named-key value, and set X402_ASSET_PACKAGE_HASH in .env manually.");
    return;
  }

  log("ok", `x402 token package hash: ${packageHash}`);
  persistEnv("X402_ASSET_PACKAGE_HASH", packageHash);
  log("ok", "Wrote X402_ASSET_PACKAGE_HASH to .env");

  // Fund the consumer so it can pay the paywall on-chain.
  if (config.consumerSecretKeyPath) {
    const consumer = loadPrivateKey(config.consumerSecretKeyPath);
    const recipient = Key.newKey(consumer.publicKey.accountHash().toPrefixedString());
    section("funding consumer with x402USD");
    const transferTx = await callContract({
      rpc,
      config,
      signer,
      packageHash,
      entryPoint: "transfer",
      args: Args.fromMap({
        to: CLValue.newCLKey(recipient),
        amount: CLValue.newCLUInt256(CONSUMER_FUNDING),
      }),
      paymentMotes: 4_000_000_000,
      wait: true,
    });
    log("ok", `Funded consumer ${CONSUMER_FUNDING} base units. tx: ${transferTx.txHash}`);
    log("chain", transferTx.explorerUrl);
  }

  section("x402 token ready");
  log("ok", "Paywall will now settle on-chain via the facilitator. Record hashes in docs/DEPLOYMENT.md.");
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
