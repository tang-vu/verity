/**
 * HTTP client for the hosted Casper x402 facilitator (CSPR.cloud). The
 * facilitator verifies a signed payment payload and settles it on-chain (it pays
 * the settlement gas), so the resource server never touches a node directly.
 *
 * Endpoints: GET /supported, POST /verify, POST /settle.
 * Request body mirrors the CSPR.cloud facilitator reference: a `paymentPayload`
 * (x402Version, resource, accepted, payload) plus the `paymentRequirements`.
 */
import type { VerityConfig } from "./env-config.js";
import type {
  FacilitatorSettleResponse,
  FacilitatorVerifyResponse,
  PaymentPayload,
  PaymentRequirements,
} from "./x402-types.js";

function authHeaders(config: VerityConfig): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.csprCloudAccessToken) {
    headers.Authorization = config.csprCloudAccessToken;
  }
  return headers;
}

/** Assemble the facilitator request body from a payload + requirements. */
function facilitatorBody(payload: PaymentPayload, req: PaymentRequirements) {
  return {
    paymentPayload: {
      x402Version: payload.x402Version,
      resource: {
        url: req.resource,
        description: req.description ?? null,
        mimeType: req.mimeType ?? null,
      },
      accepted: {
        scheme: req.scheme,
        network: req.network,
        asset: req.asset,
        amount: req.amount,
        payTo: req.payTo,
        maxTimeoutSeconds: req.maxTimeoutSeconds,
        extra: req.extra,
      },
      payload: payload.payload,
    },
    paymentRequirements: req,
  };
}

export async function facilitatorSupported(config: VerityConfig): Promise<unknown> {
  const res = await fetch(`${config.facilitatorUrl}/supported`, {
    method: "GET",
    headers: authHeaders(config),
  });
  return res.json();
}

export async function facilitatorVerify(
  config: VerityConfig,
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<FacilitatorVerifyResponse> {
  const res = await fetch(`${config.facilitatorUrl}/verify`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(facilitatorBody(payload, requirements)),
  });
  return (await res.json()) as FacilitatorVerifyResponse;
}

export async function facilitatorSettle(
  config: VerityConfig,
  payload: PaymentPayload,
  requirements: PaymentRequirements
): Promise<FacilitatorSettleResponse> {
  const res = await fetch(`${config.facilitatorUrl}/settle`, {
    method: "POST",
    headers: authHeaders(config),
    body: JSON.stringify(facilitatorBody(payload, requirements)),
  });
  return (await res.json()) as FacilitatorSettleResponse;
}
