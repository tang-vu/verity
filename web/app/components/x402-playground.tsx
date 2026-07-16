"use client";

/**
 * Interactive x402 terminal: one click runs a REAL machine-to-machine purchase —
 * a server-held demo consumer agent receives the 402 challenge from this site's
 * own paywall, signs the EIP-712 payment, and the CSPR.cloud facilitator
 * settles it on Casper testnet. Steps render like a console session.
 */
import { useState } from "react";
import { fmtUnits, short, type Signal, type X402Info } from "../lib/dashboard-data";

interface Step { title: string; detail: string; data?: unknown }
interface BuyResult {
  ok: boolean;
  error?: string;
  steps?: Step[];
  result?: {
    signal?: Signal;
    x402?: { mode: string; settlementTx?: string | null; settlementExplorerUrl?: string | null };
  };
}

export function X402Playground({ x402 }: { x402?: X402Info | null }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<BuyResult | null>(null);
  const price = x402 ? `${fmtUnits(Number(x402.priceBaseUnits), x402.decimals)} ${x402.symbol}USD` : "a micropayment";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://<this-site>";

  async function buy() {
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch("/api/x402/demo-buy", { method: "POST" });
      setRes((await r.json()) as BuyResult);
    } catch (e) {
      setRes({ ok: false, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const signal = res?.result?.signal;
  const settle = res?.result?.x402;

  return (
    <div className="section" id="try-it">
      <p className="klabel">try it — buy the signal over x402, for real</p>
      <div className="term">
        <div className="term-bar">
          <span className="dots"><i /><i /><i /></span>
          consumer-agent · x402 · casper-test
          <span className="spacer" />
          <span className="dim">{price} / query</span>
        </div>
        <div className="term-body">
          <p className="step-detail" style={{ margin: "0 0 14px", maxWidth: "72ch" }}>
            This button makes a demo consumer agent (key held server-side) run the real protocol against
            this site&apos;s own paywall: <b>HTTP 402 → EIP-712 signature → X-PAYMENT → on-chain settlement</b>.
            Every run is a real Casper testnet transaction.
          </p>
          <div className="row" style={{ marginBottom: 6 }}>
            <button className="btn primary" onClick={buy} disabled={busy}>
              {busy ? "running the x402 flow…" : "⚡ Buy the latest signal"}
            </button>
            <span className="sub">~5–20s · rate-limited · spends real testnet x402USD</span>
          </div>

          {busy && <div className="cursor-line" style={{ padding: "10px 0" }}>negotiating payment with the paywall</div>}
          {res && !res.ok && <p className="err">{res.error ?? "purchase failed"}</p>}

          {res?.steps && res.steps.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {res.steps.map((s, i) => (
                <div className="step-line" key={i} style={{ animationDelay: `${i * 0.35}s` }}>
                  <span className="step-no">[{i + 1}/{res.steps!.length}]</span>
                  <div style={{ minWidth: 0 }}>
                    <span className="step-title">{s.title}</span>
                    <div className="step-detail">{s.detail}</div>
                    {s.data != null && (
                      <details>
                        <summary>raw protocol data</summary>
                        <pre>{JSON.stringify(s.data, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {res?.ok && signal && (
            <div className="unlocked" style={{ animationDelay: `${(res.steps?.length ?? 0) * 0.35}s` }}>
              <div className="row">
                <span className="badge up">UNLOCKED</span>
                <span className={`asset-chip ${signal.symbol === "PAXG" ? "rwa" : ""}`}>{signal.symbol}</span>
                <span className={`badge ${signal.directionLabel.toLowerCase()}`}>{signal.directionLabel}</span>
                <span className="sub">{signal.confidence}% confidence · {signal.horizonHours}h horizon</span>
              </div>
              <p className="sub" style={{ margin: "10px 0 8px", fontSize: 13.5 }}>{signal.reasoning}</p>
              {settle?.settlementTx ? (
                <div className="sub">
                  payment settled on-chain →{" "}
                  <a className="txchip" href={settle.settlementExplorerUrl ?? "#"} target="_blank" rel="noreferrer">
                    {short(settle.settlementTx)} ↗
                  </a>{" "}
                  a real CEP-18 <span className="mono">transfer_with_authorization</span> by the facilitator
                </div>
              ) : (
                <div className="sub">payment cryptographically verified — settlement deferred on this deployment</div>
              )}
            </div>
          )}

          <div className="sub" style={{ marginTop: 18 }}>
            Prefer your own terminal? The paywall speaks standard x402 — this returns the raw HTTP 402 challenge:
          </div>
          <pre className="curl">curl -i {origin}/api/x402/signal</pre>
        </div>
      </div>
    </div>
  );
}
