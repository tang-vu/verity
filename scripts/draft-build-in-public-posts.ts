/**
 * Turn what the oracle actually did into ready-to-post build-in-public drafts.
 *
 * Every figure here comes from the local stores that mirror on-chain state, so a
 * draft can only claim something the chain will back up — including the losses.
 * Posting the wrong calls is the point: an oracle that only publishes its wins is
 * exactly the thing this project argues against.
 *
 * Nothing is posted. Drafts go to stdout and loop-output/social-drafts.md for a
 * human to read, edit and publish.
 *
 * Run: `npm run drafts`               — activity from the last 7 days
 *      `npm run drafts -- --days 2`   — narrow the window
 *      `npm run drafts -- --all`      — every signal on record
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeReputation,
  directionLabel,
  loadConfig,
  loadSignals,
  loadStakeState,
  SignalStatus,
  stakeToDisplay,
  type StakeState,
  type StoredSignal,
} from "@verity/shared";

/** X's limit for a single post. Drafts over it are flagged, not silently cut. */
const POST_LIMIT = 280;
/** X rewrites every link through t.co, so any URL bills as this many characters
 *  no matter its real length. Counting raw characters would reject drafts that
 *  actually fit — the explorer links here are ~78 chars each. */
const URL_WEIGHT = 23;
const DASHBOARD = "https://web-eight-amber-iq6mjhp7bf.vercel.app";

/** Post length as X will count it. */
function postLength(body: string): number {
  return body.replace(/https?:\/\/\S+/g, "x".repeat(URL_WEIGHT)).length;
}

interface Draft {
  kind: string;
  body: string;
}

function assetLabel(signal: StoredSignal): string {
  return signal.asset === "pax-gold" ? "PAXG (tokenized gold)" : "CSPR/USD";
}

function money(baseUnits: number, stake: StakeState | undefined): string {
  const decimals = stake?.decimals ?? 2;
  const symbol = stake?.stakeSymbol ?? "x402";
  return `${stakeToDisplay(baseUnits, decimals).toFixed(2)} ${symbol}USD`;
}

/** The slash a wrong resolve triggered, when the audit trail recorded the amount. */
function slashFor(signal: StoredSignal, stake: StakeState | undefined): number | undefined {
  const entry = stake?.txs.find((t) => t.label === "slash" && t.txHash === signal.resolveTxHash);
  return entry?.amountBaseUnits;
}

function publishDraft(signal: StoredSignal, stake: StakeState | undefined): Draft {
  const bond = stake ? money(stake.bondedBaseUnits, stake) : "real collateral";
  const reasoning = (signal.reasoning ?? "").trim().replace(/\s+/g, " ");

  const compose = (quote: string) =>
    [
      `verity published signal #${signal.id} on Casper testnet.`,
      ``,
      `${assetLabel(signal)} · ${directionLabel(signal.direction)} @ ${signal.confidence}% confidence`,
      quote ? `\n"${quote}"\n` : ``,
      `${bond} is bonded behind this call. Wrong = 20% slashed on-chain.`,
      ``,
      signal.publishExplorerUrl ?? "",
    ]
      .join("\n")
      .trim();

  // The LLM's reasoning is the only elastic part, and asset names and bond figures
  // vary in width — so give the quote whatever room is left rather than a fixed cap.
  // Measure the quote's own punctuation cost from the template instead of assuming
  // it, so editing the wording around it cannot silently push drafts over again.
  const quoteOverhead = postLength(compose("x")) - postLength(compose("")) - 1;
  const budget = POST_LIMIT - postLength(compose("")) - quoteOverhead;
  const quote =
    reasoning.length <= budget
      ? reasoning
      : budget > 12
        ? `${reasoning.slice(0, budget - 1).trimEnd()}…`
        : "";

  return { kind: `publish #${signal.id}`, body: compose(quote) };
}

function resolveDraft(
  signal: StoredSignal,
  stake: StakeState | undefined,
  accuracyPct: string,
  correctOf: string
): Draft {
  const link = signal.resolveExplorerUrl ?? "";
  if (signal.correct) {
    return {
      kind: `resolve #${signal.id} CORRECT`,
      body: [
        `Signal #${signal.id} (${assetLabel(signal)} ${directionLabel(signal.direction)}) resolved CORRECT on-chain.`,
        ``,
        `Accuracy now ${accuracyPct}% (${correctOf}). The bond stays up and rides on the next call.`,
        ``,
        link,
      ]
        .join("\n")
        .trim(),
    };
  }

  const cut = slashFor(signal, stake);
  const penalty = cut !== undefined
    ? `${money(cut, stake)} of the oracle's own bond was slashed to the consumer treasury.`
    : `20% of the oracle's own bond was slashed to the consumer treasury.`;
  return {
    kind: `resolve #${signal.id} WRONG`,
    body: [
      `verity called ${assetLabel(signal)} ${directionLabel(signal.direction)}. It didn't.`,
      ``,
      `Signal #${signal.id} resolved WRONG on-chain. ${penalty}`,
      ``,
      `Accuracy now ${accuracyPct}% (${correctOf}).`,
      ``,
      link,
    ]
      .join("\n")
      .trim(),
  };
}

