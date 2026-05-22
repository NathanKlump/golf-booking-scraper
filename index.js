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
const TODAY = new Date().toISOString().split("T")[0];
const OUTPUT_DIR = "logs";
const OUTPUT_FILE = `${OUTPUT_DIR}/bookings.json`;

function log(...args) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  console.log(`${new Date().toISOString()} ${msg}`);
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

  const MAX_RETRIES = 3;
  let bookings;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    log(`Navigating to ${TARGET_URL} (attempt ${attempt}/${MAX_RETRIES})...`);
    try {
      await page.goto(TARGET_URL, {
        waitUntil: "load",
        timeout: 30_000,
      });
    } catch (err) {
      log(`Navigation error: ${err.message}`);
      if (attempt === MAX_RETRIES) throw err;
      continue;
    }

    try {
      await page.waitForSelector(".fc-timegrid-col[data-date]", { timeout: 15000 });
    } catch {
      log("Warning: calendar columns did not appear within 15s");
    }

    bookings = await page.evaluate(() => {
      const results = [];

      const dayCols = document.querySelectorAll(".fc-timegrid-col[data-date]");

      dayCols.forEach((col) => {
        const date = col.getAttribute("data-date");

        const eventEls = col.querySelectorAll(".fc-timegrid-event");

        eventEls.forEach((el) => {
          const timeEl = el.querySelector(".fc-event-time");
          const titleEl = el.querySelector(".fc-event-title");

          if (!timeEl || !titleEl) return;

          const timeText = timeEl.textContent.trim();
          const titleText = titleEl.textContent.trim();

          if (titleText.toLowerCase().includes("unavailable")) return;

          const bayMatch = titleText.match(/Bay\s+(\d+)/i);
          const bay = bayMatch ? parseInt(bayMatch[1]) : null;

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
          });
        });
      });

      return results;
    });

    if (bookings.length > 0) break;
    log(`Found 0 bookings on attempt ${attempt}/${MAX_RETRIES}`);
  }

  // Build final output — append new bookings to accumulating file
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  let allBookings = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
      if (Array.isArray(existing)) {
        allBookings = existing;
      } else if (existing && Array.isArray(existing.days)) {
        allBookings = existing.days.flatMap((d) => d.bookings);
      }
    } catch (e) {
      log(`Warning: could not parse existing ${OUTPUT_FILE}, starting fresh`);
    }
  }

  const enrichedBookings = bookings.map((b) => ({ ...b, url: TARGET_URL }));
  allBookings.push(...enrichedBookings);

  const json = JSON.stringify(allBookings, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json, "utf-8");

  log(`\nDone! Bookings saved to: ${OUTPUT_FILE}`);
  log(`   Found ${bookings.length} entries`);
  log("\n--- Bookings JSON ---");
  log(json);

  await browser.close();
})();