// Shared behaviour for every SouthHop page: mobile menu, scroll progress,
// back-to-top, copy buttons, site search and the contact form.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  if (!$(".fab")) document.body.classList.add("contact-page");

  // ---------- Mobile menu ----------
  const menuBtn = $(".menu-btn");
  const nav = $("#site-nav");
  const setMenu = (open) => { menuBtn.setAttribute("aria-expanded", open); nav.classList.toggle("open", open); };
  menuBtn?.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && nav.classList.contains("open")) { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener("click", (e) => {
    if (nav.classList.contains("open") && !e.target.closest(".site-head")) setMenu(false);
  });

  // ---------- Scroll progress and back to top ----------
  const bar = $(".progress span");
  const toTop = $(".to-top");
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    toTop.hidden = scrollY < 600;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();
  toTop.addEventListener("click", () => {
    scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    $("#main").focus({ preventScroll: true });
  });

  // ---------- Copy to clipboard ----------
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy-target]");
    if (!btn) return;
    const source = document.getElementById(btn.dataset.copyTarget);
    const text = source?.textContent.trim();
    if (!text) return;
    const label = btn.dataset.label || (btn.dataset.label = btn.textContent.trim());
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      // Clipboard blocked: select the text so the visitor can copy it themselves.
      const range = document.createRange();
      source.classList.remove("visually-hidden");
      range.selectNodeContents(source);
      getSelection().removeAllRanges(); getSelection().addRange(range);
      btn.textContent = "Press Ctrl+C or Cmd+C to copy";
    }
    btn.classList.add("done");
    setTimeout(() => {
      btn.textContent = label; btn.classList.remove("done");
      if (source.id === "fareText") source.classList.add("visually-hidden");
    }, 2500);
  });

  // ---------- Site search ----------
  const PAGES = ["index.html", "faq.html", "contact.html", "privacy.html", "terms.html", "cookies.html", "refunds.html", "accessibility.html"];
  const dlg = $("#search");
  const q = $("#search-q");
  const results = $("#search-results");
  const status = $("#search-status");
  let index = null;

  async function buildIndex() {
    const parser = new DOMParser();
    const pages = await Promise.all(PAGES.map(async (url) => {
      try {
        const html = await (await fetch(url)).text();
        return { url, doc: parser.parseFromString(html, "text/html") };
      } catch { return null; }
    }));
    const entries = [];
    for (const p of pages.filter(Boolean)) {
      const main = p.doc.querySelector("main");
      if (!main) continue;
      const pageTitle = main.querySelector("h1")?.textContent.trim() || p.url;
      // One entry per section: the h1 intro, then each h2 with the text that follows it.
      let current = { url: p.url, title: pageTitle, text: "" };
      const walk = main.querySelectorAll("h2, p, li, dd, dt, summary");
      for (const el of walk) {
        if (el.tagName === "H2" && !el.closest("summary")) {
          entries.push(current);
          current = { url: `${p.url}#${el.id || el.closest("[id]")?.id || ""}`, title: `${pageTitle}: ${el.textContent.trim()}`, text: "" };
        } else if (el.tagName === "SUMMARY") {
          entries.push(current);
          const id = el.closest("details")?.id;
          current = { url: `${p.url}${id ? "#" + id : ""}`, title: `${pageTitle}: ${el.textContent.trim()}`, text: "" };
        } else if (!el.closest("summary")) {
          current.text += " " + el.textContent.replace(/\s+/g, " ").trim();
        }
      }
      entries.push(current);
    }
    return entries.filter((e) => e.text.trim() || e.title);
  }

  function snippet(text, terms) {
    const lower = text.toLowerCase();
    const at = Math.max(0, lower.indexOf(terms[0]) - 50);
    let s = (at > 0 ? "…" : "") + text.slice(at, at + 160).trim() + (text.length > at + 160 ? "…" : "");
    s = esc(s);
    for (const t of terms) s = s.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), "<mark>$1</mark>");
    return s;
  }

  function runSearch() {
    const terms = q.value.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
    results.innerHTML = "";
    if (!terms.length) { status.textContent = ""; return; }
    if (!index) { status.textContent = "Loading search…"; return; }
    const hits = index
      .map((e) => {
        const hay = (e.title + " " + e.text).toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const score = terms.reduce((n, t) => n + (e.title.toLowerCase().includes(t) ? 3 : 0) + hay.split(t).length - 1, 0);
        return { ...e, score };
      })
      .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 8);
    status.textContent = hits.length ? `${hits.length} result${hits.length > 1 ? "s" : ""}` : `No results for "${q.value.trim()}". Try a different word.`;
    results.innerHTML = hits.map((h) => `<li><a href="${esc(h.url)}"><b>${esc(h.title)}</b><span>${snippet(h.text.trim() || h.title, terms)}</span></a></li>`).join("");
  }

  $$("[data-open-search]").forEach((b) => b.addEventListener("click", async () => {
    setMenu(false);
    dlg.showModal();
    q.focus();
    if (!index) {
      status.textContent = "Loading search…";
      index = await buildIndex();
      status.textContent = index.length ? "" : "Search isn't available right now.";
      runSearch();
    }
  }));
  q.addEventListener("input", runSearch);
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close(); // click on the backdrop
    if (e.target.closest(".search-results a")) dlg.close();
  });
  $(".search-form").addEventListener("submit", (e) => {
    // Enter opens the first result.
    e.preventDefault();
    const first = results.querySelector("a");
    if (first) { dlg.close(); location.href = first.href; }
  });
  $("#search-close").addEventListener("click", () => dlg.close());
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.target.closest("input, textarea") && !dlg.open) { e.preventDefault(); $("[data-open-search]").click(); }
  });

  // ---------- Open a FAQ answer when a link points at it ----------
  const openTarget = () => {
    const el = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    const details = el?.closest("details");
    if (details) { details.open = true; details.querySelector("summary").focus(); }
  };
  addEventListener("hashchange", openTarget);
  openTarget();

  // ---------- Contact form ----------
  const form = $("#contact-form");
  if (form) {
    form.hidden = false; // hidden in the HTML so it can't be sent without this script
    const errorBox = $("#form-error");
    const success = $("#form-success");
    const emailText = $("#email-text").textContent.trim();
    const configured = emailText.includes("@") && !emailText.includes("{{");
    const fields = {
      name: { el: $("#c-name"), check: (v) => (v.trim() ? "" : "Enter your name.") },
      email: { el: $("#c-email"), check: (v) => (!v.trim() ? "Enter your email address." : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? "" : "Enter an email address like name@example.com.") },
      message: { el: $("#c-message"), check: (v) => (v.trim().length >= 5 ? "" : "Write a message of at least 5 characters.") },
      consent: { el: $("#c-consent"), check: (_, el) => (el.checked ? "" : "Tick the box to agree to how we'll use your details.") },
    };
    const showFieldError = (f, msg) => {
      const err = document.getElementById(f.el.id + "-err");
      f.el.setAttribute("aria-invalid", msg ? "true" : "false");
      err.textContent = msg; err.hidden = !msg;
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const problems = [];
      for (const f of Object.values(fields)) {
        const msg = f.check(f.el.value, f.el);
        showFieldError(f, msg);
        if (msg) problems.push({ id: f.el.id, msg });
      }
      if (problems.length) {
        errorBox.innerHTML = `<h2>Please fix ${problems.length === 1 ? "this" : `these ${problems.length}`} before sending</h2><ul>${problems.map((p) => `<li><a href="#${p.id}">${esc(p.msg)}</a></li>`).join("")}</ul>`;
        errorBox.hidden = false; errorBox.focus();
        return;
      }
      if (!configured) {
        errorBox.innerHTML = `<h2>The contact form isn't set up yet</h2><p>The site owner hasn't added a contact email address. Your message hasn't been sent.</p>`;
        errorBox.hidden = false; errorBox.focus();
        return;
      }
      errorBox.hidden = true;
      const subject = `SouthHop message from ${fields.name.el.value.trim()}`;
      const body = `${fields.message.el.value.trim()}\n\nFrom: ${fields.name.el.value.trim()} <${fields.email.el.value.trim()}>`;
      location.href = `mailto:${emailText}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      form.hidden = true; success.hidden = false; success.focus();
    });
    errorBox.addEventListener("click", (e) => {
      const a = e.target.closest("a[href^='#']");
      if (a) { e.preventDefault(); document.getElementById(a.getAttribute("href").slice(1)).focus(); }
    });
    for (const f of Object.values(fields)) {
      // Re-check while typing (not on blur), so the layout doesn't shift under a click on the send button.
      f.el.addEventListener(f.el.type === "checkbox" ? "change" : "input", () => {
        if (f.el.getAttribute("aria-invalid") === "true") showFieldError(f, f.check(f.el.value, f.el));
      });
    }
    $("#form-again").addEventListener("click", () => {
      form.reset(); form.hidden = false; success.hidden = true; fields.message.el.focus();
    });
  }
})();