function pinnedThread(
  signals: StoredSignal[],
  stake: StakeState | undefined,
  accuracyPct: string,
  correctOf: string
): Draft[] {
  const bonded = stake ? money(stake.bondedBaseUnits, stake) : "real collateral";
  const slashed = stake ? money(stake.slashedBaseUnits, stake) : "";
  return [
    {
      kind: "pinned 1/4",
      body: [
        `Most oracles ask you to trust them. verity makes its word cost exactly what its track record is worth.`,
        ``,
        `It bonds real collateral behind every market call it sells on Casper. Wrong call = 20% slashed on-chain, paid to the agents it could have misled.`,
        ``,
        DASHBOARD,
      ].join("\n"),
    },
    {
      kind: "pinned 2/4",
      body: [
        `The numbers are not a pitch deck — they're contract state you can read yourself.`,
        ``,
        `${accuracyPct}% accuracy (${correctOf} resolved) · ${bonded} bonded right now · ${slashed} already destroyed by its own wrong calls.`,
      ].join("\n"),
    },
    {
      kind: "pinned 3/4",
      body: [
        `The other half is a consumer agent that pays per signal over x402 and sizes its trade by that on-chain accuracy.`,
        ``,
        `Low reputation or no collateral bonded, and it refuses to move capital at all. No human in the loop.`,
      ].join("\n"),
    },
    {
      kind: "pinned 4/4",
      body: [
        `${signals.length} signals published so far on CSPR/USD and PAXG tokenized gold, publishing and grading itself on a 12h cycle.`,
        ``,
        `Open source, MIT: https://github.com/tang-vu/verity`,
        ``,
        `I'll post every call here — including the ones it loses money on.`,
      ].join("\n"),
    },
  ];
}

/**
 * Accuracy as it stood immediately after each resolve, keyed by signal id.
 * A post about a call graded three days ago must not quote today's number —
 * replaying the resolves in chain order is what makes the claim checkable.
 */
function accuracyTimeline(signals: StoredSignal[]): Map<number, { pct: string; of: string }> {
  const resolved = signals
    .filter((s) => s.status !== SignalStatus.Pending && s.resolvedAt !== undefined)
    .sort((a, b) => (a.resolvedAt ?? 0) - (b.resolvedAt ?? 0));

  const timeline = new Map<number, { pct: string; of: string }>();
  let correct = 0;
  let total = 0;
  for (const s of resolved) {
    total += 1;
    if (s.correct) correct += 1;
    timeline.set(s.id, { pct: ((correct / total) * 100).toFixed(1), of: `${correct}/${total}` });
  }
  return timeline;
}

function main(): void {
  const argv = process.argv;
  const all = argv.includes("--all");
  const daysIdx = argv.indexOf("--days");
  const days = daysIdx !== -1 && Number(argv[daysIdx + 1]) > 0 ? Number(argv[daysIdx + 1]) : 7;
  const cutoff = all ? 0 : Date.now() - days * 86_400_000;

  loadConfig();
  const signals = loadSignals();
  const stake = loadStakeState() ?? undefined;
  const rep = computeReputation(signals);
  const accuracyPct = (rep.accuracyBps / 100).toFixed(1);
  const correctOf = `${rep.correctSignals}/${rep.resolvedSignals}`;

  const drafts: Draft[] = [...pinnedThread(signals, stake, accuracyPct, correctOf)];
  const timeline = accuracyTimeline(signals);

  for (const s of signals) {
    if (s.status !== SignalStatus.Pending && (s.resolvedAt ?? 0) >= cutoff) {
      const at = timeline.get(s.id) ?? { pct: accuracyPct, of: correctOf };
      drafts.push(resolveDraft(s, stake, at.pct, at.of));
    }
    if (s.publishedAt >= cutoff) drafts.push(publishDraft(s, stake));
  }

  const lines: string[] = [
    `# build-in-public drafts — generated ${new Date().toISOString()}`,
    ``,
    `Every figure below is read from on-chain state. Edit freely, then post by hand.`,
    ``,
  ];
  for (const d of drafts) {
    const len = postLength(d.body);
    const over = len > POST_LIMIT;
    lines.push(`## ${d.kind} — ${len}/${POST_LIMIT}${over ? " ⚠ OVER LIMIT" : ""}`, ``, d.body, ``);
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const outDir = resolve(root, "loop-output");
  mkdirSync(outDir, { recursive: true });
  const out = resolve(outDir, "social-drafts.md");
  writeFileSync(out, lines.join("\n"));

  console.log(lines.join("\n"));
  const over = drafts.filter((d) => postLength(d.body) > POST_LIMIT).length;
  console.log(`\n${drafts.length} draft(s) written: ${out}`);
  if (over > 0) console.log(`${over} draft(s) exceed ${POST_LIMIT} chars — trim before posting.`);
}

main();
