"use client";

import { useEffect, useState } from "react";
import { ReputationHistoryChart } from "./components/reputation-history-chart";
import { X402RevenueCard } from "./components/x402-revenue-card";
import {
  EXPLORER,
  fmtUnits,
  getJson,
  short,
  txLink,
  type LoopEntry,
  type LoopResponse,
  type RepResponse,
  type Signal,
  type SignalsResponse,
} from "./lib/dashboard-data";

const GITHUB = process.env.NEXT_PUBLIC_GITHUB_URL ?? "https://github.com/tang-vu/verity";
const DEMO = process.env.NEXT_PUBLIC_DEMO_URL ?? "https://youtu.be/wp5KoLqxDU4";
const CONTRACT = `${EXPLORER}/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0`;

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rep, setRep] = useState<RepResponse | null>(null);
  const [loop, setLoop] = useState<LoopEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, r, l] = await Promise.all([
          getJson<SignalsResponse>("/api/oracle/signals"),
          getJson<RepResponse>("/api/oracle/reputation"),
          getJson<LoopResponse>("/api/oracle/loop-log").catch(() => ({ count: 0, entries: [] as LoopEntry[] })),
        ]);
        if (!alive) return;
        setSignals(s.signals.slice().reverse());
        setRep(r);
        setLoop(l.entries);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const accuracyPct = rep ? (rep.reputation.accuracyBps / 100).toFixed(1) : "—";
  const latest = signals[0];
  const stake = rep?.stake ?? null;

  return (
    <div className="wrap">
      <div className="header">
        <h1>verity</h1>
        <span className="pill">Casper testnet · casper-test</span>
        <span className="pill">x402 · reputation-staked oracle</span>
      </div>
      <p className="tagline">
        The trust layer for the machine economy. An oracle bonds real collateral behind every call —
        its word is worth <strong>exactly</strong> its on-chain accuracy, and a wrong call <em>slashes</em> its
        stake. A DeFi agent pays per signal over x402 and sizes its trade by that verifiable reputation.
        No human in the loop.
      </p>

      <div className="cta">
        <a className="btn primary" href={DEMO} target="_blank" rel="noreferrer">▶ Watch the demo</a>
        <a className="btn" href={GITHUB} target="_blank" rel="noreferrer">GitHub</a>
        <a className="btn" href={CONTRACT} target="_blank" rel="noreferrer">View contract on cspr.live</a>
      </div>
      <p className="sub" style={{ margin: "0 0 22px" }}>
        Casper Agentic Buildathon 2026 · Build Direction #2 — RWA Oracle Agents with verifiable on-chain reputation.
        Signals cover CSPR/USD and <strong>PAXG</strong> (tokenized gold — a real-world asset).
      </p>

      {error && (
        <p className="err">
          oracle API unreachable ({error}). Start it with <span className="mono">npm run oracle:serve</span>.
        </p>
      )}

      <div className="grid">
        <div className="card">
          <h2>Oracle on-chain reputation</h2>
          <div className="big">{accuracyPct}%</div>
          <div className="repbar">
            <div style={{ width: `${rep ? rep.reputation.accuracyBps / 100 : 0}%` }} />
          </div>
          <div className="sub">
            {rep
              ? `${rep.reputation.correctSignals}/${rep.reputation.resolvedSignals} resolved correct · ${rep.reputation.totalSignals} published`
              : "loading…"}
          </div>
          <ReputationHistoryChart signals={signals} />
          {rep?.contract && (
            <div className="sub" style={{ marginTop: 8 }}>
              contract:{" "}
              <a href={rep.explorer ?? "#"} target="_blank" rel="noreferrer" className="mono">
                {short(rep.contract)}
              </a>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Bonded collateral (skin in the game)</h2>
          {stake ? (
            <>
              <div className="big" style={{ fontSize: 34 }}>
                {fmtUnits(stake.bondedBaseUnits, stake.decimals)} <span className="sub" style={{ fontSize: 16 }}>{stake.stakeSymbol}</span>
              </div>
              <div className="sub" style={{ marginTop: 6 }}>
                at risk now · gate to publish: {fmtUnits(stake.minStakeBaseUnits, stake.decimals)} {stake.stakeSymbol}
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <span className="badge wrong">slashed {fmtUnits(stake.slashedBaseUnits, stake.decimals)} {stake.stakeSymbol}</span>
                <span className="sub">to a consumer-protection treasury</span>
              </div>
              {stake.txs && stake.txs.length > 0 && (
                <div className="sub" style={{ marginTop: 10 }}>
                  {stake.txs.slice(-3).map((t, i) => (
                    <span key={i} style={{ marginRight: 10 }}>
                      <a className="mono" href={t.explorerUrl} target="_blank" rel="noreferrer">{t.label} {short(t.txHash)}</a>
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="sub">
              collateral not bonded yet — run <span className="mono">npm run enable:staking</span>.
              Once bonded, wrong calls slash real capital on-chain.
            </div>
          )}
        </div>

        <div className="card">
          <h2>Latest signal (the paid product)</h2>
          {latest ? (
            <>
              <div className="row">
                <span className={`badge ${latest.directionLabel.toLowerCase()}`}>{latest.directionLabel}</span>
                <span className="big" style={{ fontSize: 28 }}>{latest.confidence}%</span>
                <span className="sub">confidence · {latest.horizonHours}h horizon</span>
              </div>
              <p className="sub" style={{ marginTop: 10 }}>{latest.reasoning}</p>
              <div className="sub" style={{ marginTop: 8 }}>
                {latest.symbol} @ ${latest.priceUsdAtPublish} ·{" "}
                <a href={latest.publishExplorerUrl || txLink(latest.publishTxHash)} target="_blank" rel="noreferrer" className="mono">
                  tx {short(latest.publishTxHash)}
                </a>
              </div>
            </>
          ) : (
            <div className="sub">no signals yet — run <span className="mono">npm run oracle:publish</span></div>
          )}
        </div>

        <X402RevenueCard loop={loop} x402={rep?.x402} />

        <div className="card full">
          <h2>Signal history (each row links to its real testnet tx)</h2>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Dir</th><th>Conf</th><th>Status</th>
                <th>Publish $</th><th>Resolve $</th><th>Publish tx</th><th>Resolve tx</th>
              </tr>
            </thead>
            <tbody>
              {signals.length === 0 && (
                <tr><td colSpan={8} className="sub">no signals yet</td></tr>
              )}
              {signals.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.id}</td>
                  <td><span className={`badge ${s.directionLabel.toLowerCase()}`}>{s.directionLabel}</span></td>
                  <td className="mono">{s.confidence}%</td>
                  <td><span className={`badge ${s.statusLabel.toLowerCase()}`}>{s.statusLabel}</span></td>
                  <td className="mono">${s.priceUsdAtPublish}</td>
                  <td className="mono">{s.priceUsdAtResolve != null ? `$${s.priceUsdAtResolve}` : "—"}</td>
                  <td className="mono">
                    {s.publishTxHash && s.publishTxHash !== "n/a"
                      ? <a href={s.publishExplorerUrl || txLink(s.publishTxHash)} target="_blank" rel="noreferrer">{short(s.publishTxHash)}</a>
                      : "—"}
                  </td>
                  <td className="mono">
                    {s.resolveTxHash
                      ? <a href={s.resolveExplorerUrl || txLink(s.resolveTxHash)} target="_blank" rel="noreferrer">{short(s.resolveTxHash)}</a>
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card full">
          <h2>Autonomous agent loop (signal → x402 payment → reputation-weighted action)</h2>
          <ul className="loglist">
            {loop.length === 0 && (
              <li><span className="sub">no loop runs yet — run <span className="mono">npm run agent:loop</span></span></li>
            )}
            {loop.map((e, i) => (
              <li key={i}>
                <span className="ico">🤖</span>
                <span>
                  <strong>#{e.signalId} {e.directionLabel} @ {e.confidence}%</strong>
                  {" · "}rep <strong>{(e.reputationBps / 100).toFixed(1)}%</strong>
                  {" → "}<span className={`badge ${e.decisionSide === "BUY" ? "up" : e.decisionSide === "SELL" ? "down" : "pending"}`}>{e.decisionSide}{e.decisionNotional ? ` ${e.decisionNotional}` : ""}</span>
                  <br />
                  <span className="sub">{e.decisionRationale}</span>
                  <br />
                  <span className="sub">
                    x402 {e.paid ? "paid" : "free"}
                    {e.settlementTx && (<> · settle <a className="mono" href={txLink(e.settlementTx)} target="_blank" rel="noreferrer">{short(e.settlementTx)}</a></>)}
                    {" · swap "}{e.swapVia}
                    {e.swapTx && (<> <a className="mono" href={e.swapExplorerUrl || txLink(e.swapTx)} target="_blank" rel="noreferrer">{short(e.swapTx)}</a></>)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="foot row">
        <span>verity · Casper Agentic Buildathon 2026</span>
        <span className="spacer" />
        <span>{updatedAt ? `updated ${new Date(updatedAt).toLocaleTimeString()}` : "connecting…"} · auto-refresh 5s</span>
      </div>
    </div>
  );
}
