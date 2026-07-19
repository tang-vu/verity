/**
 * One turn of the oracle's normal life: resolve whatever has come due, publish a
 * fresh call if the book is thin, then refresh the dashboard's fallback snapshot.
 *
 * This is what keeps the deployed oracle a living thing rather than a frozen
 * demo — run it on a scheduler (Task Scheduler / cron) and the public dashboard
 * keeps showing recent calls, real gradings and real slashes with no operator.
 *
 * Resolution goes through the guarded path: signals far past their horizon are
 * left alone, so an unattended run can never quietly grade and slash an old call.
 *
 * Each step is a separate `npm run` (fresh process) so .env and store writes from
 * one step are seen by the next — same pattern as `go-live`.
 *
 * Run: `npm run cycle`
 *      `npm run cycle -- --dry-run`   plan the turn, touch nothing on-chain
 *      `npm run cycle -- --min-open 3` keep at least 3 unresolved calls open
 */
import { spawn } from "node:child_process";
import { loadSignals, log, section, SignalStatus } from "@verity/shared";

/** How many unresolved calls the oracle tries to keep live at any time. */
const DEFAULT_MIN_OPEN = 2;

function run(script: string, args: string[] = []): Promise<number> {
  return new Promise((resolve) => {
    const shown = [script, ...args].join(" ");
    log("info", `→ npm run ${shown}`);
    const argv = args.length > 0 ? ["run", script, "--", ...args] : ["run", script];
    const p = spawn("npm", argv, { stdio: "inherit", shell: true });
    p.on("close", (code) => resolve(code ?? 1));
  });
}

function numberFlag(argv: string[], flag: string, fallback: number): number {
  const i = argv.indexOf(flag);
  if (i === -1) return fallback;
  const value = Number(argv[i + 1]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

/**
 * Calls still awaiting their verdict. Signals whose horizon lapsed long ago are
 * excluded: they are never getting resolved by an unattended run, so counting
 * them would starve the book and the oracle would stop publishing.
 */
function openSignalCount(): number {
  const now = Date.now();
  return loadSignals().filter((s) => {
    if (s.status !== SignalStatus.Pending) return false;
    const dueAt = s.publishedAt + s.horizonHours * 3_600_000;
    return now <= dueAt + s.horizonHours * 3_600_000;
  }).length;
}

async function main(): Promise<void> {
  const argv = process.argv;
  const dryRun = argv.includes("--dry-run");
  const minOpen = numberFlag(argv, "--min-open", DEFAULT_MIN_OPEN);

  section(`verity — oracle cycle${dryRun ? " (dry run)" : ""}`);

  const resolveArgs = dryRun ? ["--dry-run"] : [];
  if ((await run("oracle:resolve", resolveArgs)) !== 0) {
    throw new Error("resolve step failed");
  }

  // Alternate crypto and RWA so the book keeps covering both, which is the pairing
  // the product story rests on.
  let open = openSignalCount();
  for (let published = 0; open < minOpen; published++) {
    const script = published % 2 === 0 ? "oracle:publish" : "oracle:publish-rwa";
    if (dryRun) {
      log("info", `→ would run npm run ${script} (open ${open}/${minOpen})`);
      open += 1;
      continue;
    }
    if ((await run(script)) !== 0) throw new Error(`${script} failed`);
    const next = openSignalCount();
    if (next <= open) throw new Error("publish did not add an open signal — stopping");
    open = next;
  }

  if (dryRun) {
    log("ok", "Dry run complete — nothing was sent on-chain.");
    return;
  }

  if ((await run("web:snapshot")) !== 0) throw new Error("snapshot step failed");

  // Leave build-in-public drafts ready for review. Nothing is posted; a turn of the
  // oracle just means there is something true to say waiting in loop-output/.
  if ((await run("drafts")) !== 0) log("warn", "draft generation failed — cycle itself was fine.");

  section("cycle complete");
  log("ok", `${open} open call(s); dashboard snapshot refreshed.`);
  log("info", "Post drafts: loop-output/social-drafts.md");
  log("info", "Live state: the dashboard reads the chain directly; the snapshot is its fallback.");
}

main().catch((err) => {
  log("err", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
