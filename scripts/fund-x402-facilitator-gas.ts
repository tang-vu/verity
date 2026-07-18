/**
 * Top up the hosted x402 facilitator's gas account on TESTNET.
 *
 * The CSPR.cloud facilitator submits every settlement (transfer_with_authorization)
 * from its own account and pays the gas. When that account runs dry, /settle fails
 * with "insufficient balance" and paywalls fall back to verified-deferred. On
 * testnet anyone can refill it — this sends CSPR from our consumer account so
 * live settlements keep working for judges.
 *
 * Run: node --import tsx scripts/fund-x402-facilitator-gas.ts [amountCspr]
 */
import { loadConfig, loadPrivateKey, log, makeRpcClient, section } from "@verity/shared";
import pkg from "casper-js-sdk";
const { NativeTransferBuilder, PublicKey, Timestamp } = pkg as unknown as typeof import("casper-js-sdk");

// Facilitator account observed as the caller of every x402 settlement deploy
// (e.g. tx 296f5f66… on the X402Token package).
const FACILITATOR_PUBLIC_KEY =
  process.env.X402_FACILITATOR_PUBLIC_KEY ??
  "0202b2d69e2e66d9858ae7b19bfe802135ae93658146e48e1f8e1f762e00032a3449";

const TRANSFER_PAYMENT_MOTES = 100_000_000; // 0.1 CSPR native-transfer fee

async function main(): Promise<void> {
  const amountCspr = Number(process.argv[2] ?? 100);
  const config = loadConfig();
  section("fund x402 facilitator gas (testnet)");

  const rpc = makeRpcClient(config);
  const consumer = loadPrivateKey(config.consumerSecretKeyPath);
  log("info", `from consumer ${consumer.publicKey.toHex().slice(0, 12)}… -> facilitator ${FACILITATOR_PUBLIC_KEY.slice(0, 12)}…`);
  log("info", `amount: ${amountCspr} CSPR`);

  const tx = new NativeTransferBuilder()
    .from(consumer.publicKey)
    .target(PublicKey.fromHex(FACILITATOR_PUBLIC_KEY))
    .amount(String(Math.round(amountCspr * 1e9)))
    .id(Date.now())
    .chainName(config.chainName)
    .timestamp(new Timestamp(new Date(Date.now() - 60_000))) // node clock-skew buffer
    .payment(TRANSFER_PAYMENT_MOTES)
    .build();
  tx.sign(consumer);

  const res = await rpc.putTransaction(tx);
  const hash = res.transactionHash.toHex();
  log("ok", `submitted: ${hash}`);
  await rpc.waitForTransaction(tx, 120_000);
  log("ok", `confirmed: ${config.explorerBase}/transaction/${hash}`);
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
