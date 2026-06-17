/**
 * Generate the producer (oracle) and consumer (DeFi agent) Ed25519 keypairs and
 * write them as PEM files under ./keys. Prints each public key + account hash and
 * the exact faucet steps so the human can fund them at https://testnet.cspr.live.
 *
 * Idempotent: existing key files are kept (pass --force to regenerate).
 *
 * Run: `npm run keygen`
 */
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import casperSdk from "casper-js-sdk";
const { PrivateKey, KeyAlgorithm } = casperSdk;

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const keysDir = resolve(root, "keys");
const force = process.argv.includes("--force");

mkdirSync(keysDir, { recursive: true });

/** Load an existing PEM key or generate+persist a fresh one. */
function ensureKey(name, pemPath) {
  if (existsSync(pemPath) && !force) {
    const key = PrivateKey.fromPem(readFileSync(pemPath, "utf8"), KeyAlgorithm.ED25519);
    return { key, created: false };
  }
  const key = PrivateKey.generate(KeyAlgorithm.ED25519);
  writeFileSync(pemPath, key.toPem(), { mode: 0o600 });
  return { key, created: true };
}

function describe(label, envPrefix, { key, created }, pemPath) {
  const pub = key.publicKey;
  const publicKeyHex = pub.toHex(false);
  const accountHash = pub.accountHash().toHex(); // "account-hash-<64hex>"
  const accountHashHex = accountHash.replace(/^account-hash-/, "");
  console.log(`\n=== ${label} ===`);
  console.log(`  status:        ${created ? "GENERATED (new)" : "loaded (existing)"}`);
  console.log(`  pem:           ${pemPath}`);
  console.log(`  public key:    ${publicKeyHex}`);
  console.log(`  account hash:  ${accountHashHex}`);
  console.log(`  .env →`);
  console.log(`     ${envPrefix}_PUBLIC_KEY_HEX=${publicKeyHex}`);
  console.log(`     ${envPrefix}_ACCOUNT_HASH=${accountHashHex}`);
  return { publicKeyHex, accountHashHex };
}

const producer = ensureKey("producer", resolve(keysDir, "producer_secret_key.pem"));
const consumer = ensureKey("consumer", resolve(keysDir, "consumer_secret_key.pem"));

console.log("\n############################################################");
console.log("# verity — Casper testnet keypairs");
console.log("############################################################");

const p = describe("PRODUCER (Oracle Agent)", "PRODUCER", producer, resolve(keysDir, "producer_secret_key.pem"));
const c = describe("CONSUMER (DeFi Agent)", "CONSUMER", consumer, resolve(keysDir, "consumer_secret_key.pem"));

console.log(`\n=== ACTION REQUIRED: fund both accounts on testnet ===`);
console.log(`  1. Open the faucet:   https://testnet.cspr.live/tools/faucet`);
console.log(`  2. Connect the Casper Wallet (or use the faucet form).`);
console.log(`  3. Request testnet CSPR for EACH public key below:`);
console.log(`       PRODUCER public key:  ${p.publicKeyHex}`);
console.log(`       CONSUMER public key:  ${c.publicKeyHex}`);
console.log(`  4. Paste the two PUBLIC_KEY_HEX / ACCOUNT_HASH pairs above into .env.`);
console.log(`     (PRODUCER_ACCOUNT_HASH doubles as the x402 PAYEE address.)`);
console.log(`\n  Explorer (watch funding land):`);
console.log(`       https://testnet.cspr.live/account/${p.publicKeyHex}`);
console.log(`       https://testnet.cspr.live/account/${c.publicKeyHex}`);
console.log(`\n  Keep ./keys/*.pem PRIVATE — they are gitignored. Do NOT share.\n`);
