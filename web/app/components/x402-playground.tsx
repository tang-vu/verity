"use client";

/**
 * Interactive x402 panel: one click runs a REAL machine-to-machine purchase —
 * a server-held demo consumer agent receives the 402 challenge from this
 * site's own paywall, signs the EIP-712 payment, and the CSPR.cloud
 * facilitator settles it on Casper testnet. Every run is a real transaction.
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
  const price = x402 ? `${fmtUnits(Number(x402.priceBaseUnits), x402.decimals)} ${x402.symbol}USD` : "a micro-payment";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://<this-site>";
  const curl = `curl -i ${origin}/api/x402/signal`;

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
    <div className="card full" id="try-it">
      <h2>Try it live — buy the signal over x402</h2>
      <p className="sub" style={{ margin: "0 0 12px", maxWidth: 760 }}>
        The signal is a <strong>paid product for machines</strong>. This button makes a demo consumer agent
        (key held server-side) run the real protocol against this site&apos;s own paywall: HTTP 402 →
        EIP-712 signature → <span className="mono">X-PAYMENT</span> → on-chain settlement of {price} on Casper testnet.
      </p>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn primary" onClick={buy} disabled={busy}>
          {busy ? "running the x402 flow…" : "⚡ Buy the latest signal (real testnet tx)"}
        </button>
        <span className="sub">takes ~5–20s · rate-limited</span>
      </div>

      {res && !res.ok && (
        <p className="err" style={{ marginTop: 0 }}>{res.error ?? "purchase failed"} </p>
      )}

      {res?.steps && res.steps.length > 0 && (
        <ol className="steps">
          {res.steps.map((s, i) => (
            <li key={i}>
              <strong>{s.title}</strong>
              <div className="sub">{s.detail}</div>
              {s.data != null && (
                <details>
                  <summary className="sub">raw protocol data</summary>
                  <pre>{JSON.stringify(s.data, null, 2)}</pre>
                </details>
              )}
            </li>
          ))}
        </ol>
      )}

      {res?.ok && signal && (
        <div className="unlocked">
          <div className="row">
            <span className="badge up" style={{ background: "rgba(77,163,255,0.15)", color: "var(--accent)" }}>UNLOCKED</span>
            <span className={`badge ${signal.directionLabel.toLowerCase()}`}>{signal.directionLabel}</span>
            <strong>{signal.symbol}</strong>
            <span className="sub">{signal.confidence}% confidence · {signal.horizonHours}h horizon</span>
          </div>
          <p className="sub" style={{ margin: "8px 0 6px" }}>{signal.reasoning}</p>
          {settle?.settlementTx ? (
            <div className="sub">
              💸 payment settled on-chain:{" "}
              <a className="mono" href={settle.settlementExplorerUrl ?? "#"} target="_blank" rel="noreferrer">
                {short(settle.settlementTx)}
              </a>{" "}
              — a real CEP-18 <span className="mono">transfer_with_authorization</span> executed by the facilitator
            </div>
          ) : (
            <div className="sub">payment cryptographically verified (settlement deferred on this deployment)</div>
          )}
        </div>
      )}

      <div className="sub" style={{ marginTop: 14 }}>
        Prefer your own terminal? The paywall speaks standard x402 — this returns the HTTP 402 challenge:
      </div>
      <pre className="curl">{curl}</pre>
    </div>
  );
}
