/**
 * Bootstrap `.env` from `.env.example` and inject the locally-generated producer
 * + consumer public keys / account hashes (so the only fields left blank are the
 * three [HUMAN] secrets). Idempotent: re-running refreshes the key-derived values
 * without clobbering secrets you've already pasted in.
 *
 * Run AFTER `npm run keygen`:  node scripts/init-env.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import casperSdk from "casper-js-sdk";
const { PrivateKey, KeyAlgorithm } = casperSdk;

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const examplePath = resolve(root, ".env.example");
const envPath = resolve(root, ".env");

function pubFromPem(pemPath) {
  const key = PrivateKey.fromPem(readFileSync(pemPath, "utf8"), KeyAlgorithm.ED25519);
  const pub = key.publicKey;
  return {
    publicKeyHex: pub.toHex(false),
    accountHash: pub.accountHash().toHex().replace(/^account-hash-/, ""),
  };
}

const producerPem = resolve(root, "keys/producer_secret_key.pem");
const consumerPem = resolve(root, "keys/consumer_secret_key.pem");
if (!existsSync(producerPem) || !existsSync(consumerPem)) {
  console.error("Missing key files. Run `npm run keygen` first.");
  process.exit(1);
}

const producer = pubFromPem(producerPem);
const consumer = pubFromPem(consumerPem);

// Start from existing .env if present, else from the example.
const base = existsSync(envPath) ? envPath : examplePath;
let content = readFileSync(base, "utf8");

const sets = {
  PRODUCER_PUBLIC_KEY_HEX: producer.publicKeyHex,
  PRODUCER_ACCOUNT_HASH: producer.accountHash,
  CONSUMER_PUBLIC_KEY_HEX: consumer.publicKeyHex,
  CONSUMER_ACCOUNT_HASH: consumer.accountHash,
};

for (const [key, value] of Object.entries(sets)) {
  const re = new RegExp(`^${key}=.*$`, "m");
  content = re.test(content) ? content.replace(re, `${key}=${value}`) : content + `\n${key}=${value}`;
}

writeFileSync(envPath, content);
console.log(".env written with generated public keys.");
console.log("Still required (paste these in .env):");
console.log("  DEEPSEEK_API_KEY=<https://platform.deepseek.com/api_keys>");
console.log("  CSPR_CLOUD_ACCESS_TOKEN=<https://console.cspr.cloud>");
console.log("Then FUND both accounts at https://testnet.cspr.live/tools/faucet:");
console.log(`  PRODUCER ${producer.publicKeyHex}`);
console.log(`  CONSUMER ${consumer.publicKeyHex}`);
