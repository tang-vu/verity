/**
 * Centralised, typed environment configuration for every verity component.
 *
 * `loadConfig()` reads `process.env` (after dotenv) and returns a typed object.
 * Secrets that are only needed for specific operations are left optional here
 * and asserted at the point of use via the `require*` helpers, so simply
 * importing this module never throws when a secret is absent.
 */
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

export interface VerityConfig {
  // LLM
  anthropicApiKey?: string;
  anthropicModel: string;
  // Casper network
  chainName: string;
  nodeRpcUrl: string;
  explorerBase: string;
  // Keys
  producerSecretKeyPath: string;
  consumerSecretKeyPath: string;
  producerPublicKeyHex?: string;
  consumerPublicKeyHex?: string;
  payeeAddress?: string;
  // Deployed contract
  signalOracleContractHash?: string;
  signalOraclePackageHash?: string;
  // x402 + facilitator
  csprCloudAccessToken?: string;
  facilitatorUrl: string;
  x402AssetPackageHash?: string;
  x402AssetName: string;
  x402AssetSymbol: string;
  x402AssetDecimals: number;
  x402AssetVersion: string;
  x402Price: string;
  x402Network: string;
  // Oracle server
  oracleServerPort: number;
  oracleServerUrl: string;
  // MCP
  csprTradeMcpUrl: string;
  casperMcpUrl: string;
  // Demo behaviour
  signalAsset: string;
  signalVsCurrency: string;
  consumerMaxNotional: string;
  consumerMinReputationBps: number;
}

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(): VerityConfig {
  const e = process.env;
  return {
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    anthropicModel: e.ANTHROPIC_MODEL ?? "claude-sonnet-4-6",
    chainName: e.CASPER_CHAIN_NAME ?? "casper-test",
    nodeRpcUrl: e.CASPER_NODE_RPC_URL ?? "https://node.testnet.cspr.cloud/rpc",
    explorerBase: e.CASPER_EXPLORER_BASE ?? "https://testnet.cspr.live",
    producerSecretKeyPath: e.PRODUCER_SECRET_KEY_PATH ?? "./keys/producer_secret_key.pem",
    consumerSecretKeyPath: e.CONSUMER_SECRET_KEY_PATH ?? "./keys/consumer_secret_key.pem",
    producerPublicKeyHex: e.PRODUCER_PUBLIC_KEY_HEX,
    consumerPublicKeyHex: e.CONSUMER_PUBLIC_KEY_HEX,
    payeeAddress: e.PRODUCER_ACCOUNT_HASH,
    signalOracleContractHash: e.SIGNAL_ORACLE_CONTRACT_HASH,
    signalOraclePackageHash: e.SIGNAL_ORACLE_PACKAGE_HASH,
    csprCloudAccessToken: e.CSPR_CLOUD_ACCESS_TOKEN,
    facilitatorUrl: e.X402_FACILITATOR_URL ?? "https://x402-facilitator.cspr.cloud",
    x402AssetPackageHash: e.X402_ASSET_PACKAGE_HASH,
    x402AssetName: e.X402_ASSET_NAME ?? "x402USD",
    x402AssetSymbol: e.X402_ASSET_SYMBOL ?? "x402",
    x402AssetDecimals: num(e.X402_ASSET_DECIMALS, 2),
    x402AssetVersion: e.X402_ASSET_VERSION ?? "1",
    x402Price: e.X402_PRICE ?? "10",
    x402Network: e.X402_NETWORK ?? "casper:casper-test",
    oracleServerPort: num(e.ORACLE_SERVER_PORT, 4021),
    oracleServerUrl: e.ORACLE_SERVER_URL ?? "http://localhost:4021",
    csprTradeMcpUrl: e.CSPR_TRADE_MCP_URL ?? "https://mcp.cspr.trade/mcp",
    casperMcpUrl: e.CASPER_MCP_URL ?? "https://mcp.cspr.cloud/mcp",
    signalAsset: e.SIGNAL_ASSET ?? "casper-network",
    signalVsCurrency: e.SIGNAL_VS_CURRENCY ?? "usd",
    consumerMaxNotional: e.CONSUMER_MAX_NOTIONAL ?? "1000",
    consumerMinReputationBps: num(e.CONSUMER_MIN_REPUTATION_BPS, 4000),
  };
}

/** Assert a config field is present, with an actionable error message. */
export function require_<K extends keyof VerityConfig>(
  config: VerityConfig,
  key: K,
  hint: string
): NonNullable<VerityConfig[K]> {
  const value = config[key];
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required config "${String(key)}". ${hint}`);
  }
  return value as NonNullable<VerityConfig[K]>;
}
