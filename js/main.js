// Page wiring: hero + course scenes, sizes, parts list, small live visuals.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
// Reduced-motion visitors get still frames and a Play button; their choice is remembered on this device.
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
window.RL_MOTION = { on: !REDUCED.matches || store.get("rl-motion") === "on" };
function setMotion(on, save) {
  window.RL_MOTION.on = on;
  if (save) store.set("rl-motion", on ? "on" : "off");
  document.documentElement.classList.toggle("motion-on", on);
  $$(".motion-btn").forEach((b) => { b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "Pause animation" : "Play animation"; });
  dispatchEvent(new Event("rl-motion"));
}
const syncMotion = () => { $$(".motion-btn").forEach((b) => (b.hidden = !REDUCED.matches)); setMotion(!REDUCED.matches || store.get("rl-motion") === "on"); };
$$(".motion-btn").forEach((b) => (b.onclick = () => setMotion(!window.RL_MOTION.on, true)));
REDUCED.addEventListener?.("change", syncMotion);
syncMotion();
const PACK = "assets/ring16.bin";
const SIZES = window.RL_SIZES || [];
const Sim = window.RingSim;

// ---------------------------------------------------------------- firmware version + nav
$$(".fw-ver").forEach((e) => (e.textContent = window.RL_FW || "2.9"));
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("solid", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
const secs = ["features", "app", "sizes", "parts", "build", "downloads"].map((id) => document.getElementById(id));
const navIO = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) $$(".nav nav a").forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
}), { rootMargin: "-45% 0px -50% 0px" });
secs.forEach((s) => s && navIO.observe(s));

// ---------------------------------------------------------------- reveal on scroll
const rv = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rv.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
$$(".reveal").forEach((e) => rv.observe(e));

// ---------------------------------------------------------------- live accent colour (follows the hero ring)
const root = document.documentElement;
let acc = [77, 163, 255];
function setAccent(c) {
  let r = c.r, g = c.g, b = c.b;
  const m = Math.max(r, g, b);
  if (m < 0.02) return;
  r /= m; g /= m; b /= m;                                   // full brightness, keep the hue
  const lift = 0.18;                                         // keep it readable on black
  const t = [r, g, b].map((v) => Math.round(255 * (lift + (1 - lift) * v)));
  acc = acc.map((v, i) => Math.round(v + (t[i] - v) * 0.35));
  root.style.setProperty("--glow", `rgb(${acc.join(" ")})`);
  root.style.setProperty("--glow-soft", `rgb(${acc.join(" ")} / 0.16)`);
}

// ---------------------------------------------------------------- hero scroll progress
const heroWrap = $("#hero");
let heroP = 0;
function heroProgress() {
  if (REDUCED.matches) return 0;
  const r = heroWrap.getBoundingClientRect(), span = r.height - innerHeight;
  heroP = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  return heroP;
}
function heroCss() {
  const p = heroProgress();
  heroWrap.style.setProperty("--p", p.toFixed(4));
  heroWrap.style.setProperty("--cap", Math.max(0, 1 - Math.abs(p - 0.62) * 5.5).toFixed(3));
}
addEventListener("scroll", heroCss, { passive: true });
heroCss();

// ---------------------------------------------------------------- 3D scenes
const fleet = (window.RL_FLEET = new Sim.Fleet());
setInterval(() => fleet.step(), 200);                       // keeps race timers going while the course is off screen
let webgl = true;
try { const c = document.createElement("canvas"); webgl = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { webgl = false; }
if (!webgl) root.classList.add("no-webgl");
else {
  import("./ring3d.js").then(({ initHero, initCourse }) => {
    initHero($("#hero-canvas"), { packUrl: PACK, onColor: setAccent, progress: heroProgress }).catch(fail);
    const cc = $("#course-canvas");
    // build the course when it first gets near the screen
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      initCourse(cc, { packUrl: PACK, fleet, autoNext: () => $("#auto-next").checked }).catch(fail);
    }, { rootMargin: "600px" });
    io.observe(cc);
  }).catch(fail);
}
function fail(e) { console.warn("3D view unavailable:", e); root.classList.add("no-webgl"); }

// ---------------------------------------------------------------- race card: gates light up in turn
(function raceViz() {
  const box = $(".race-viz"), gates = $$("i", box);
  let k = -1;
  const step = () => {
    k = (k + 1) % 8;
    box.classList.toggle("finish", k >= 5);
    gates.forEach((g, i) => { g.classList.toggle("next", i === k); g.classList.toggle("done", i < k && k < 5); });
  };
  step();
  setInterval(() => { if (window.RL_MOTION.on) step(); }, 900);
})();

