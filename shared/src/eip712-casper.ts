/**
 * Casper EIP-712 typed-data digest for the x402 `transfer_with_authorization`
 * payment, built with the official `@casper-ecosystem/casper-eip-712` primitives.
 *
 * The type definition here intentionally mirrors the make-software/casper-x402
 * facilitator's `scheme.go` byte-for-byte (type name `TransferWithAuthorization`,
 * camelCase `validAfter`/`validBefore`, field order, solidity types) so the
 * digest we sign matches what the hosted facilitator's /verify recomputes.
 * Domain construction uses the lib's `buildDomain` + `CASPER_DOMAIN_TYPES`,
 * identical to the facilitator's `BuildDomain(..)` + `CasperDomainTypes`.
 */
import { randomBytes } from "node:crypto";
import {
  buildDomain,
  CASPER_DOMAIN_TYPES,
  hashTypedData,
  type EIP712Domain,
  type TypeDefinitions,
} from "@casper-ecosystem/casper-eip-712";

/** Exact x402 facilitator type definition (see scheme.go). */
export const X402_TRANSFER_TYPES: TypeDefinitions = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

export interface Authorization {
  /** 33-byte account-hash address form: "00" + 64 hex. */
  from: string;
  to: string;
  /** Token amount, base-10 string in the asset's smallest unit. */
  value: string;
  /** Unix seconds. */
  validAfter: string;
  validBefore: string;
  /** 32-byte replay-protection nonce, "0x" + 64 hex. */
  nonce: string;
}

export interface TypedDataInputs {
  assetName: string;
  assetVersion: string;
  /** CAIP-2 chain id, e.g. "casper:casper-test". */
  chainName: string;
  /** CEP-18 package hash (verifyingContract), 64 hex. */
  contractPackageHash: string;
  authorization: Authorization;
}

/** Fresh 32-byte nonce as "0x"-prefixed hex. */
export function randomNonceHex(): string {
  return "0x" + Buffer.from(randomBytes(32)).toString("hex");
}

function hex0x(value: string): string {
  return value.startsWith("0x") ? value : "0x" + value;
}

/** Compute the 32-byte EIP-712 digest for the authorization. */
export function buildTransferDigest(input: TypedDataInputs): Uint8Array {
  const domain: EIP712Domain = buildDomain(
    input.assetName,
    input.assetVersion,
    input.chainName,
    input.contractPackageHash
  );
  const a = input.authorization;
  const message: Record<string, unknown> = {
    from: hex0x(a.from),
    to: hex0x(a.to),
    value: BigInt(a.value),
    validAfter: BigInt(a.validAfter),
    validBefore: BigInt(a.validBefore),
    nonce: hex0x(a.nonce),
  };
  return hashTypedData(domain, X402_TRANSFER_TYPES, "TransferWithAuthorization", message, {
    domainTypes: CASPER_DOMAIN_TYPES,
  });
}
