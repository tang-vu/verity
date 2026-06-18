/**
 * Record the CSS-animated intro/terminal reel (scripts/demo-reel.html) to a webm.
 * The HTML drives its own ~27s timeline; we just open it and record.
 * Run: node scripts/record-reel.mjs
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "loop-output/video/reel");
const reel = pathToFileURL(resolve(root, "scripts/demo-reel.html")).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
console.log(`Opening reel ${reel}`);
await page.goto(reel, { waitUntil: "load" });
await sleep(27_500); // let the full keyframe timeline play
await context.close();
await browser.close();
console.log(`Reel saved under ${outDir}`);
