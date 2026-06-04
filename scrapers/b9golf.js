function log(...args) {
  const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  console.log(`${new Date().toISOString()} [b9golf] ${msg}`);
}

async function getFranchiseId(slug) {
  const url = `https://thebackninegolf.com/local/${slug}/bookings/`;
  log(`Fetching booking page to extract franchise config...`);
  const res = await fetch(url);
  const html = await res.text();

  const idx = html.indexOf("window.viewJsVars = ");
  if (idx === -1) throw new Error(`Could not find viewJsVars in ${url}`);

  const start = idx + "window.viewJsVars = ".length;
  let depth = 0, inStr = false, esc = false, end = start;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (esc) { esc = false; continue; }
    if (inStr) { if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
  }

  const viewJsVars = JSON.parse(html.slice(start, end));
  const franchiseId = viewJsVars.BOOKING_CONFIG?.franchiseId;

  if (!franchiseId) {
    throw new Error(`Could not extract franchiseId from BOOKING_CONFIG in ${url}`);
  }

  log(`Found franchiseId: ${franchiseId}`);
  return franchiseId;
}

async function fetchAvailability(slug, date, franchiseId) {
  const url = `https://thebackninegolf.com/local/${slug}/bookings/fetch_availability`;
  log(`Fetching availability from API...`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify({
      date,
      franchise_id: franchiseId,
      booking_type: "booking",
    }),
  });
  return res.json();
}

async function scrapeB9Golf(slug) {
  const today = new Date().toISOString().split("T")[0];

  const franchiseId = await getFranchiseId(slug);
  const data = await fetchAvailability(slug, today, franchiseId);

  if (data.error || !data.data || !data.data.available) {
    log(`No availability data found`);
    return [];
  }

  const { bays, available } = data.data;

  const baysById = Object.fromEntries(
    bays.map((b) => [String(b.id), b.title])
  );

  function formatTime(iso) {
    const m = iso.match(/T(\d+):(\d+)/);
    return m ? `${parseInt(m[1])}:${m[2]}` : null;
  }

  function parseBay(title) {
    const m = title?.match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
  }

  const bookings = available.map((slot) => ({
    date: slot.start.slice(0, 10),
    startTime: formatTime(slot.start),
    endTime: formatTime(slot.end),
    bay: parseBay(baysById[slot.resourceId]),
    url: `https://book.b9.golf/f?slug=${slug}&bookings=1`,
  }));

  log(`Found ${bookings.length} available slots`);
  return bookings;
}

module.exports = { scrapeB9Golf };
