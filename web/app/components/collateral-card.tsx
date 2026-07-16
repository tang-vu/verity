/**
 * Skin in the game: the oracle's bonded, slashable collateral — the capital
 * that makes its reputation expensive to fake, with the wiring txs on-chain.
 */
import { fmtUnits, short, type Stake } from "../lib/dashboard-data";

export function CollateralCard({ stake, loading }: { stake: Stake | null; loading: boolean }) {
  return (
    <div className="panel">
      <p className="klabel">skin in the game</p>
      {stake ? (
        <>
          <div className="mono" style={{ fontSize: 34, fontWeight: 700, color: "var(--gold)" }}>
            {fmtUnits(stake.bondedBaseUnits, stake.decimals)}
            <span className="sub" style={{ fontSize: 14, marginLeft: 6 }}>{stake.stakeSymbol}USD at risk</span>
          </div>
          <div className="repbar"><div style={{ width: `${Math.min(100, (stake.bondedBaseUnits / Math.max(stake.minStakeBaseUnits * 4, 1)) * 100)}%` }} /></div>
          <div className="sub">
            publish gate: {fmtUnits(stake.minStakeBaseUnits, stake.decimals)} {stake.stakeSymbol}USD minimum —
            an unbonded oracle <b>cannot publish at all</b>.
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <span className="badge wrong">−{fmtUnits(stake.slashedBaseUnits, stake.decimals)} {stake.stakeSymbol}USD slashed</span>
          </div>
          {stake.txs && stake.txs.length > 0 && (
            <div className="row" style={{ marginTop: 12, gap: 6 }}>
              {stake.txs.slice(-3).map((t, i) => (
                <a key={i} className="txchip" href={t.explorerUrl} target="_blank" rel="noreferrer">
                  {t.label} {short(t.txHash)} ↗
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="sub">{loading ? <span className="skeleton">reading bonded stake…</span> : "No collateral bonded yet."}</div>
      )}
    </div>
  );
}
