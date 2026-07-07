/**
 * Stitch the verity demo video: intro reel + real terminal-loop scene + live
 * dashboard screen-capture, with the MiMo-TTS voiceover and burned-in subtitles
 * (.srt built from voiceover-timing.json). Output loop-output/verity-demo.mp4.
 *
 * Inputs (produced by the other scripts):
 *   loop-output/video/reel/*.webm          (record-scene demo-reel.html)
 *   loop-output/video/terminal/*.webm      (record-scene terminal-loop-scene.html)
 *   loop-output/video/*.webm               (record-dashboard.mjs — newest at root)
 *   loop-output/video/voiceover.wav + voiceover-timing.json (make-voiceover.mjs)
 *
 * Run: node scripts/build-demo-video.mjs
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vdir = resolve(root, "loop-output/video");

// Playwright names webm files with random hashes, so pick the most-recently
// written one (by mtime) rather than the alphabetically-last, or a rebuild would
// silently reuse a stale recording.
const newestWebm = (dir) => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".webm")).map((f) => resolve(dir, f));
  if (!files.length) throw new Error(`no .webm in ${dir}`);
  return files.sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1);
};

const reel = newestWebm(resolve(vdir, "reel"));
const terminal = newestWebm(resolve(vdir, "terminal"));
const dashboard = newestWebm(vdir); // root of video/
const voiceover = resolve(vdir, "voiceover.wav");

// --- Build .srt from voiceover timing ---------------------------------------
function ts(sec) {
  const ms = Math.round(sec * 1000);
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  const mm = String(ms % 1000).padStart(3, "0");
  return `${h}:${m}:${s},${mm}`;
}
const timing = JSON.parse(readFileSync(resolve(vdir, "voiceover-timing.json"), "utf8"));
const srtPath = resolve(vdir, "captions.srt");
writeFileSync(
  srtPath,
  timing.map((t, i) => `${i + 1}\n${ts(t.start)} --> ${ts(t.end)}\n${t.text}\n`).join("\n")
);
console.log(`captions.srt: ${timing.length} cues`);

// --- ffmpeg: normalize + concat 3 scenes, mux voiceover, burn subtitles -----
const out = resolve(root, "loop-output/verity-demo.mp4");
const norm = "scale=1280:800:force_original_aspect_ratio=decrease,pad=1280:800:-1:-1:color=0x0a0e14,setsar=1,fps=30";
// ffmpeg subtitles filter needs a forward-slash, escaped-colon path.
// Single pass so each character is rewritten exactly once (backslash → slash,
// colon → escaped colon) with no reprocessing of earlier replacements.
const srtForFilter = srtPath.replace(/[\\:]/g, (ch) => (ch === "\\" ? "/" : "\\:"));
const style =
  "FontName=Segoe UI,FontSize=20,PrimaryColour=&H00F3EDE6,OutlineColour=&H00140E0A,BorderStyle=1,Outline=2,Shadow=0,MarginV=40";

const filter =
  `[0:v]${norm}[v0];[1:v]${norm}[v1];[2:v]${norm}[v2];` +
  `[v0][v1][v2]concat=n=3:v=1:a=0[cat];` +
  `[cat]subtitles='${srtForFilter}':force_style='${style}'[v]`;

console.log("Encoding verity-demo.mp4 ...");
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i", reel,
    "-i", terminal,
    "-i", dashboard,
    "-i", voiceover,
    "-filter_complex", filter,
    "-map", "[v]",
    "-map", "3:a",
    "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k",
    out,
  ],
  { stdio: "inherit" }
);
console.log(`\nDone -> ${out}`);
