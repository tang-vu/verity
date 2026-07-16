/**
 * The autonomous consumer agent's decision log: for each run — the signal it
 * bought over x402, the oracle reputation it read, and the reputation-weighted
 * trade it executed, with links to the real settlement/swap transactions.
 */
import { short, txLink, type LoopEntry } from "../lib/dashboard-data";

export function AgentLoopList({ loop }: { loop: LoopEntry[] }) {
  return (
    <div className="card full">
      <h2>Autonomous agent loop — signal → x402 payment → reputation-weighted action</h2>
      <ul className="loglist">
        {loop.length === 0 && (
          <li><span className="sub">No agent runs recorded yet.</span></li>
        )}
        {loop.map((e, i) => (
          <li key={i}>
            <span className="ico">🤖</span>
            <span>
              <strong>#{e.signalId} {e.directionLabel} @ {e.confidence}%</strong>
              {" · "}rep <strong>{(e.reputationBps / 100).toFixed(1)}%</strong>
              {" → "}
              <span className={`badge ${e.decisionSide === "BUY" ? "up" : e.decisionSide === "SELL" ? "down" : "pending"}`}>
                {e.decisionSide}{e.decisionNotional ? ` ${e.decisionNotional}` : ""}
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
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