// ---------------------------------------------------------------- effects card: a strip running the real effects
(function fxStrip() {
  const cv = $("#fx-canvas"), ctx = cv.getContext("2d"), name = $("#fx-name");
  const FX = [[10, "00e5ff", "001020", "000000"], [16, "00e5ff", "001020", "000000"], [21, "00ff90", "001010", "000000"], [2, "ff0000", "000000", "000000"],
    [17, "ff0000", "0028ff", "000000"], [19, "ff00c8", "00e5ff", "000000"], [4, "00b0ff", "000000", "000000"], [8, "ff3000", "000000", "000000"]];
  const N = 5, per = 14;
  const rings = Array.from({ length: N }, (_, i) => Sim.makeRing({ leds: per, order: i + 1 }));
  const show = { power: 1, effect: 10, bri: 255, speed: 128, intensity: 128, c: [], mode: 0, numbers: 0, rc: [] };
  let fi = 0, t = 0, sT = 0, vis = false, last = 0;
  const pick = (i) => { fi = i % FX.length; const f = FX[fi]; show.effect = f[0]; show.c = f.slice(1).map(Sim.hex); name.textContent = Sim.EFFECT_NAMES[f[0]] + (Sim.EFFECT_NAMES[f[0]].startsWith("Course") || [16, 17, 21].includes(f[0]) ? "  ⇢ runs down the course" : ""); };
  pick(0);
  function size() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); cv.width = r.width * d; cv.height = r.height * d; }
  function draw(dt) {
    t += dt; sT += dt;
    const W = cv.width, H = cv.height, gw = W / N, rad = Math.min(gw * 0.36, H * 0.38);
    ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#0b0d11"; ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    rings.forEach((r, gi) => {
      const out = Sim.frame(r, { show, race: {}, t, dt, N, speedT: sT });
      const cx = gw * (gi + 0.5), cy = H / 2;
      for (let i = 0; i < per; i++) {
        const a = Math.PI / 2 + (i / per) * Math.PI * 2, x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
        const R = out[i * 3], G = out[i * 3 + 1], B = out[i * 3 + 2];
        if (R + G + B < 6) { ctx.fillStyle = "rgba(255,255,255,0.05)"; ctx.beginPath(); ctx.arc(x, y, rad * 0.07, 0, 7); ctx.fill(); continue; }
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad * 0.32);
        g.addColorStop(0, `rgba(${R},${G},${B},0.9)`); g.addColorStop(0.25, `rgba(${R},${G},${B},0.35)`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad * 0.32, 0, 7); ctx.fill();
      }
    });
  }
  const tick = (now) => { if (!vis || !window.RL_MOTION.on) return; const dt = last ? Math.min(50, now - last) : 16; last = now; draw(dt); requestAnimationFrame(tick); };
  const kick = () => { if (!vis) return; size(); last = 0; if (!window.RL_MOTION.on) { t = sT = 2600; draw(0); } else requestAnimationFrame(tick); };
  new IntersectionObserver((e) => { vis = e[0].isIntersecting; kick(); }).observe(cv);
  addEventListener("rl-motion", kick);
  addEventListener("resize", () => { size(); if (!window.RL_MOTION.on) draw(0); });
  setInterval(() => { if (vis && window.RL_MOTION.on) pick(fi + 1); }, 3200);
})();

// ---------------------------------------------------------------- sizes + parts
const fmt$ = (v) => "$" + (v < 10 ? v.toFixed(2) : v.toFixed(0));
const amazon = (asin) => `https://www.amazon.com/dp/${asin}`;
const amazonSearch = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q).replace(/%20/g, "+")}`;
const ali = (q) => `https://www.aliexpress.com/w/wholesale-${q.trim().split(/\s+/).map(encodeURIComponent).join("-")}.html`;
const m = (mm) => (mm / 1000).toFixed(2) + " m";

const PARTS = window.RL_PARTS || [];
const SMALL_N = 2, BULK_N = 20;   // rings the two tiers are priced for

let cur = SIZES.find((s) => s.in === 16) || SIZES[0];
const picker = $("#size-picker");
SIZES.forEach((s) => {
  const b = document.createElement("button");
  b.type = "button"; b.setAttribute("role", "radio"); b.textContent = s.in + " in"; b.dataset.in = s.in;
  b.onclick = () => select(s);
  picker.appendChild(b);
});
picker.addEventListener("keydown", (e) => {
  const i = SIZES.indexOf(cur), d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
  if (!d) return;
  e.preventDefault();
  select(SIZES[(i + d + SIZES.length) % SIZES.length]);
  $(`button[data-in="${cur.in}"]`, picker).focus();
});
$("#size-table tbody").innerHTML = SIZES.map((s) => `<tr data-in="${s.in}"><td>${s.in} in</td><td>${s.parts} + cover</td><td>${s.leds}</td><td>${m(s.strip_mm)}</td><td>${s.grams} g</td><td>${s.bed} mm</td><td>${s.hoop_mm ? m(s.hoop_mm) : "–"}</td></tr>`).join("");
$$("#size-table tbody tr").forEach((tr) => { tr.style.cursor = "pointer"; tr.onclick = () => select(SIZES.find((s) => s.in === +tr.dataset.in)); });

