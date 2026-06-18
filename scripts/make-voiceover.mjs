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

// Narration, paced to the ~62s reel(27s)+dashboard(35s) cut.
const LINES = [
  "verity is a reputation-staked x402 signal oracle on Casper.",
  "An oracle agent turns real market data into an on-chain signal with a confidence score.",
  "A DeFi agent pays for that signal over x402, settled on-chain by the Casper facilitator.",
  "It weights its trade by the oracle's on-chain reputation, then swaps through the CSPR.trade agent. No human in the loop.",
  "This is the live dashboard. Reputation, seventy-five percent, computed from signals resolved on testnet.",
  "Every signal links to its real transaction on cspr.live, and the loop log shows the agent paying, weighting, and trading.",
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

console.log("Generating voiceover segments...");
const segs = [];
for (let i = 0; i < LINES.length; i++) segs.push(await tts(LINES[i], i));

// Concat WAV segments + a short tail of silence between lines for pacing.
const listFile = resolve(segDir, "list.txt");
writeFileSync(listFile, segs.map((s) => `file '${s.replace(/\\/g, "/")}'`).join("\n"));
const voiceover = resolve(outDir, "voiceover.wav");
execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", voiceover], {
  stdio: "ignore",
});
console.log(`Voiceover written: ${voiceover}`);
if (existsSync(listFile)) rmSync(listFile);
