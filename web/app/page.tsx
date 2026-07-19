"use client";

import { useEffect, useState } from "react";
import { AgentLoopList } from "./components/agent-loop-list";
import { CollateralCard } from "./components/collateral-card";
import { JudgeTestingGuide } from "./components/judge-testing-guide";
import { LatestSignalCard } from "./components/latest-signal-card";
import { LaunchPlan } from "./components/launch-plan";
import { MetricsTicker } from "./components/metrics-ticker";
import { ReputationPanel } from "./components/reputation-panel";
import { SignalHistoryTable } from "./components/signal-history-table";
import { X402Playground } from "./components/x402-playground";
import {
  EXPLORER,
  getJson,
  type LoopEntry,
  type LoopResponse,
  type RepResponse,
  type Signal,
  type SignalsResponse,
} from "./lib/dashboard-data";
import { DEMO_URL as DEMO, GITHUB_URL as GITHUB, X_HANDLE, X_URL } from "./lib/verity-public-config";

const CONTRACT = `${EXPLORER}/contract-package/13b217e5d7dd2a24834454289798475f88aae269fcce68f52f52d7747214ffd0`;
const REFRESH_MS = 30_000;

export default function Dashboard() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [rep, setRep] = useState<RepResponse | null>(null);
  const [loop, setLoop] = useState<LoopEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [s, r, l] = await Promise.all([
          getJson<SignalsResponse>("/api/oracle/signals"),
          getJson<RepResponse>("/api/oracle/reputation"),
          getJson<LoopResponse>("/api/oracle/loop-log").catch(() => ({ count: 0, entries: [] as LoopEntry[] })),
        ]);
        if (!alive) return;
        setSignals(s.signals.slice().reverse()); // newest first
        setRep(r);
        setLoop(l.entries);
        setError(null);
        setUpdatedAt(Date.now());
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    }
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const latest = signals[0];
  const live = rep?.source === "live";

  return (
    <div className="wrap">
      <header className="topbar">
        <span className="wordmark"><span className="tick">✓</span>verity</span>
        {rep && (
          <span className={`live-pill ${live ? "" : "snapshot"}`}>
            <span className="live-dot" />
            {live ? "live on-chain" : "snapshot"}
          </span>
        )}
        <nav className="topnav">
          <a href="/pitch">pitch</a>
          <a href="#launch-plan">roadmap</a>
          <a href={DEMO} target="_blank" rel="noreferrer">demo film</a>
          <a href={GITHUB} target="_blank" rel="noreferrer">github</a>
          <a href={CONTRACT} target="_blank" rel="noreferrer">contract ↗</a>
        </nav>
      </header>

      <section className="hero">
        <div className="reveal">
          <p className="eyebrow">Casper Agentic Buildathon 2026 · RWA oracle agents · build direction #2</p>
          <h1>
            An oracle whose word costs <em>exactly</em> its accuracy.
          </h1>
          <p className="lede">
            verity bonds real collateral behind every market call it sells. A wrong call is{" "}
            <strong>slashed 20% on-chain</strong> into a consumer-protection treasury; an autonomous DeFi
            agent pays per signal over <strong>x402</strong>&nbsp;and sizes its trade by the oracle&apos;s
            verifiable track record. Feeds: CSPR/USD and PAXG tokenized gold — no human in the loop.
          </p>
          <div className="cta">
            <a className="btn primary" href="#try-it">⚡ Buy the signal live</a>
            <a className="btn" href={DEMO} target="_blank" rel="noreferrer">▶ 77s demo</a>
            <a className="btn" href={CONTRACT} target="_blank" rel="noreferrer">cspr.live ↗</a>
          </div>
          {error && <p className="err" style={{ marginTop: 16 }}>Data is temporarily unavailable — retrying automatically.</p>}
        </div>

        <ReputationPanel rep={rep} signals={signals} />
      </section>

      <MetricsTicker rep={rep} signalCount={rep ? rep.reputation.totalSignals : null} />

      <section className="section bento reveal" style={{ animationDelay: "0.35s" }}>
        <LatestSignalCard latest={latest} loading={!rep} />
        <CollateralCard stake={rep?.stake ?? null} loading={!rep} />
      </section>

      <X402Playground x402={rep?.x402} />

      <JudgeTestingGuide />

      <SignalHistoryTable signals={signals} />

      <AgentLoopList loop={loop} />

      <LaunchPlan />

      <footer className="foot">
        <span>✓ verity · Casper Agentic Buildathon 2026 · MIT</span>
        <a href={X_URL} target="_blank" rel="noreferrer">{X_HANDLE}</a>
        <a href={GITHUB} target="_blank" rel="noreferrer">github</a>
        <span className="spacer" />
        <span className="mono">
          {updatedAt ? `updated ${new Date(updatedAt).toLocaleTimeString()}` : "connecting…"}
          {live ? " · reconstructed from casper-test · refreshes 30s" : ""}
        </span>
      </footer>
    </div>
  );
}
