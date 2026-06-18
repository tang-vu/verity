/**
 * Record a static animated HTML scene to webm for a fixed duration.
 * Usage: node scripts/record-scene.mjs <html-file> <seconds> <out-subdir>
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [htmlArg, secArg, sub] = process.argv.slice(2);
if (!htmlArg || !secArg || !sub) {
  console.error("Usage: record-scene.mjs <html-file> <seconds> <out-subdir>");
  process.exit(1);
}
const htmlUrl = pathToFileURL(resolve(root, htmlArg)).href;
const outDir = resolve(root, "loop-output/video", sub);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
await page.goto(htmlUrl, { waitUntil: "load" });
await sleep(Number(secArg) * 1000 + 400);
await context.close();
await browser.close();
console.log(`scene "${sub}" recorded (${secArg}s) -> ${outDir}`);
