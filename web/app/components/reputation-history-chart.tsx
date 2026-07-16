/**
 * Cumulative-accuracy line: how the oracle's on-chain reputation evolved with
 * every resolved signal. Single series (no legend needed); each marker is one
 * resolution — status-colored (green correct / red wrong) with a surface ring,
 * native tooltips per point, and the final value direct-labeled.
 */
import type { Signal } from "../lib/dashboard-data";

const W = 560;
const H = 150;
const PAD = { l: 34, r: 14, t: 12, b: 22 };

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
    return <div className="sub" style={{ marginTop: 12 }}>Accuracy history appears after the first resolve.</div>;
  }

  const gridY = (pct: number) => PAD.t + ((100 - pct) / 100) * (H - PAD.t - PAD.b);
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${PAD.l},${gridY(0)} ${line} ${points[points.length - 1].x},${gridY(0)}`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block", marginTop: 12 }}
      role="img"
      aria-label="Oracle cumulative accuracy after each resolved signal"
    >
      <defs>
        <linearGradient id="rep-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 50, 100].map((pct) => (
        <g key={pct}>
          <line
            x1={PAD.l} x2={W - PAD.r} y1={gridY(pct)} y2={gridY(pct)}
            stroke="var(--line)" strokeWidth={1} strokeDasharray={pct === 50 ? "4 4" : undefined}
          />
          <text x={PAD.l - 7} y={gridY(pct) + 3} textAnchor="end" fontSize={9} fill="var(--ink-3)" fontFamily="var(--mono)">
            {pct}
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#rep-area)" />
      <polyline points={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p) => (
        <g key={p.signalId}>
          <circle cx={p.x} cy={p.y} r={4.5} fill={p.correct ? "var(--up)" : "var(--down)"} stroke="var(--bg)" strokeWidth={2}>
            <title>{`signal #${p.signalId} — ${p.correct ? "correct" : "wrong (slashed)"} → cumulative ${p.accuracyPct.toFixed(1)}%`}</title>
          </circle>
          <text x={p.x} y={H - 7} textAnchor="middle" fontSize={9} fill="var(--ink-3)" fontFamily="var(--mono)">
            #{p.signalId}
          </text>
        </g>
      ))}
      <text
        x={last.x - 8} y={last.y - 10}
        textAnchor="end" fontSize={11} fontWeight={700} fill="var(--ink)" fontFamily="var(--mono)"
      >
        {last.accuracyPct.toFixed(0)}%
      </text>
    </svg>
  );
}
