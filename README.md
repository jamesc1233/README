# SouthHop ✈️ – cheapest flights Auckland ⇄ Dunedin

A static website that shows real, cheapest one-way fares between Auckland (AKL) and Dunedin (DUD).
A GitHub Action fetches prices from the free Travelpayouts / Aviasales Data API every 6 hours and saves
them to `data/prices.json`. The page reads that file, so your API key is never exposed in the browser.

## Setup (about 10 minutes, all in the browser)

1. **Get a free API token**: sign up at <https://www.travelpayouts.com>, then copy your API token from
   *Profile → API token*. (Your "marker" / partner ID is optional – it earns you commission on bookings.)
2. **Add it to this repo**: *Settings → Secrets and variables → Actions → New repository secret*
   - Name `TRAVELPAYOUTS_TOKEN`, value = your token
   - (optional) `TRAVELPAYOUTS_MARKER`, value = your marker
3. **Turn on the website**: *Settings → Pages → Deploy from a branch* → choose your branch and `/ (root)`.
4. **Load prices now**: *Actions → Update flight prices → Run workflow*. After that it runs every 6 hours.
   (Scheduled runs only happen on the repo's default branch.)

## Files

| File | What it does |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The website |
| `assets/logo.svg` | Logo and browser-tab icon |
| `scripts/fetch-prices.mjs` | Downloads fares for the next 6 months, keeps the cheapest per day |
| `.github/workflows/update-prices.yml` | Runs the script on a schedule and commits new prices |
| `data/prices.json` | The latest prices (written automatically) |

Prices come from recent searches cached by Aviasales, so they're real but can be a few hours old –
always check the final price on the booking page.
