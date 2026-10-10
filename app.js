const AIRLINES = { NZ: "Air New Zealand", JQ: "Jetstar", QF: "Qantas", VA: "Virgin Australia" };
const CITY = { AKL: "Auckland", DUD: "Dunedin" };
const STALE_HOURS = 24;
// Tags outbound fare links so partner sites can see the visit came from SouthHop.
// Nothing is tracked on SouthHop itself.
const UTM = { utm_source: "southhop", utm_medium: "referral", utm_campaign: "akl-dud-fares" };

const state = { data: null, route: "AKL-DUD", month: "all", selected: null };
const $ = (id) => document.getElementById(id);

const money = (n) => "$" + n.toLocaleString("en-NZ");
// departure_at already carries the local NZ offset, so read the wall-clock time straight from it.
const localDate = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z");
const fmtDay = (iso) => localDate(iso).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
const fmtTime = (iso) => {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};
const fmtDur = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : "Not listed");
const monthName = (ym, style = "short") => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-NZ", { month: style, timeZone: "UTC" });
const flightName = (f) => `${AIRLINES[f.airline] || f.airline} ${f.flightNumber ?? ""}`.trim();
const stopsText = (n) => (n ? `${n} stop${n > 1 ? "s" : ""}` : "");

function allFlights() { return state.data?.routes?.[state.route] || []; }
function flights() {
  const all = allFlights();
  return state.month === "all" ? all : all.filter((f) => f.departureAt.startsWith(state.month));
}
const cheapest = (list) => list.reduce((a, b) => (!a || b.price < a.price ? b : a), null);

function withUtm(url) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("google.com")) return url;
    for (const [k, v] of Object.entries(UTM)) u.searchParams.set(k, v);
    return u.toString();
  } catch { return url; }
}
function fareLink(f) {
  if (f?.link) return withUtm(f.link);
  const [from, to] = state.route.split("-");
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`one way flights from ${from} to ${to}${f ? " on " + f.departureAt.slice(0, 10) : ""}`)}`;
}
const siteName = (url) => {
  const h = new URL(url).hostname;
  return h.includes("aviasales") ? "Aviasales" : h.includes("google") ? "Google Flights" : h.includes("skyscanner") ? "Skyscanner" : h.replace(/^www\./, "");
};

function renderPass(list) {
  const [from, to] = state.route.split("-");
  $("fromCode").textContent = from; $("fromCity").textContent = CITY[from];
  $("toCode").textContent = to; $("toCity").textContent = CITY[to];
  $("swap").setAttribute("aria-label", `Swap direction: show ${CITY[to]} to ${CITY[from]}`);
  $("pass").classList.remove("is-loading");
  $("pass").removeAttribute("aria-busy");

  const f = state.selected || cheapest(list);
  if (!f) {
    $("stubLabel").textContent = "No fares loaded yet";
    $("pPrice").textContent = "–";
    ["pDate", "pTime", "pFlight", "pDur"].forEach((id) => ($(id).textContent = "–"));
    $("pBook").textContent = "Search Google Flights";
    $("pBook").href = fareLink();
    $("pCopy").hidden = true;
    return;
  }
  const monthLabel = state.month === "all" ? "" : ` in ${monthName(state.month, "long")}`;
  $("stubLabel").textContent = state.selected ? "Fare for the day you chose" : `Lowest fare found${monthLabel}`;
  $("pPrice").textContent = money(f.price);
  $("pDate").textContent = fmtDay(f.departureAt);
  $("pTime").textContent = fmtTime(f.departureAt);
  $("pFlight").textContent = flightName(f) + (f.stops ? `, ${stopsText(f.stops)}` : "");
  $("pDur").textContent = fmtDur(f.durationMin);
  $("pBook").textContent = "See this fare";
  $("pBook").href = fareLink(f);
  $("pCopy").hidden = false;
  $("fareText").textContent = `${CITY[from]} (${from}) to ${CITY[to]} (${to}), ${fmtDay(f.departureAt)} at ${fmtTime(f.departureAt)}, ${flightName(f)}: ${money(f.price)} NZD one-way. Found on SouthHop, price may change. ${fareLink(f)}`;
}

function renderMonths() {
  const all = allFlights();
  const months = [...new Set(all.map((f) => f.departureAt.slice(0, 7)))];
  if (state.month !== "all" && !months.includes(state.month)) state.month = "all";
  const chip = (value, title, sub) =>
    `<button class="month" type="button" data-month="${value}" aria-pressed="${state.month === value}"><b>${title}</b><small>${sub}</small></button>`;
  const low = cheapest(all);
  $("months").innerHTML = (all.length ? chip("all", "Any date", `from ${money(low.price)}`) : "") +
    months.map((m) => chip(m, monthName(m), `from ${money(cheapest(all.filter((f) => f.departureAt.startsWith(m))).price)}`)).join("");
}

function renderChart(list) {
  const el = $("chart");
  if (!list.length) { el.innerHTML = `<p class="empty">The chart fills in after the first price update.</p>`; return; }
  const max = Math.max(...list.map((f) => f.price));
  const low = cheapest(list);
  const focusIdx = Math.max(0, list.indexOf(state.selected || low));
  el.innerHTML = "";
  let lastMonth = "";
  list.forEach((f, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bar" + (f === low ? " cheap" : "") + (state.selected === f ? " sel" : "");
    b.style.height = `${Math.max(10, (f.price / max) * 100)}%`;
    b.tabIndex = i === focusIdx ? 0 : -1; // one tab stop; arrow keys move between days
    const label = `${fmtDay(f.departureAt)}, ${money(f.price)}${f === low ? ", lowest" : ""}`;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-pressed", state.selected === f);
    const m = f.departureAt.slice(0, 7);
    const day = localDate(f.departureAt).getUTCDate();
    if (m !== lastMonth) { b.innerHTML = `<span aria-hidden="true">${state.month === "all" ? monthName(m) : day}</span>`; lastMonth = m; }
    else if (state.month !== "all" && day % 7 === 0) b.innerHTML = `<span aria-hidden="true">${day}</span>`;
    b.onclick = () => { state.selected = state.selected === f ? null : f; render(); el.children[i]?.focus(); };
    el.appendChild(b);
  });
}
$("chart").addEventListener("keydown", (e) => {
  const bars = [...$("chart").querySelectorAll(".bar")];
  const i = bars.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: bars.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  const target = bars[Math.max(0, Math.min(bars.length - 1, next))];
  bars[i].tabIndex = -1; target.tabIndex = 0; target.focus();
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
});

function renderList(list) {
  const top = [...list].sort((a, b) => a.price - b.price).slice(0, 10);
  $("count").textContent = list.length ? `Out of ${list.length} days with fares.` : "";
  $("list").innerHTML = top.length
    ? top.map((f) => `<li>
        <span class="d">${fmtDay(f.departureAt)}</span>
        <span class="t">${fmtTime(f.departureAt)}</span>
        <span class="f">${flightName(f)}${f.stops ? `, ${stopsText(f.stops)}` : ""}</span>
        <span class="p">${money(f.price)}</span>
        <a href="${fareLink(f)}" data-outbound target="_blank" rel="noopener">See fare<span class="visually-hidden"> for ${fmtDay(f.departureAt)}, ${money(f.price)} (opens another website)</span></a>
      </li>`).join("")
    : `<li class="empty">No fares for this choice yet. Try the comparison links below.</li>`;
}

function renderUpdated() {
  const el = $("updated");
  if (!state.data?.updatedAt) { el.textContent = state.data ? "Prices haven't been loaded yet." : ""; return; }
  const mins = Math.round((Date.now() - new Date(state.data.updatedAt)) / 60000);
  const ago = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} hours ago` : `on ${new Date(state.data.updatedAt).toLocaleDateString("en-NZ", { day: "numeric", month: "long" })}`;
  const stale = mins > STALE_HOURS * 60;
  el.classList.toggle("stale", stale);
  el.textContent = stale ? `These prices were last updated ${ago} and may be out of date.` : `Prices updated ${ago}.`;
}

