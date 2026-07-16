/**
 * x402 wire protocol for the Vercel-hosted paywall: payment types, the 402
 * challenge (payment requirements), and the Casper EIP-712
 * `TransferWithAuthorization` digest. Mirrors shared/src/x402-types.ts +
 * eip712-casper.ts byte-for-byte (type name, camelCase validAfter/validBefore,
 * field order) so signatures verify against the hosted CSPR.cloud facilitator.
 */
import {
  buildDomain,
  CASPER_DOMAIN_TYPES,
  hashTypedData,
  type EIP712Domain,
  type TypeDefinitions,
} from "@casper-ecosystem/casper-eip-712";
import {
  PRODUCER_ACCOUNT_HASH,
  X402_ASSET_DECIMALS,
  X402_ASSET_NAME,
  X402_ASSET_SYMBOL,
  X402_ASSET_VERSION,
  X402_NETWORK,
  X402_PRICE,
  X402_TOKEN_PACKAGE_HASH,
} from "./verity-public-config";

export const X402_VERSION = 2;
export const PAYMENT_HEADER = "X-PAYMENT";
export const PAYMENT_RESPONSE_HEADER = "X-PAYMENT-RESPONSE";

export interface Authorization {
  from: string; // "00" + 64-hex account hash
  to: string;
  value: string; // base units, base-10 string
  validAfter: string; // unix seconds
  validBefore: string;
  nonce: string; // 64-hex replay nonce (no 0x)
}

export interface PaymentRequirements {
  scheme: "exact";
  network: string;
  asset: string; // CEP-18 package hash (verifyingContract)
  payTo: string;
  amount: string;
  maxTimeoutSeconds: number;
  resource: string;
  description?: string;
  mimeType?: string;
  extra: { name: string; version: string; decimals: number; symbol?: string };
}

export interface PaymentPayload {
  x402Version: number;
  scheme: "exact";
  network: string;
  payload: {
    signature: string; // hex, 65-byte algorithm-prefixed
    publicKey: string;
    authorization: Authorization;
  };
}

/** Exact facilitator type definition (make-software/casper-x402 scheme.go). */
const X402_TRANSFER_TYPES: TypeDefinitions = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

const hex0x = (v: string) => (v.startsWith("0x") ? v : "0x" + v);

/** 32-byte EIP-712 digest the payer signs / the paywall verifies. */
export function buildTransferDigest(requirements: PaymentRequirements, auth: Authorization): Uint8Array {
  const domain: EIP712Domain = buildDomain(
    requirements.extra.name,
    requirements.extra.version,
    requirements.network,
    requirements.asset
  );
  const message: Record<string, unknown> = {
    from: hex0x(auth.from),
    to: hex0x(auth.to),
    value: BigInt(auth.value),
    validAfter: BigInt(auth.validAfter),
    validBefore: BigInt(auth.validBefore),
    nonce: hex0x(auth.nonce),
  };
  return hashTypedData(domain, X402_TRANSFER_TYPES, "TransferWithAuthorization", message, {
    domainTypes: CASPER_DOMAIN_TYPES,
  });
}

/** Account-hash hex -> the 33-byte "00"+hex address form x402 uses. */
export function toAddressForm(accountHashHex: string): string {
  const clean = accountHashHex.replace(/^0x/, "").replace(/^account-hash-/, "");
  return clean.length === 64 ? "00" + clean : clean;
}

/** The 402 challenge advertised by the paywall for `resourceUrl`. */
export function buildRequirements(resourceUrl: string): PaymentRequirements {
  return {
    scheme: "exact",
    network: X402_NETWORK,
    asset: X402_TOKEN_PACKAGE_HASH,
    payTo: toAddressForm(PRODUCER_ACCOUNT_HASH),
    amount: X402_PRICE,
    maxTimeoutSeconds: 120,
    resource: resourceUrl,
    description: "verity latest reputation-staked market signal",
    mimeType: "application/json",
    extra: {
      name: X402_ASSET_NAME,
      version: X402_ASSET_VERSION,
      decimals: X402_ASSET_DECIMALS,
      symbol: X402_ASSET_SYMBOL,
    },
  };
}
