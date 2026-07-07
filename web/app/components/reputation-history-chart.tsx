/**
 * Cumulative-accuracy line: how the oracle's on-chain reputation evolved with
 * every resolved signal. Each dot is one resolution (green correct, red wrong)
 * — the visible price of a wrong call. Pure inline SVG, no chart library.
 */
import type { Signal } from "../lib/dashboard-data";

const W = 560;
const H = 120;
const PAD = { l: 34, r: 12, t: 10, b: 20 };

interface Point {
  x: number;
  y: number;
  accuracyPct: number;
  correct: boolean;
  signalId: number;
}

/** signals in any order -> cumulative accuracy after each resolve (id order). */
function buildPoints(signals: Signal[]): Point[] {
  const resolved = signals
    .filter((s) => s.statusLabel === "CORRECT" || s.statusLabel === "WRONG")
    .sort((a, b) => a.id - b.id);
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  let correct = 0;
  return resolved.map((s, i) => {
    if (s.statusLabel === "CORRECT") correct += 1;
    const accuracyPct = (correct / (i + 1)) * 100;
    return {
      x: PAD.l + (resolved.length === 1 ? innerW / 2 : (i * innerW) / (resolved.length - 1)),
      y: PAD.t + ((100 - accuracyPct) / 100) * innerH,
      accuracyPct,
      correct: s.statusLabel === "CORRECT",
      signalId: s.id,
    };
  });
}

export function ReputationHistoryChart({ signals }: { signals: Signal[] }) {
  const points = buildPoints(signals);
  if (points.length === 0) {
    return <div className="sub">no resolved signals yet — accuracy history appears after the first resolve</div>;
  }

  const gridY = (pct: number) => PAD.t + ((100 - pct) / 100) * (H - PAD.t - PAD.b);
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", marginTop: 10 }}
      role="img"
      aria-label="Oracle cumulative accuracy after each resolved signal"
    >
      {[0, 50, 100].map((pct) => (
        <g key={pct}>
          <line
            x1={PAD.l} x2={W - PAD.r} y1={gridY(pct)} y2={gridY(pct)}
            stroke="var(--border)" strokeWidth={1} strokeDasharray={pct === 50 ? "4 4" : undefined}
          />
          <text x={PAD.l - 6} y={gridY(pct) + 3} textAnchor="end" fontSize={9} fill="var(--muted)">
            {pct}%
          </text>
        </g>
      ))}
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p) => (
        <g key={p.signalId}>
          <circle cx={p.x} cy={p.y} r={4} fill={p.correct ? "var(--up)" : "var(--down)"} />
          <text x={p.x} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--muted)">
            #{p.signalId}
          </text>
        </g>
      ))}
      <text
        x={points[points.length - 1].x} y={points[points.length - 1].y - 9}
        textAnchor="end" fontSize={10} fontWeight={700} fill="var(--text)"
      >
        {points[points.length - 1].accuracyPct.toFixed(0)}%
      </text>
    </svg>
  );
}
