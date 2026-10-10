const AIRLINES = { NZ: "Air New Zealand", JQ: "Jetstar", QF: "Qantas", VA: "Virgin Australia" };
const CITY = { AKL: "Auckland", DUD: "Dunedin" };

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
const fmtDur = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : "–");
const monthName = (ym, style = "short") => new Date(ym + "-01T12:00:00Z").toLocaleDateString("en-NZ", { month: style, timeZone: "UTC" });
const flightName = (f) => `${AIRLINES[f.airline] || f.airline} ${f.flightNumber ?? ""}`.trim();
const stopsText = (n) => (n ? `${n} stop${n > 1 ? "s" : ""}` : "");

function allFlights() { return state.data?.routes?.[state.route] || []; }
function flights() {
  const all = allFlights();
  return state.month === "all" ? all : all.filter((f) => f.departureAt.startsWith(state.month));
}
const cheapest = (list) => list.reduce((a, b) => (!a || b.price < a.price ? b : a), null);

function searchLink(f) {
  if (f?.link) return f.link;
  const [from, to] = state.route.split("-");
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`one way flights from ${from} to ${to}${f ? " on " + f.departureAt.slice(0, 10) : ""}`)}`;
}

function renderPass(list) {
  const [from, to] = state.route.split("-");
  $("fromCode").textContent = from; $("fromCity").textContent = CITY[from];
  $("toCode").textContent = to; $("toCity").textContent = CITY[to];

  const f = state.selected || cheapest(list);
  if (!f) {
    $("stubLabel").textContent = "No fares loaded yet";
    $("pPrice").textContent = "–";
    ["pDate", "pTime", "pFlight", "pDur"].forEach((id) => ($(id).textContent = "–"));
    $("pBook").textContent = "Search Google Flights";
    $("pBook").href = searchLink();
    return;
  }
  const monthLabel = state.month === "all" ? "" : ` in ${monthName(state.month, "long")}`;
  $("stubLabel").textContent = state.selected ? "Fare for this day" : `Lowest one-way fare${monthLabel}`;
  $("pPrice").textContent = money(f.price);
  $("pDate").textContent = fmtDay(f.departureAt);
  $("pTime").textContent = fmtTime(f.departureAt);
  $("pFlight").textContent = flightName(f) + (f.stops ? `, ${stopsText(f.stops)}` : "");
  $("pDur").textContent = fmtDur(f.durationMin);
  $("pBook").textContent = "See this fare";
  $("pBook").href = searchLink(f);
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
  el.innerHTML = "";
  let lastMonth = "";
  list.forEach((f) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "bar" + (f === low ? " cheap" : "") + (state.selected === f ? " sel" : "");
    b.style.height = `${Math.max(10, (f.price / max) * 100)}%`;
    b.title = `${fmtDay(f.departureAt)}: ${money(f.price)}`;
    b.setAttribute("aria-label", b.title);
    const m = f.departureAt.slice(0, 7);
    if (m !== lastMonth) { b.innerHTML = `<span>${state.month === "all" ? monthName(m) : localDate(f.departureAt).getUTCDate()}</span>`; lastMonth = m; }
    else if (state.month !== "all" && localDate(f.departureAt).getUTCDate() % 7 === 0) b.innerHTML = `<span>${localDate(f.departureAt).getUTCDate()}</span>`;
    b.onclick = () => { state.selected = state.selected === f ? null : f; render(); };
    el.appendChild(b);
  });
}

function renderList(list) {
  const top = [...list].sort((a, b) => a.price - b.price).slice(0, 10);
  $("count").textContent = list.length ? `Out of ${list.length} days with fares.` : "";
  $("list").innerHTML = top.length
    ? top.map((f) => `<li>
        <span class="d">${fmtDay(f.departureAt)}</span>
        <span class="t">${fmtTime(f.departureAt)}</span>
        <span class="f">${flightName(f)}${f.stops ? `, ${stopsText(f.stops)}` : ""}</span>
        <span class="p">${money(f.price)}</span>
        <a href="${searchLink(f)}" target="_blank" rel="noopener">See fare</a>
      </li>`).join("")
    : `<li class="empty">No fares for this choice yet. Try the comparison links below.</li>`;
}

function render() {
  const [from, to] = state.route.split("-");
  $("headline").textContent = `The cheapest way from ${CITY[from]} to ${CITY[to]}`;
  $("lnkGoogle").href = searchLink();
  $("lnkSky").href = `https://www.skyscanner.co.nz/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/`;
  const list = flights();
  renderPass(list);
  renderChart(list);
  renderList(list);
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

fetch("data/prices.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    state.data = data;
    if (data.updatedAt) {
      const mins = Math.round((Date.now() - new Date(data.updatedAt)) / 60000);
      $("updated").textContent = "Prices updated " + (mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : new Date(data.updatedAt).toLocaleDateString("en-NZ"));
    }
  })
  .catch(() => {})
  .finally(() => { renderMonths(); render(); });
