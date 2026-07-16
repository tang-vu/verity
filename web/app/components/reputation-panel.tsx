"use client";

/**
 * The hero instrument: the oracle's on-chain accuracy as a huge counting
 * numeral over its cumulative-accuracy history. This is the one number the
 * whole protocol prices — everything else on the page derives from it.
 */
import { useEffect, useRef, useState } from "react";
import { short, type RepResponse, type Signal } from "../lib/dashboard-data";
import { ReputationHistoryChart } from "./reputation-history-chart";

/** Count from 0 to target once, ~0.9s, spring-ish ease. Reduced-motion: jump. */
function useCountUp(target: number | null): number | null {
  const [value, setValue] = useState<number | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (target == null || done.current) {
      if (target != null && done.current) setValue(target);
      return;
    }
    done.current = true;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export function ReputationPanel({ rep, signals }: { rep: RepResponse | null; signals: Signal[] }) {
  const pct = rep ? rep.reputation.accuracyBps / 100 : null;
  const shown = useCountUp(pct);

  return (
    <div className="rep-panel reveal" style={{ animationDelay: "0.15s" }}>
      <div className="rep-label">
        <span className="klabel" style={{ margin: 0 }}>on-chain accuracy</span>
      </div>
      <div className="rep-figure">
        {shown == null ? <span className="skeleton">00.0%</span> : (
          <>
            {shown.toFixed(1)}
            <span className="unit">%</span>
          </>
        )}
      </div>
      <div className="rep-meta">
        {rep ? (
          <>
            <b>{rep.reputation.correctSignals}/{rep.reputation.resolvedSignals}</b> resolved correct ·{" "}
            <b>{rep.reputation.totalSignals}</b> published · wrong calls slash{" "}
            <b style={{ color: "var(--down)" }}>20%</b> of the bond
          </>
        ) : (
          "reading contract state…"
        )}
      </div>
      <ReputationHistoryChart signals={signals} />
      {rep?.contract && (
        <div className="sub" style={{ marginTop: 10 }}>
          SignalOracle{" "}
          <a href={rep.explorer ?? "#"} target="_blank" rel="noreferrer" className="txchip">
            {short(rep.contract)} ↗
          </a>
        </div>
      )}
    </div>
  );
}
