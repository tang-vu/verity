/**
 * Generate the demo voiceover with MiMo TTS (mimo-v2.5-tts). The TTS surface is
 * the chat/completions endpoint: an `assistant` message holds the line to speak,
 * and the WAV comes back as base64 in message.audio.data. Each line is saved as a
 * segment WAV, then concatenated to loop-output/video/voiceover.wav via ffmpeg.
 *
 * Env: MIMO_API_KEY, MIMO_BASE_URL (default Singapore token-plan).
 * Run: node scripts/make-voiceover.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "loop-output/video");
const segDir = resolve(outDir, "vo-seg");
const KEY = process.env.MIMO_API_KEY;
const BASE = process.env.MIMO_BASE_URL ?? "https://token-plan-sgp.xiaomimimo.com/v1";
if (!KEY) { console.error("Set MIMO_API_KEY"); process.exit(1); }

// Narration paced to intro(16s) + terminal(17s) + dashboard(35s).
const LINES = [
  "verity is a reputation-staked x402 signal oracle on Casper.",
  "An oracle agent turns real market data into an on-chain signal; a DeFi agent pays for it and acts, with no human in the loop.",
  "Everything lands on-chain: the Odra contract, the LLM signal, and the x402 settlement, all verifiable on cspr dot live.",
  "Watch the autonomous loop. The agent discovers the oracle over MCP, then pays the x402 fee.",
  "The Casper facilitator settles the payment on-chain, and the agent reads the oracle's reputation, seventy-five percent.",
  "It sizes its trade by that reputation, buying five hundred eighteen, then swaps through the CSPR dot trade agent.",
  "The live dashboard shows the reputation, every signal linked to its real transaction, and the autonomous loop log.",
  "verity. The trust layer for the machine economy, on Casper.",
];

mkdirSync(segDir, { recursive: true });

async function tts(text, idx) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "mimo-v2.5-tts", messages: [{ role: "assistant", content: text }] }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const b64 = j.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error(`no audio in response: ${JSON.stringify(j).slice(0, 200)}`);
  const seg = resolve(segDir, `seg_${String(idx).padStart(2, "0")}.wav`);
  writeFileSync(seg, Buffer.from(b64, "base64"));
  console.log(`  seg ${idx}: ${(Buffer.from(b64, "base64").length / 1024).toFixed(0)} KB`);
  return seg;
}

function wavDuration(path) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  return parseFloat(String(out).trim());
}

console.log("Generating voiceover segments...");
const segs = [];
const timing = [];
let cursor = 0;
for (let i = 0; i < LINES.length; i++) {
  const seg = await tts(LINES[i], i);
  segs.push(seg);
  const dur = wavDuration(seg);
  timing.push({ text: LINES[i], start: cursor, end: cursor + dur });
  cursor += dur;
}
writeFileSync(resolve(outDir, "voiceover-timing.json"), JSON.stringify(timing, null, 2));

// Concat WAV segments + a short tail of silence between lines for pacing.
const listFile = resolve(segDir, "list.txt");
writeFileSync(listFile, segs.map((s) => `file '${s.replace(/\\/g, "/")}'`).join("\n"));
const voiceover = resolve(outDir, "voiceover.wav");
execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", voiceover], {
  stdio: "ignore",
});
console.log(`Voiceover written: ${voiceover}`);
if (existsSync(listFile)) rmSync(listFile);