function ringSvg(s) {
  const max = 24, R = 150 * (s.in / max) + 18, n = s.leds, cy = 165;
  let dots = "";
  for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i + 0.5) / n * Math.PI * 2; dots += `<circle cx="${(180 + Math.cos(a) * R).toFixed(1)}" cy="${(cy + Math.sin(a) * R).toFixed(1)}" r="2.2"/>`; }
  return `<svg viewBox="0 0 360 340" aria-hidden="true"><circle cx="180" cy="${cy}" r="${R}" fill="none" stroke="var(--glow)" stroke-opacity=".22" stroke-width="16"/>
    <g fill="var(--glow)" style="filter:drop-shadow(0 0 4px var(--glow))">${dots}</g>
    <rect x="160" y="${cy + R - 4}" width="40" height="22" rx="5" fill="#12151b" stroke="rgba(255,255,255,.18)"/>
    <text x="180" y="${cy + 6}" text-anchor="middle" fill="var(--tx)" font-family="Geist, sans-serif" font-weight="600" font-size="44" letter-spacing="-2">${s.in}″</text>
    <text x="180" y="${cy + 30}" text-anchor="middle" fill="var(--mut)" font-family="Geist Mono, monospace" font-size="12">${Math.round(s.in * 25.4)} mm</text></svg>`;
}
const mb = (kb) => (kb > 1024 ? (kb / 1024).toFixed(1) + " MB" : kb + " KB");
function select(s) {
  cur = s;
  $$("button", picker).forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.in === s.in)));
  $$("#size-table tbody tr").forEach((tr) => tr.classList.toggle("sel", +tr.dataset.in === s.in));
  $("#size-card").innerHTML = `<div class="size-vis">${ringSvg(s)}</div>
    <dl class="size-stats">
      <div class="stat"><dt>LEDs</dt><dd>${s.leds}</dd></div>
      <div class="stat"><dt>Printed parts</dt><dd>${s.parts}<small>+ cover</small></dd></div>
      <div class="stat"><dt>Clear TPU</dt><dd>${s.grams}<small>g</small></dd></div>
      <div class="stat"><dt>Strip</dt><dd>${(s.strip_mm / 1000).toFixed(2)}<small>m</small></dd></div>
      <div class="stat"><dt>Bed needed</dt><dd>${s.bed}<small>mm</small></dd></div>
      <div class="stat"><dt>Steel hoop</dt><dd>${s.hoop_mm ? "Yes" : "No"}<small>${s.hoop_mm ? m(s.hoop_mm) : ""}</small></dd></div>
      <div class="cta"><a class="btn btn-light" href="${s.zip}" download>Download ${s.in} in STLs <span aria-hidden="true">↓</span></a><span class="mute small" style="align-self:center">${s.files.length} files · ${mb(s.zip_kb)} zip</span></div>
    </dl>`;
  $$(".size-label").forEach((e) => (e.textContent = s.in + " in"));
  $$(".bed-label").forEach((e) => (e.textContent = s.bed + " mm"));
  $$(".leds-label").forEach((e) => (e.textContent = s.leds));
  $$(".pins-label").forEach((e) => (e.textContent = s.parts));
  $$(".hoop-only").forEach((e) => (e.hidden = !s.hoop_mm));
  renderParts(s);
  $("#dl-stl").innerHTML = `<p class="kicker">STL files · ${s.in} in</p><h3>Print files</h3>
    <p>Pick another size above to switch.</p>
    <ul class="files">${s.files.map((f) => `<li><a href="${f.path}" download>${f.file}</a><span>${f.bed[0]} × ${f.bed[1]} mm · ${mb(f.kb)}</span></li>`).join("")}</ul>
    <div class="cta"><a class="btn btn-light" href="${s.zip}" download>All ${s.in} in files (.zip) <span aria-hidden="true">↓</span></a></div>`;
}
// what an offer costs for n rings: whole packs, bulk price tiers, and shipping when it isn't free
function offerCost(o, p, s, n) {
  if (o.price == null) return null;
  const need = n * p.need(s);
  if (!need) return 0;
  let packs = Math.ceil(need / o.units - 1e-9), unit = o.price;
  if (o.tiers) for (const [q, v] of o.tiers) if (packs >= q) unit = v;
  let total = packs * unit;
  if (o.ship && total < o.ship.freeOver) total += o.ship.flat;
  return total;
}
const STORE = { amz: "Amazon", ali: "AliExpress", shop: "" };
function offerHtml(o, p, s, n, best) {
  const c = offerCost(o, p, s, n);
  const per = c == null ? "" : `<span class="per">${fmt$(c / n)}<small>/ring</small></span>`;
  const price = o.price == null ? '<span class="pp mute">search</span>' : `<span class="pp">$${o.price.toFixed(2)}${o.tiers ? " ea" : ""}</span>`;
  const extra = [o.pick && `pick: ${o.pick}`, o.note].filter(Boolean).join(" · ");
  return `<a class="offer ${o.s}${best ? " best" : ""}" href="${o.url}" target="_blank" rel="noopener nofollow">
    <span class="st">${o.store || STORE[o.s]}</span><span class="what">${o.what}${extra ? `<small>${extra}</small>` : ""}</span>
    ${price}${per}${best ? '<span class="badge">Best deal</span>' : ""}</a>`;
}
function tierHtml(list, p, s, n) {
  if (!list.length) return '<p class="none">–</p>';
  let bi = -1, bv = Infinity;
  list.forEach((o, i) => { const c = offerCost(o, p, s, n); if (c != null && c < bv - 1e-9) { bv = c; bi = i; } });
  const multi = list.filter((o) => o.price != null).length > 1;
  return list.map((o, i) => offerHtml(o, p, s, n, multi && i === bi)).join("");
}
function bestCost(list, p, s, n) {
  const v = list.map((o) => offerCost(o, p, s, n)).filter((c) => c != null);
  return v.length ? Math.min(...v) : 0;
}
function renderParts(s) {
  let small = 0, bulk = 0;
  const rows = PARTS.map((p) => {
    const na = p.hoop && !s.hoop_mm;
    if (!na && !p.optional) { small += bestCost(p.small, p, s, SMALL_N); bulk += bestCost(p.bulk.length ? p.bulk : p.small, p, s, BULK_N) / BULK_N; }
    return `<div class="part2${na ? " na" : ""}">
      <div class="p-info"><h4>${p.name}${p.optional ? '<span class="opt">optional</span>' : ""}</h4>
        <p class="qty">${p.qty(s)} per ring</p>${p.note ? `<p class="p-note">${p.note}</p>` : ""}</div>
      <div class="tier"><p class="tier-h">1–2 rings</p>${na ? '<p class="none">not needed at this size</p>' : tierHtml(p.small, p, s, SMALL_N)}</div>
      <div class="tier"><p class="tier-h">8–50 rings</p>${na ? '<p class="none">not needed at this size</p>' : tierHtml(p.bulk, p, s, BULK_N)}</div>
    </div>`;
  });
  const C = window.RL_PRICES_CHECKED || {};
  $("#parts-list").innerHTML = `<div class="part2 head"><span>Part</span><span>Small packs · per ring when building ${SMALL_N}</span><span>Bulk · per ring when building ${BULK_N}</span></div>` + rows.join("");
  $("#cost").innerHTML = `<div><dt>Build ${SMALL_N} rings (${s.in} in)</dt><dd>≈ ${fmt$(small)} <small>${fmt$(small / SMALL_N)} per ring, cheapest small packs</small></dd></div>
    <div><dt>Build ${BULK_N}+ rings</dt><dd>≈ ${fmt$(bulk)} <small>per ring, cheapest bulk options</small></dd></div>`;
  $("#prices-checked").textContent = `AliExpress and 18650BatteryStore prices checked ${C.ali} (US store, shipping to the US); Amazon prices from price trackers, ${C.amz}. Prices move, so check before you order.`;
}
if (cur) select(cur);

// ---------------------------------------------------------------- build photos: drop img/build/<name>.jpg in and it appears
$$("#assembly li").forEach((li) => {
  const f = document.createElement("figure");
  f.className = "ph"; f.dataset.src = li.dataset.src;
  f.innerHTML = `<figcaption>Photo · ${li.dataset.src.split("/").pop()}</figcaption>`;
  li.prepend(f);
});
$$(".ph[data-src]").forEach((f) => {
  const img = new Image();
  img.onload = () => { img.alt = f.textContent.trim(); f.prepend(img); f.classList.add("has"); };
  img.src = f.dataset.src;
  img.loading = "lazy";
  img.decoding = "async";
});
