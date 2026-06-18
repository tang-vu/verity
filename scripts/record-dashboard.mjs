/**
 * Record a real screen-capture video of the verity dashboard using Playwright's
 * built-in video recording. Produces loop-output/video/<hash>.webm which the
 * build-demo-video pipeline converts to mp4 and stitches with terminal + voiceover.
 *
 * Prereqs: oracle server (4021) + web dashboard (3000) running.
 * Run: node scripts/record-dashboard.mjs
 */
import { chromium } from "playwright";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "loop-output/video");
const URL = process.env.WEB_URL ?? "http://localhost:3000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log(`Opening ${URL} ...`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await sleep(3500); // let the 5s poll populate reputation + signals + loop

// Smooth scripted tour (~35s) so the recording reads like a walkthrough.
async function smoothScrollTo(y) {
  await page.evaluate((target) => {
    return new Promise((res) => {
      const start = window.scrollY;
      const dur = 1400;
      const t0 = performance.now();
      function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        const e = 0.5 - Math.cos(k * Math.PI) / 2; // ease-in-out
        window.scrollTo(0, start + (target - start) * e);
        if (k < 1) requestAnimationFrame(step);
        else res();
      }
      requestAnimationFrame(step);
    });
  }, y);
}

await sleep(2500); // hold on the hero + reputation card
await smoothScrollTo(280);
await sleep(2500); // latest signal card
await smoothScrollTo(620);
await sleep(3500); // signal history table (tx links)
await smoothScrollTo(1050);
await sleep(4000); // autonomous loop panel
await smoothScrollTo(620);
await sleep(2000);
await smoothScrollTo(0);
await sleep(2500);

await context.close(); // flush video
await browser.close();
console.log(`Video saved under ${outDir}`);
