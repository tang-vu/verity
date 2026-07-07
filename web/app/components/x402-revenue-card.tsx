/**
 * x402 revenue card: the oracle's data is a PRODUCT. Every consumer-agent loop
 * run pays per query; settled payments carry a real on-chain tx. Revenue =
 * paid queries × price (CEP-18 base units → display units).
 */
import { fmtUnits, short, txLink, type LoopEntry, type X402Info } from "../lib/dashboard-data";

export function X402RevenueCard({ loop, x402 }: { loop: LoopEntry[]; x402?: X402Info | null }) {
  const paid = loop.filter((e) => e.paid);
  const settled = loop.filter((e) => e.settlementTx);
  const decimals = x402?.decimals ?? 2;
  const symbol = x402?.symbol ?? "x402USD";
  const price = Number(x402?.priceBaseUnits ?? 0);
  const revenueBaseUnits = paid.length * price;
  const lastSettled = settled[0]; // loop log arrives newest-first

  return (
    <div className="card">
      <h2>x402 revenue (the signal is a paid product)</h2>
      {paid.length === 0 ? (
        <div className="sub">
          no paid queries yet — run <span className="mono">npm run agent:loop</span>. Each loop pays
          per signal over x402.
        </div>
      ) : (
        <>
          <div className="big" style={{ fontSize: 34 }}>
            {x402 ? fmtUnits(revenueBaseUnits, decimals) : paid.length}{" "}
            <span className="sub" style={{ fontSize: 16 }}>{x402 ? symbol : "paid queries"}</span>
          </div>
          <div className="sub" style={{ marginTop: 6 }}>
            {paid.length} paid quer{paid.length === 1 ? "y" : "ies"}
            {x402 && <> · {fmtUnits(price, decimals)} {symbol} each</>}
            {" · "}{settled.length} settled on-chain by the facilitator
          </div>
          {lastSettled?.settlementTx && (
            <div className="sub" style={{ marginTop: 10 }}>
              latest settlement:{" "}
              <a className="mono" href={txLink(lastSettled.settlementTx)} target="_blank" rel="noreferrer">
                {short(lastSettled.settlementTx)}
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
