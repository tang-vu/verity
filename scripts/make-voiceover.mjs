/**
 * Generate the demo voiceover. Engine picked by env:
 *   - MIMO_API_KEY set  → MiMo TTS (mimo-v2.5-tts over chat/completions; the WAV
 *     comes back base64 in choices[0].message.audio.data).
 *   - otherwise         → Edge neural TTS via msedge-tts (keyless; flaky socket,
 *     so each line retries up to 3×).
 *
 * Lines are grouped per video scene; after each group a silence pad is inserted
 * so the next group starts exactly on its scene boundary (reel 16s → terminal
 * 40s → dashboard). Segments concat to loop-output/video/voiceover.wav and the
 * cue times land in voiceover-timing.json (consumed by build-demo-video.mjs).
 *
 * Env: MIMO_API_KEY, MIMO_BASE_URL, MIMO_VOICE, EDGE_VOICE.
 * Run: node scripts/make-voiceover.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "loop-output/video");
const segDir = resolve(outDir, "vo-seg");

const MIMO_KEY = process.env.MIMO_API_KEY;
const MIMO_BASE = process.env.MIMO_BASE_URL ?? "https://api.xiaomimimo.com/v1";
const MIMO_VOICE = process.env.MIMO_VOICE ?? "Chloe";
const EDGE_VOICE = process.env.EDGE_VOICE ?? "en-US-AndrewNeural";
const STYLE = "Speak in a calm, confident, professional tech-narrator voice at a measured pace.";

// Narration for the final-round cut (83.3% reputation, live x402 paywall, MCP
// server). Groups end on the scene boundaries of the stitched video.
const GROUPS = [
  {
    endAt: 16, // intro reel
    lines: [
      "verity is the trust layer for the machine economy, built on Casper.",
      "Most oracles can be confidently wrong forever, and never pay a price. verity makes an oracle's word cost exactly its accuracy.",
    ],
  },
  {
    endAt: 40, // terminal loop scene
    lines: [
      "The loop runs live on testnet: a DeFi agent discovers the oracle over MCP, hits an x402 paywall, and pays per signal, settled on-chain.",
      "It reads the oracle's on-chain record, eighty three percent, and its bonded collateral, then sizes the trade: accuracy times confidence.",
      "This run: sell, four hundred fifty eight units, via the CSPR dot trade MCP. No human touched anything.",
    ],
  },
  {
    endAt: null, // dashboard walkthrough
    lines: [
      "Everything lands on a live dashboard, reconstructed in real time from the public Casper explorer.",
      "The oracle bonds real collateral behind every call. When it was wrong, the contract slashed four hundred x402 dollars on-chain, into a consumer-protection treasury.",
      "Feeds cover Casper and tokenized gold, a real world asset. And anyone — human or agent — can buy the signal over x402 right from the browser, or through verity's own MCP server.",
      "verity. Machine-verifiable, collateral-backed trust, with no human in the loop. Live on Casper testnet.",
    ],
  },
];

mkdirSync(segDir, { recursive: true });

async function mimoTts(text, idx) {
  const res = await fetch(`${MIMO_BASE}/chat/completions`, {
    method: "POST",
    headers: { "api-key": MIMO_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mimo-v2.5-tts",
      messages: [
        { role: "user", content: STYLE },
        { role: "assistant", content: text },
      ],
      audio: { format: "wav", voice: MIMO_VOICE },
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${await res.text()}`);
  const j = await res.json();
  const b64 = j.choices?.[0]?.message?.audio?.data;
  if (!b64) throw new Error(`no audio in response: ${JSON.stringify(j).slice(0, 200)}`);
  const seg = resolve(segDir, `seg_${String(idx).padStart(2, "0")}.wav`);
  writeFileSync(seg, Buffer.from(b64, "base64"));
  return seg;
}

async function edgeTts(text, idx) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
  const dir = resolve(segDir, `edge_${String(idx).padStart(2, "0")}`);
  mkdirSync(dir, { recursive: true });
  // The Edge websocket intermittently closes before turn.end — retry fresh.
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(EDGE_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioFilePath } = await tts.toFile(dir, text);
      return audioFilePath;
    } catch (err) {
      lastErr = err;
      console.log(`  edge-tts attempt ${attempt} failed (${err.message}) — retrying`);
    }
  }
  throw lastErr;
}

function audioDuration(path) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path,
  ]);
  return parseFloat(String(out).trim());
}

function makeSilence(seconds, idx) {
  const seg = resolve(segDir, `sil_${String(idx).padStart(2, "0")}.wav`);
  execFileSync("ffmpeg", [
    "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono", "-t", seconds.toFixed(3), seg,
  ], { stdio: "ignore" });
  return seg;
}

const engine = MIMO_KEY ? "mimo" : "edge";
console.log(`Generating voiceover segments (engine: ${engine})...`);
const segs = [];
const timing = [];
let cursor = 0;
let idx = 0;
for (const group of GROUPS) {
  for (const text of group.lines) {
    const seg = MIMO_KEY ? await mimoTts(text, idx) : await edgeTts(text, idx);
    const dur = audioDuration(seg);
    console.log(`  seg ${idx}: ${dur.toFixed(1)}s`);
    segs.push(seg);
    timing.push({ text, start: cursor, end: cursor + dur });
    cursor += dur;
    idx++;
  }
  // Pad with silence so the next group starts on its scene boundary.
  if (group.endAt !== null && cursor < group.endAt) {
    const pad = group.endAt - cursor;
    segs.push(makeSilence(pad, idx));
    console.log(`  pad: ${pad.toFixed(1)}s silence to t=${group.endAt}s`);
    cursor = group.endAt;
  } else if (group.endAt !== null) {
    console.log(`  ! group overran its scene boundary (${cursor.toFixed(1)}s > ${group.endAt}s)`);
  }
}
writeFileSync(resolve(outDir, "voiceover-timing.json"), JSON.stringify(timing, null, 2));

// Concat segments (mixed wav/mp3 → re-encode once to a single WAV).
const listFile = resolve(segDir, "list.txt");
writeFileSync(listFile, segs.map((s) => `file '${s.replace(/\\/g, "/")}'`).join("\n"));
const voiceover = resolve(outDir, "voiceover.wav");
execFileSync("ffmpeg", [
  "-y", "-f", "concat", "-safe", "0", "-i", listFile, "-ar", "24000", "-ac", "1", voiceover,
], { stdio: "ignore" });
console.log(`Voiceover written: ${voiceover} (${audioDuration(voiceover).toFixed(1)}s)`);
if (existsSync(listFile)) rmSync(listFile);
