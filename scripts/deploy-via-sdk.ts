/**
 * Deploy the SignalOracle contract to Casper testnet using casper-js-sdk
 * (Windows-friendly path; the Rust `--features livenet` deployer needs a Unix
 * host). Installs the pre-built Odra wasm with the standard Odra install args,
 * then resolves the contract package hash from the deployer's named keys.
 *
 * Prereqs: `cargo odra build` (or scripts/deploy-contract.ps1 builds it),
 * a FUNDED producer key, and .env populated. Run: `npm run deploy:sdk`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Args,
  CLValue,
  deployLink,
  EntityIdentifier,
  loadConfig,
  loadPrivateKey,
  log,
  makeRpcClient,
  require_,
  section,
  SessionBuilder,
} from "@verity/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WASM_PATH = resolve(root, "contracts/wasm/SignalOracle.wasm");
const PACKAGE_KEY_NAME = "verity_signal_oracle_package_hash";
const DEPLOY_PAYMENT_MOTES = 250_000_000_000; // ~250 CSPR ceiling (MVP wasm installs cheaper)

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — deploy SignalOracle (casper-js-sdk)");

  const wasm = readFileSync(WASM_PATH);
  log("ok", `Loaded wasm (${(wasm.length / 1024).toFixed(0)} KB) from ${WASM_PATH}`);

  const signer = loadPrivateKey(require_(config, "producerSecretKeyPath", "set PRODUCER_SECRET_KEY_PATH"));
  const rpc = makeRpcClient(config);

  // Odra install args: cfg flags + (no constructor args; init() takes none).
  const args = Args.fromMap({
    odra_cfg_package_hash_key_name: CLValue.newCLString(PACKAGE_KEY_NAME),
    odra_cfg_allow_key_override: CLValue.newCLValueBool(false),
    odra_cfg_is_upgradable: CLValue.newCLValueBool(false),
  });

  const transaction = new SessionBuilder()
    .from(signer.publicKey)
    .wasm(new Uint8Array(wasm))
    .installOrUpgrade()
    .runtimeArgs(args)
    .chainName(config.chainName)
    .payment(DEPLOY_PAYMENT_MOTES)
    .build();
  transaction.sign(signer);

  log("chain", "Submitting install transaction...");
  const result = await rpc.putTransaction(transaction);
  const txHash = result.transactionHash.toHex();
  log("ok", `Deploy tx: ${txHash}`);
  log("chain", deployLink(config.explorerBase, txHash));

  log("info", "Waiting for execution (up to 2 min)...");
  await rpc.waitForTransaction(transaction, 180_000);

  // waitForTransaction only confirms inclusion — check the execution actually
  // succeeded (a reverted/preprocessing-failed install still "completes").
  const info = await rpc.getTransactionByTransactionHash(txHash);
  const execErr = info.executionInfo?.executionResult?.errorMessage;
  if (execErr) {
    throw new Error(`Install FAILED on-chain: ${execErr} (tx ${txHash})`);
  }
  log("ok", "Install executed successfully.");

  // Resolve the package hash from the deployer entity's named keys.
  let packageHash: string | undefined;
  try {
    const entity = await rpc.getLatestEntity(EntityIdentifier.fromPublicKey(signer.publicKey));
    const namedKeys = entity.entity.addressableEntity?.namedKeys ?? [];
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

  section("deploy complete");
  if (packageHash) {
    log("ok", `SignalOracle package hash: ${packageHash}`);
    log("chain", `${config.explorerBase}/contract-package/${packageHash}`);
    persistEnv("SIGNAL_ORACLE_PACKAGE_HASH", packageHash);
    persistEnv("SIGNAL_ORACLE_DEPLOY_HASH", txHash);
    log("ok", "Wrote SIGNAL_ORACLE_PACKAGE_HASH + SIGNAL_ORACLE_DEPLOY_HASH to .env");
  } else {
    log("warn", `Open ${config.explorerBase}/deploy/${txHash}, copy the`);
    log("warn", `"${PACKAGE_KEY_NAME}" named-key value, and set SIGNAL_ORACLE_PACKAGE_HASH in .env.`);
  }
  log("info", "Record the hashes in docs/DEPLOYMENT.md.");
}

function persistEnv(key: string, value: string): void {
  const envPath = resolve(root, ".env");
  let content = readFileSync(envPath, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : content + `\n${key}=${value}`;
  writeFileSync(envPath, content);
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
