/**
 * Scrape booked tee times from book.b9.golf/#/bookings/
 *
 * Prerequisites:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Run:
 *   node scrape-b9golf.js [slug]
 *   node scrape-b9golf.js rochester-hills-mi
 *
 * Output:
 *   bookings.json — structured tee time data
 */
const { chromium } = require("playwright");
const fs = require("fs");

const SLUG = process.argv[2] || "rochester-hills-mi";
const TARGET_URL = `https://book.b9.golf/f?slug=${SLUG}&bookings=1`;
const OUTPUT_FILE = "bookings.json";
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
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/124.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") log("[page error]", msg.text());
  });

  log(`Navigating to ${TARGET_URL} ...`);
  await page.goto(TARGET_URL, {
    waitUntil: "networkidle",
    timeout: 30_000,
  });
  await page.waitForTimeout(2000);

  // Extract events directly from the rendered FullCalendar DOM
  const bookings = await page.evaluate(() => {
    const results = [];

    // Each day column has a data-date attribute
    const dayCols = document.querySelectorAll(".fc-timegrid-col[data-date]");

    dayCols.forEach((col) => {
      const date = col.getAttribute("data-date");

      // Each booked event harness within this day
      const eventEls = col.querySelectorAll(".fc-timegrid-event");

      eventEls.forEach((el) => {
        const timeEl = el.querySelector(".fc-event-time");
        const titleEl = el.querySelector(".fc-event-title");

        if (!timeEl || !titleEl) return;

        const timeText = timeEl.textContent.trim();   // e.g. "3:00 - 5:00"
        const titleText = titleEl.textContent.trim(); // e.g. "Booked - Bay 2"

        // Skip background/unavailable blocks
        if (titleText.toLowerCase().includes("unavailable")) return;

        // Parse bay from title
        const bayMatch = titleText.match(/Bay\s+(\d+)/i);
        const bay = bayMatch ? parseInt(bayMatch[1]) : null;

        // Parse start/end times
        const timeParts = timeText.match(/(\d+:\d+)\s*-\s*(\d+:\d+)/);
        let startTime = null;
        let endTime = null;
        if (timeParts) {
          startTime = timeParts[1];
          endTime = timeParts[2];
        }

        results.push({
          date,
          startTime,
          endTime,
          bay,
          title: titleText,
          status: "booked",
        });
      });

      // Also capture unavailable/blocked ranges per day
      const bgEvents = col.querySelectorAll(".fc-bg-event");
      bgEvents.forEach((el) => {
        const titleEl = el.querySelector(".fc-event-title");
        if (!titleEl) return;
        const titleText = titleEl.textContent.trim();
        if (titleText.toLowerCase().includes("unavailable")) {
          results.push({
            date,
            startTime: null,
            endTime: null,
            bay: null,
            title: titleText,
            status: "unavailable",
          });
        }
      });
    });

    return results;
  });

  // Build final output
  const output = {
    slug: SLUG,
    scrapedAt: new Date().toISOString(),
    url: TARGET_URL,
    bookings,
  };

  const json = JSON.stringify(output, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json, "utf-8");

  log(`\nDone! Bookings saved to: ${OUTPUT_FILE}`);
  log(`   Found ${bookings.length} entries`);
  log("\n--- Bookings JSON ---");
  log(json);

  await browser.close();
  logStream.end();
})();