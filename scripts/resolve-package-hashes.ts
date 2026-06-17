/**
 * Read the producer entity's named keys and write the deployed contract package
 * hashes into .env (SIGNAL_ORACLE_PACKAGE_HASH, X402_ASSET_PACKAGE_HASH). Used
 * when a deploy succeeded on-chain but the package hash wasn't auto-captured.
 *
 * Run: `node --import tsx scripts/resolve-package-hashes.ts`
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EntityIdentifier,
  loadConfig,
  loadPrivateKey,
  log,
  makeRpcClient,
  section,
} from "@verity/shared";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// named-key name on the producer entity -> .env var to populate.
const TARGETS: Record<string, string> = {
  verity_signal_oracle_package_hash: "SIGNAL_ORACLE_PACKAGE_HASH",
  verity_x402_token_package_hash: "X402_ASSET_PACKAGE_HASH",
};

function stripPrefix(keyStr: string): string {
  return keyStr
    .replace(/^hash-/, "")
    .replace(/^package-/, "")
    .replace(/^contract-package-wasm/, "")
    .replace(/^contract-package-/, "");
}

function persistEnv(key: string, value: string): void {
  const envPath = resolve(root, ".env");
  let content = readFileSync(envPath, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : content + `\n${key}=${value}`;
  writeFileSync(envPath, content);
}

async function main(): Promise<void> {
  const config = loadConfig();
  section("verity — resolve package hashes from named keys");

  const signer = loadPrivateKey(config.producerSecretKeyPath);
  const rpc = makeRpcClient(config);

  const entity = await rpc.getLatestEntity(EntityIdentifier.fromPublicKey(signer.publicKey));
  const namedKeys = entity.entity.addressableEntity?.namedKeys ?? [];
  log("info", `Producer has ${namedKeys.length} named keys:`);
  for (const nk of namedKeys) log("info", `  ${nk.name} = ${nk.key.toString()}`);

  let resolved = 0;
  for (const [nkName, envVar] of Object.entries(TARGETS)) {
    const nk = namedKeys.find((k) => k.name === nkName);
    if (!nk) {
      log("warn", `named key "${nkName}" not found (deploy that contract first?)`);
      continue;
    }
    const hash = stripPrefix(nk.key.toString());
    persistEnv(envVar, hash);
    log("ok", `${envVar}=${hash}`);
    resolved++;
  }

  section(`${resolved}/${Object.keys(TARGETS).length} package hashes written to .env`);
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
