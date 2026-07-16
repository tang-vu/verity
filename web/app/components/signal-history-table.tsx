/**
 * On-chain signal audit trail: every row is one publish (and, once graded, one
 * resolve) transaction on Casper testnet, linked to cspr.live. CSPR/USD and
 * the PAXG tokenized-gold RWA feed share the same rails.
 */
import { fmtUsd, fmtWhen, short, txLink, type Signal } from "../lib/dashboard-data";

function TxCell({ hash, url }: { hash?: string; url?: string }) {
  if (!hash || hash === "n/a") return <td className="mono dim">—</td>;
  return (
    <td className="mono">
      <a href={url || txLink(hash)} target="_blank" rel="noreferrer">{short(hash)}</a>
    </td>
  );
}

export function SignalHistoryTable({ signals }: { signals: Signal[] }) {
  return (
    <div className="section">
      <p className="klabel">signal history — every row links to its real testnet tx</p>
      <div className="scroll-x">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Asset</th><th>Call</th><th>Conf</th><th>Status</th>
              <th>Publish $</th><th>Resolve $</th><th>Published</th><th>Publish tx</th><th>Resolve tx</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 && (
              <tr><td colSpan={10} className="sub">No signals on-chain yet.</td></tr>
            )}
            {signals.map((s) => (
              <tr key={s.id}>
                <td className="mono dim">{s.id}</td>
                <td><span className={`asset-chip ${s.symbol === "PAXG" ? "rwa" : ""}`}>{s.symbol}</span></td>
                <td><span className={`badge ${s.directionLabel.toLowerCase()}`}>{s.directionLabel}</span></td>
                <td className="mono">{s.confidence}%</td>
                <td><span className={`badge ${s.statusLabel.toLowerCase()}`}>{s.statusLabel}</span></td>
                <td className="mono">{fmtUsd(s.priceUsdAtPublish)}</td>
                <td className="mono">{fmtUsd(s.priceUsdAtResolve)}</td>
                <td className="sub mono">{fmtWhen(s.publishedAt)}</td>
                <TxCell hash={s.publishTxHash} url={s.publishExplorerUrl} />
                <TxCell hash={s.resolveTxHash} url={s.resolveExplorerUrl} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