function render() {
  const [from, to] = state.route.split("-");
  $("headline").textContent = `Low fares from ${CITY[from]} to ${CITY[to]}`;
  $("lnkGoogle").href = fareLink();
  $("lnkSky").href = withUtm(`https://www.skyscanner.co.nz/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/`);
  const list = flights();
  renderPass(list);
  renderChart(list);
  renderList(list);
  renderUpdated();
  document.querySelectorAll(".month").forEach((b) => b.setAttribute("aria-pressed", b.dataset.month === state.month));
}

$("swap").addEventListener("click", () => {
  state.route = state.route === "AKL-DUD" ? "DUD-AKL" : "AKL-DUD";
  state.selected = null;
  const r = $("route");
  r.classList.remove("flip"); void r.offsetWidth; r.classList.add("flip");
  setTimeout(() => { renderMonths(); render(); }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 170);
});
$("months").addEventListener("click", (e) => {
  const b = e.target.closest(".month");
  if (!b) return;
  state.month = b.dataset.month; state.selected = null; render();
});

// ---------- "You're leaving SouthHop" confirmation ----------
let skipLeave = false; // kept in memory only, never stored on the device
const leave = $("leave");
document.addEventListener("click", (e) => {
  const a = e.target.closest("a[data-outbound]");
  if (!a || skipLeave || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  $("leave-site").textContent = siteName(a.href);
  $("leave-go").href = a.href;
  $("leave-skip").checked = false;
  leave.showModal();
  $("leave-go").focus();
});
$("leave-go").addEventListener("click", () => { skipLeave = $("leave-skip").checked; leave.close(); });
$("leave-cancel").addEventListener("click", () => leave.close());
leave.addEventListener("click", (e) => { if (e.target === leave) leave.close(); });

fetch("data/prices.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => { state.data = data; })
  .catch(() => { state.data = { routes: {} }; })
  .finally(() => { renderMonths(); render(); });
