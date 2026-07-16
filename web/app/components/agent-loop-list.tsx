/**
 * The autonomous consumer agent's decision timeline: for each run — the signal
 * it bought over x402, the oracle reputation it read, and the
 * reputation-weighted trade it executed, linked to real settlement/swap txs.
 */
import { short, txLink, type LoopEntry } from "../lib/dashboard-data";

export function AgentLoopList({ loop }: { loop: LoopEntry[] }) {
  return (
    <div className="section">
      <p className="klabel">autonomous loop — signal → x402 payment → reputation-weighted action</p>
      <ul className="loglist">
        {loop.length === 0 && (
          <li><span className="sub">No agent runs recorded yet.</span></li>
        )}
        {loop.map((e, i) => (
          <li key={i}>
            <span>
              <strong className="mono">#{e.signalId} {e.directionLabel} @ {e.confidence}%</strong>
              <span className="sub">{" · "}reputation read on-chain: <b>{(e.reputationBps / 100).toFixed(1)}%</b>{" → "}</span>
              <span className={`badge ${e.decisionSide === "BUY" ? "up" : e.decisionSide === "SELL" ? "down" : "pending"}`}>
                {e.decisionSide}{e.decisionNotional ? ` ${e.decisionNotional}` : ""}
              </span>
            </span>
            <br />
            <span className="sub">{e.decisionRationale}</span>
            <br />
            <span className="sub">
              x402 {e.paid ? "paid" : "free"}
              {e.settlementTx && (
                <> · settle <a className="mono" href={txLink(e.settlementTx)} target="_blank" rel="noreferrer">{short(e.settlementTx)}</a></>
              )}
              {" · swap "}{e.swapVia}
              {e.swapTx && (
                <> <a className="mono" href={e.swapExplorerUrl || txLink(e.swapTx)} target="_blank" rel="noreferrer">{short(e.swapTx)}</a></>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
