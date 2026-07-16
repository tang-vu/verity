/**
 * The product itself: the freshest signal an agent would pay for — asset,
 * directional call, LLM confidence and reasoning, anchored to its publish tx.
 */
import { fmtUsd, fmtWhen, short, txLink, type Signal } from "../lib/dashboard-data";

export function LatestSignalCard({ latest, loading }: { latest?: Signal; loading: boolean }) {
  return (
    <div className="panel">
      <p className="klabel">latest signal — the paid product</p>
      {latest ? (
        <>
          <div className="row" style={{ gap: 12 }}>
            <span className={`asset-chip ${latest.symbol === "PAXG" ? "rwa" : ""}`}>
              {latest.symbol}
              {latest.symbol === "PAXG" && <span style={{ fontWeight: 500 }}>· RWA gold</span>}
            </span>
            <span className={`badge ${latest.directionLabel.toLowerCase()}`}>{latest.directionLabel}</span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700 }}>{latest.confidence}%</span>
            <span className="sub">confidence · {latest.horizonHours}h horizon</span>
          </div>
          <div className="conf-meter"><div style={{ width: `${latest.confidence}%` }} /></div>
          <p className="sub" style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.6 }}>{latest.reasoning}</p>
          <div className="row" style={{ marginTop: 14 }}>
            <span className="mono sub">{latest.symbol} @ {fmtUsd(latest.priceUsdAtPublish)}</span>
            <span className="dim">·</span>
            <span className="sub">{fmtWhen(latest.publishedAt)}</span>
            <a className="txchip" href={latest.publishExplorerUrl || txLink(latest.publishTxHash)} target="_blank" rel="noreferrer">
              tx {short(latest.publishTxHash)} ↗
            </a>
          </div>
        </>
      ) : (
        <div className="sub">{loading ? <span className="skeleton">loading the latest signal…</span> : "No signals on-chain yet."}</div>
      )}
    </div>
  );
}
