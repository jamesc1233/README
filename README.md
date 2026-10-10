# SouthHop ✈️ – low fares between Auckland and Dunedin

A static website that shows the lowest one-way fares found between Auckland (AKL) and Dunedin (DUD).
A GitHub Action fetches prices from the free Travelpayouts / Aviasales Data API about every 6 hours and
saves them to `data/prices.json`. The page reads that file, so your API key is never exposed in the browser.

## Before you publish: fill in your details

The pages contain placeholders in double curly brackets. Replace every one of them across all `.html`
files. On GitHub, press `.` to open the web editor, then use **Search → Replace in files**.

| Placeholder | Replace with | Used in |
| --- | --- | --- |
| `{{BUSINESS_NAME}}` | Your full legal name, or your registered business name | Footer, contact, all policies |
| `{{CITY}}` | The town or city you operate from | Footer, contact, policies |
| `{{CONTACT_EMAIL}}` | An email address you check (this also switches on the contact form) | Footer, contact, policies |
| `{{NZBN}}` | Your New Zealand Business Number, or delete that row in `contact.html` if you don't have one | Contact page |
| `{{EMAIL_PROVIDER}}` | Who hosts that email, e.g. "Google (Gmail)" | Privacy policy |
| `{{PRIVACY_OFFICER_NAME}}` | The person responsible for privacy (can be you) | Privacy policy |

Search for `{{` afterwards to make sure none are left.

## Setup (about 10 minutes, all in the browser)

1. **Get a free API token**: sign up at <https://www.travelpayouts.com>, then copy your API token from
   *Profile → API token*. (Your "marker" / partner ID is optional – it earns you commission on bookings.)
2. **Add it to this repo**: *Settings → Secrets and variables → Actions → New repository secret*
   - Name `TRAVELPAYOUTS_TOKEN`, value = your token
   - (optional) `TRAVELPAYOUTS_MARKER`, value = your marker
3. **Turn on the website**: *Settings → Pages → Deploy from a branch* → choose your branch and `/ (root)`.
4. **Load prices now**: *Actions → Update flight prices → Run workflow*. After that it runs about every 6 hours.
   (Scheduled runs only happen on the repo's default branch.)

## Pages

| Page | What it is |
| --- | --- |
| `index.html` | Fares: boarding pass, month picker, price chart, ten cheapest days |
| `faq.html` | Questions and answers (expandable) |
| `contact.html` | Business details and contact form |
| `privacy.html`, `terms.html`, `cookies.html`, `refunds.html`, `accessibility.html` | Policies, each with a "Last updated" date |

Shared files: `styles.css` (all styles), `print.css` (print layout), `site.js` (menu, search, back to top,
scroll progress, copy buttons, contact form), `app.js` (fares page), `assets/` (logo and self-hosted fonts).

## What's built in

- **Privacy:** no cookies, no local storage, no analytics, no third-party embeds. Fonts are hosted on the
  site, so pages don't contact Google. The contact form opens the visitor's own email app instead of
  sending data to a server, and it stays hidden if JavaScript is off so data can't leak into a web address.
- **Accessibility:** skip link, landmarks, labelled controls, visible focus, keyboard-friendly chart
  (arrow keys), WCAG AA contrast in light and dark mode, reduced-motion support. Checked with axe-core.
- **Honesty:** fares are labelled as the lowest *found*, the page warns when prices are more than a day
  old, every fare link shows a "You're leaving SouthHop" note first, and the commission is disclosed.
- **UTM tags:** fare links to Aviasales and Skyscanner include `utm_source=southhop` so those sites can
  see the visit came from SouthHop. Nothing is tracked on SouthHop itself.

## Changing the "Last updated" dates

Each policy page has a line like `Last updated <time datetime="2026-10-10">10 October 2026</time>`.
When you change a policy, update both dates on that page.

## Legal notes

The policies were written for how this site works today, but they are a starting point, not legal
advice. Have them checked by a New Zealand lawyer or a service like Community Law before you rely on
them, especially if you start earning commission.
