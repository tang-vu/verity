/**
 * Record a real screen-capture video of the verity dashboard using Playwright's
 * built-in video recording. Produces loop-output/video/<hash>.webm which the
 * build-demo-video pipeline converts to mp4 and stitches with terminal + voiceover.
 *
 * The tour scrolls by SECTION ELEMENT (not fixed offsets) so it survives layout
 * changes, and clicks the live x402 demo-buy button so the recording captures a
 * REAL on-chain purchase settling. ~42s.
 *
 * Prereqs: web dashboard on 3000 (self-contained; reads the chain via explorer API).
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

// Warm the deployment first (cold serverless start paints seconds of white that
// would otherwise open the recording), then record against the warm server.
{
  const warm = await browser.newContext();
  const warmPage = await warm.newPage();
  await warmPage.goto(URL, { waitUntil: "networkidle", timeout: 60_000 }).catch(() => {});
  await warm.close();
}

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log(`Opening ${URL} ...`);
await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 });
await page.waitForSelector(".rep-figure", { timeout: 30_000 }).catch(() => {});
await sleep(2500); // let live data + count-up animation land

/** Smooth-scroll so `selector` sits ~70px from the top of the viewport. */
async function scrollToSection(selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const target = window.scrollY + el.getBoundingClientRect().top - 70;
    return new Promise((res) => {
      const start = window.scrollY;
      const dur = 1300;
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
  }, selector);
}

// Beat lengths are tuned so each card is on screen while the voiceover is
// talking about it — see the group timings in make-voiceover.mjs. The
// calibration card gets the longest hold because its narration line is the
// longest, and because a subtitle used to sit right over its figures.
await sleep(2000); // hold: hero + reputation instrument (count-up)
await scrollToSection(".ticker");
await sleep(3200); // 5-metric strip
await scrollToSection(".bento");
await sleep(4000); // latest signal + bonded collateral
await scrollToSection(".bento > div:nth-child(3)");
await sleep(12000); // confidence calibration — claimed vs delivered, Brier, haircut
await scrollToSection(".section:has(table)");
await sleep(5000); // signal history (tx links, CSPR + PAXG RWA)
await scrollToSection(".loglist");
await sleep(5000); // autonomous loop timeline

// Finale — live x402 purchase: click the demo-buy button and wait until step
// [3/3] (settled on-chain) is actually rendered, so the closing frames always
// show the completed real settlement.
await scrollToSection("#try-it");
await sleep(1200);
const buyBtn = page.locator("#try-it button.btn.primary");
if (await buyBtn.count()) {
  await buyBtn.first().click().catch(() => {});
  console.log("demo-buy clicked — waiting for live settlement steps...");
  await page
    .locator("#try-it", { hasText: "[3/3]" })
    .waitFor({ timeout: 22_000 })
    .catch(() => console.log("settle step not seen in time — ending anyway"));
}
await sleep(6000);

await context.close(); // flush video
await browser.close();
console.log(`Video saved under ${outDir}`);
