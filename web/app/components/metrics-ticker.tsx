/**
 * Terminal-style metrics strip: the protocol's economics at a glance —
 * bonded collateral at risk, capital destroyed by wrong calls, x402 revenue
 * counted from real on-chain settlements, and the price of one query.
 */
import { fmtUnits, short, type RepResponse } from "../lib/dashboard-data";

function Metric({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string | null;
  unit?: string;
  sub?: React.ReactNode;
  tone?: "gold" | "red";
}) {
  return (
    <div>
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${tone ?? ""}`}>
        {value == null ? <span className="skeleton">0,000</span> : value}
        {value != null && unit && <span className="unit">{unit}</span>}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export function MetricsTicker({ rep, signalCount }: { rep: RepResponse | null; signalCount: number | null }) {
  const stake = rep?.stake ?? null;
  const revenue = rep?.revenue ?? null;
  const x402 = rep?.x402 ?? null;
  const dec = stake?.decimals ?? 2;
  const sym = `${stake?.stakeSymbol ?? "x402"}USD`;

  return (
    <div className="ticker reveal" style={{ animationDelay: "0.25s" }}>
      <Metric
        label="bonded collateral"
        value={stake ? fmtUnits(stake.bondedBaseUnits, dec) : null}
        unit={sym}
        tone="gold"
        sub={stake ? `min ${fmtUnits(stake.minStakeBaseUnits, dec)} required to publish` : undefined}
      />
      <Metric
        label="slashed on-chain"
        value={stake ? fmtUnits(stake.slashedBaseUnits, dec) : null}
        unit={sym}
        tone="red"
        sub="burned to the consumer-protection treasury"
      />
      <Metric
        label="x402 revenue"
        value={revenue ? fmtUnits(revenue.totalBaseUnits, revenue.decimals) : null}
        unit={sym}
        sub={
          revenue &&
          (revenue.latestTxHash ? (
            <>
              {revenue.settledCount} settled ·{" "}
              <a className="mono" href={revenue.latestExplorerUrl} target="_blank" rel="noreferrer">
                {short(revenue.latestTxHash)} ↗
              </a>
            </>
          ) : (
            `${revenue.settledCount} paid queries`
          ))
        }
      />
      <Metric
        label="signals published"
        value={signalCount != null ? String(signalCount) : null}
        sub="CSPR/USD + PAXG tokenized gold (RWA)"
      />
      <Metric
        label="price per query"
        value={x402 ? fmtUnits(Number(x402.priceBaseUnits), x402.decimals) : null}
        unit={sym}
        sub="HTTP 402 · EIP-712 · facilitator-settled"
      />
    </div>
  );
}
