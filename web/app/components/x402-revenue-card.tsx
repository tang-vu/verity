/**
 * x402 revenue card: the oracle's data is a PRODUCT. Counts the facilitator's
 * on-chain CEP-18 settlements paying the oracle — reconstructed live from the
 * token contract's transaction history (loop log as fallback).
 */
import { fmtUnits, short, txLink, type LoopEntry, type RevenueInfo, type X402Info } from "../lib/dashboard-data";

export function X402RevenueCard({
  revenue,
  loop,
  x402,
}: {
  revenue?: RevenueInfo | null;
  loop: LoopEntry[];
  x402?: X402Info | null;
}) {
  const decimals = revenue?.decimals ?? x402?.decimals ?? 2;
  const symbol = revenue?.symbol ?? x402?.symbol ?? "x402";
  const paidLoop = loop.filter((e) => e.paid);
  const count = revenue?.settledCount ?? paidLoop.length;
  const total = revenue?.totalBaseUnits ?? paidLoop.length * Number(x402?.priceBaseUnits ?? 0);
  const latestTx = revenue?.latestTxHash ?? loop.find((e) => e.settlementTx)?.settlementTx;
  const latestUrl = revenue?.latestExplorerUrl ?? (latestTx ? txLink(latestTx) : undefined);

  return (
    <div className="card">
      <h2>x402 revenue — the signal is a paid product</h2>
      {count === 0 ? (
        <div className="sub">
          No paid queries settled yet. Every agent that buys the signal pays {x402 ? fmtUnits(Number(x402.priceBaseUnits), decimals) : "a few"}{" "}
          {symbol}USD per query — try it yourself with the button below.
        </div>
      ) : (
        <>
          <div className="big" style={{ fontSize: 34 }}>
            {fmtUnits(total, decimals)} <span className="sub" style={{ fontSize: 16 }}>{symbol}USD</span>
          </div>
          <div className="sub" style={{ marginTop: 6 }}>
            {count} paid quer{count === 1 ? "y" : "ies"} settled on-chain by the x402 facilitator
            {x402 && <> · {fmtUnits(Number(x402.priceBaseUnits), decimals)} {symbol}USD each</>}
          </div>
          {latestTx && (
            <div className="sub" style={{ marginTop: 10 }}>
              latest settlement:{" "}
              <a className="mono" href={latestUrl} target="_blank" rel="noreferrer">{short(latestTx)}</a>
            </div>
          )}
        </>
      )}
    </div>
  );
}
