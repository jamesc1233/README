// Fetches the cheapest Auckland <-> Dunedin fares from the Travelpayouts
// (Aviasales) Data API and writes them to data/prices.json for the website.
//
// Usage: TRAVELPAYOUTS_TOKEN=xxxx node scripts/fetch-prices.mjs
// Runs automatically via .github/workflows/update-prices.yml.

import { writeFile, mkdir } from "node:fs/promises";

const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
const MARKER = process.env.TRAVELPAYOUTS_MARKER || ""; // optional affiliate id
const MONTHS_AHEAD = 6;
const ROUTES = [
  { from: "AKL", to: "DUD" },
  { from: "DUD", to: "AKL" },
];

if (!TOKEN) {
  console.error("Missing TRAVELPAYOUTS_TOKEN environment variable.");
  process.exit(1);
}

function monthsFromNow(n) {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    out.push(d.toISOString().slice(0, 7)); // YYYY-MM
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

async function fetchMonth(from, to, month) {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.search = new URLSearchParams({
    origin: from,
    destination: to,
    departure_at: month,
    one_way: "true",
    sorting: "price",
    currency: "nzd",
    market: "nz",
    limit: "1000",
  }).toString();

  const res = await fetch(url, { headers: { "X-Access-Token": TOKEN, "Accept-Encoding": "gzip" } });
  if (!res.ok) throw new Error(`${from}-${to} ${month}: HTTP ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(`${from}-${to} ${month}: ${body.error || "API error"}`);
  return body.data || [];
}

function toFlight(f) {
  let link = f.link ? `https://www.aviasales.com${f.link}` : null;
  if (link && MARKER) link += `${link.includes("?") ? "&" : "?"}marker=${MARKER}`;
  return {
    price: Math.round(f.price),
    airline: f.airline,
    flightNumber: f.flight_number,
    departureAt: f.departure_at,
    stops: f.transfers ?? 0,
    durationMin: f.duration_to ?? f.duration ?? null,
    from: f.origin_airport || f.origin,
    to: f.destination_airport || f.destination,
    link,
  };
}

const now = Date.now();
const output = { updatedAt: new Date().toISOString(), currency: "NZD", routes: {} };
let failures = 0;

for (const { from, to } of ROUTES) {
  const key = `${from}-${to}`;
  const flights = [];
  for (const month of monthsFromNow(MONTHS_AHEAD)) {
    try {
      flights.push(...(await fetchMonth(from, to, month)));
    } catch (err) {
      failures++;
      console.warn(err.message);
    }
  }

  // Keep only future departures and the cheapest fare per day.
  const byDay = new Map();
  for (const f of flights.map(toFlight)) {
    if (new Date(f.departureAt).getTime() < now) continue;
    const day = f.departureAt.slice(0, 10);
    if (!byDay.has(day) || f.price < byDay.get(day).price) byDay.set(day, f);
  }
  output.routes[key] = [...byDay.values()].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  console.log(`${key}: ${output.routes[key].length} days with fares`);
}

if (failures === ROUTES.length * MONTHS_AHEAD) {
  console.error("Every request failed; leaving existing data untouched.");
  process.exit(1);
}

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/prices.json", import.meta.url), JSON.stringify(output, null, 2) + "\n");
console.log("Wrote data/prices.json");
