/**
 * Scrape the rendered HTML from book.b9.golf/#/bookings/
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scrape-b9golf.js
 *
 * Output:
 *   rendered-html.html  — full rendered DOM
 */

const { chromium } = require("playwright");
const fs = require("fs");

const TARGET_URL = "https://book.b9.golf/f?slug=rochester-hills-mi&bookings=1";
const OUTPUT_FILE = "rendered-html.html";
const LOG_FILE = "scrape.log";

const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
function log(...args) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  const line = `${new Date().toISOString()} ${msg}`;
  logStream.write(line + "\n");
  console.log(line);
}

(async () => {
  log("Launching browser...");
  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    // Mimic a real desktop browser to avoid bot-detection
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  // Log any console errors from the page
  page.on("console", (msg) => {
    if (msg.type() === "error") log("[page error]", msg.text());
  });

  log(`Navigating to ${TARGET_URL} ...`);
  await page.goto(TARGET_URL, {
    waitUntil: "networkidle", // wait until no more network activity
    timeout: 30_000,
  });

  // Extra wait for any lazy-rendered content
  await page.waitForTimeout(2000);

  const html = await page.content();

  fs.writeFileSync(OUTPUT_FILE, html, "utf-8");
  log(`\nDone! Rendered HTML saved to: ${OUTPUT_FILE}`);
  log(`   File size: ${(html.length / 1024).toFixed(1)} KB`);

  log("\n--- Rendered HTML ---");
  log(html);

  await browser.close();
  logStream.end();
})();