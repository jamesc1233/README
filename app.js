const AIRLINES = { NZ: "Air New Zealand", JQ: "Jetstar", QF: "Qantas", VA: "Virgin Australia" };
const CITY = { AKL: "Auckland", DUD: "Dunedin" };

const state = { data: null, route: "AKL-DUD", month: "all", selected: null };
const $ = (id) => document.getElementById(id);

const money = (n) => "$" + n.toLocaleString("en-NZ");
// departure_at already carries the local NZ offset, so read the wall-clock time straight from it.
const localDate = (iso) => new Date(iso.slice(0, 10) + "T12:00:00Z");
const fmtDay = (iso) => localDate(iso).toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const fmtTime = (iso) => {
  const [h, m] = iso.slice(11, 16).split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
};
const fmtDur = (min) => (min ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}m` : "");
const airline = (code) => AIRLINES[code] || code;
const stops = (n) => (n === 0 ? "Direct" : `${n} stop${n > 1 ? "s" : ""}`);

function flights() {
  const all = state.data?.routes?.[state.route] || [];
  return state.month === "all" ? all : all.filter((f) => f.departureAt.startsWith(state.month));
}

function bookLink(f) {
  if (f?.link) return f.link;
  const [from, to] = state.route.split("-");
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`one way flights from ${from} to ${to}${f ? " on " + f.departureAt.slice(0, 10) : ""}`)}`;
}

function renderBest(list) {
  const best = state.selected || list.reduce((a, b) => (!a || b.price < a.price ? b : a), null);
  if (!best) {
    $("best").innerHTML = `<div><div class="label">No live fares yet</div>
      <p class="meta">Prices appear here after the first automatic update runs. In the meantime, compare fares directly:</p></div>
      <a class="btn" href="${bookLink()}" target="_blank" rel="noopener">Search Google Flights</a>`;
    return;
  }
  $("best").innerHTML = `<div>
      <div class="label">${state.selected ? "Selected date" : "Cheapest fare found"}</div>
      <div class="price">${money(best.price)}</div>
      <div class="meta">${fmtDay(best.departureAt)} · ${fmtTime(best.departureAt)} · ${airline(best.airline)} ${best.flightNumber ?? ""} · ${stops(best.stops)}${best.durationMin ? " · " + fmtDur(best.durationMin) : ""}</div>
    </div>
    <a class="btn" href="${bookLink(best)}" target="_blank" rel="noopener">View deal →</a>`;
}

function renderChart(list) {
  const el = $("chart");
  if (!list.length) { el.innerHTML = `<div class="empty">No fares to chart yet.</div>`; return; }
  const max = Math.max(...list.map((f) => f.price));
  const min = Math.min(...list.map((f) => f.price));
  el.innerHTML = "";
  list.forEach((f, i) => {
    const b = document.createElement("button");
    b.className = "bar" + (f.price === min ? " cheap" : "") + (state.selected === f ? " sel" : "");
    b.style.height = `${Math.max(12, (f.price / max) * 100)}%`;
    b.title = `${fmtDay(f.departureAt)}: ${money(f.price)}`;
    b.setAttribute("aria-label", b.title);
    const d = localDate(f.departureAt).getUTCDate();
    if (d === 1 || i === 0 || d % 7 === 0) b.innerHTML = `<span>${d}</span>`;
    b.onclick = () => { state.selected = state.selected === f ? null : f; render(); };
    el.appendChild(b);
  });
}

function renderList(list) {
  const top = [...list].sort((a, b) => a.price - b.price).slice(0, 10);
  $("count").textContent = list.length ? `${list.length} dates with fares` : "";
  $("list").innerHTML = top.length
    ? top.map((f) => `<li>
        <div><div class="when">${fmtDay(f.departureAt)} · ${fmtTime(f.departureAt)}</div>
        <div class="det">${airline(f.airline)} ${f.flightNumber ?? ""} · ${stops(f.stops)}${f.durationMin ? " · " + fmtDur(f.durationMin) : ""}</div></div>
        <div class="amt">${money(f.price)}</div>
        <a class="btn small" href="${bookLink(f)}" target="_blank" rel="noopener">View</a>
      </li>`).join("")
    : `<li class="empty">No fares found for this selection.</li>`;
}

function renderMonths() {
  const all = state.data?.routes?.[state.route] || [];
  const months = [...new Set(all.map((f) => f.departureAt.slice(0, 7)))];
  if (!months.includes(state.month)) state.month = "all";
  $("month").innerHTML = `<option value="all">All months</option>` + months
    .map((m) => `<option value="${m}" ${m === state.month ? "selected" : ""}>${new Date(m + "-01T12:00:00Z").toLocaleDateString("en-NZ", { month: "long", year: "numeric", timeZone: "UTC" })}</option>`)
    .join("");
}

function render() {
  const [from, to] = state.route.split("-");
  $("routeTitle").textContent = `${CITY[from]} → ${CITY[to]}`;
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-selected", b.dataset.route === state.route));
  $("lnkGoogle").href = bookLink();
  $("lnkSky").href = `https://www.skyscanner.co.nz/transport/flights/${from.toLowerCase()}/${to.toLowerCase()}/`;

  const list = flights();
  renderBest(list);
  renderChart(list);
  renderList(list);
}

document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => { state.route = b.dataset.route; state.selected = null; renderMonths(); render(); }));
$("month").addEventListener("change", (e) => { state.month = e.target.value; state.selected = null; render(); });

fetch("data/prices.json", { cache: "no-store" })
  .then((r) => r.json())
  .then((data) => {
    state.data = data;
    if (data.updatedAt) {
      const mins = Math.round((Date.now() - new Date(data.updatedAt)) / 60000);
      $("updated").textContent = "Updated " + (mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : new Date(data.updatedAt).toLocaleDateString("en-NZ"));
    }
  })
  .catch(() => {})
  .finally(() => { renderMonths(); render(); });
