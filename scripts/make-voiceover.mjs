/**
 * Generate the demo voiceover with MiMo TTS (mimo-v2.5-tts) on the Xiaomi MiMo
 * platform (api.xiaomimimo.com). TTS is served over chat/completions: a `user`
 * message carries the voice-style instruction, an `assistant` message carries the
 * text to speak, and `audio` selects format/voice. The WAV comes back base64 in
 * choices[0].message.audio.data. Each line → a segment WAV, concatenated to
 * loop-output/video/voiceover.wav via ffmpeg.
 *
 * Env: MIMO_API_KEY (required), MIMO_BASE_URL, MIMO_VOICE. Run: node scripts/make-voiceover.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "loop-output/video");
const segDir = resolve(outDir, "vo-seg");
const KEY = process.env.MIMO_API_KEY;
const BASE = process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1";
const VOICE = process.env.MIMO_VOICE ?? "Chloe";
const STYLE = "Speak in a calm, confident, professional tech-narrator voice at a measured pace.";
if (!KEY) { console.error("Set MIMO_API_KEY"); process.exit(1); }

// Narration for the v2 story (staking → on-chain slash → RWA), paced to
// intro(~27s) + terminal(~17s) + dashboard(~35s).
const LINES = [
  "verity is the trust layer for the machine economy, built on Casper.",
  "Most oracles can be confidently wrong forever and never pay a price. verity fixes that.",
  "The oracle bonds real collateral behind every call. A wrong call is slashed on-chain, and that capital pays the agents it misled.",
  "An oracle agent turns real market data, Casper and tokenized gold, a real-world asset, into a calibrated on-chain signal.",
  "The signal sits behind an x402 paywall. A DeFi agent pays per query, and the Casper facilitator settles it on-chain.",
  "The agent reads the oracle's on-chain reputation, seventy-five percent, and its bonded collateral, refusing any oracle without real capital at risk.",
  "Every step is a real transaction on cspr dot live: the contract, the signals, the payment, and the slash.",
  "verity. Machine-verifiable, collateral-backed trust, with no human in the loop.",
];

mkdirSync(segDir, { recursive: true });

async function tts(text, idx) {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mimo-v2.5-tts",
      messages: [
        { role: "user", content: STYLE },
        { role: "assistant", content: text },
      ],
      audio: { format: "wav", voice: VOICE },
      stream: false,
    }),
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
