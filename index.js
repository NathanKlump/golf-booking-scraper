const fs = require("fs");
const { scrapeB9Golf } = require("./scrapers/b9golf");

const TODAY = new Date().toISOString().split("T")[0];
const OUTPUT_DIR = "logs";
const OUTPUT_FILE = `${OUTPUT_DIR}/bookings.json`;

const CLI_SLUG = process.argv[2];

const SITES = [
  { name: "b9golf", scraper: scrapeB9Golf, slug: CLI_SLUG || "rochester-hills-mi" },
];

function log(...args) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  console.log(`${new Date().toISOString()} ${msg}`);
}

(async () => {
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

  for (const site of SITES) {
    log(`--- Running scraper: ${site.name} ---`);
    try {
      const bookings = await site.scraper(site.slug);
      allBookings.push(...bookings);
    } catch (err) {
      log(`Scraper "${site.name}" failed: ${err.message}`);
    }
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

  const json = JSON.stringify(allBookings, null, 2);
  fs.writeFileSync(OUTPUT_FILE, json, "utf-8");

  log(`\nDone! Bookings saved to: ${OUTPUT_FILE}`);
  log(`   Total entries: ${allBookings.length}`);
})();
