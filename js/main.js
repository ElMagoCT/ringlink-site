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

// Amazon picks + notes from v2/bom/make_bom_v2.py (ASINs found 2026-11-13). cost(s) = this part's share for one ring.
const PARTS = [
  { name: "Clear TPU filament", pick: "3DHoJor TPU 95A, 1.75 mm, 1 kg, Clear", asin: "B0DF2VLNPN", pack: "1 kg spool", price: 13.99,
    qty: (s) => `${s.grams} g`, cost: (s) => (s.grams * 1.1 / 1000) * 13.99, ali: "clear TPU filament 1.75mm",
    note: "Pick Clear, not the tinted colours. Usually $18–20 ($13.99 on sale). Our print profile is tuned for CC3D TPU 72D." },
  { name: "WS2812B LED strip", pick: "BTF-LIGHTING WS2812B ECO, 60 LED/m, IP30, black PCB, 5 m", asin: "B088BPGMXB", pack: "5 m reel", price: 13.99,
    qty: (s) => `${s.leds} LEDs · ${m(s.strip_mm)}`, cost: (s) => (s.strip_mm / 5000) * 13.99, ali: "WS2812B 60 LED IP30 5m black PCB",
    note: "Choose ECO, IP30, 60/m (about $14, not the $30 Pure Gold variant). Not IP65/IP67: the tunnel is 13 × 4 mm. 10 mm wide, 12 mm max." },
  { name: "ESP32-C3 SuperMini", pick: "Teyleten Robot ESP32-C3 SuperMini, 3 pcs", asin: "B0D47G24W3", pack: "3 pcs", price: 12.99,
    qty: () => "1", cost: () => 12.99 / 3, ali: "ESP32 C3 SuperMini", note: "The plain SuperMini, not the OLED or expansion-board versions." },
  { name: "USB-C charger + 5 V boost", pick: "Teyleten Robot IP5310 5 V 3.1 A boost / Type-C charge module, 5 pcs", asin: "B0GCVVL4V8", pack: "5 pcs", price: 9.99,
    qty: () => "1", cost: () => 9.99 / 5, ali: "IP5310 Type C 5V 3.1A boost charging module",
    note: "Check the photos show a KEY pad and 5V OUT pads.", alt: { asin: "B0BYMC7XBZ", label: "Fallback: ATNSINC IP5310" } },
  { name: "18650 Li-ion cell", pick: "Samsung 25R 2500 mAh flat top, 4-pack", asin: "B0BSLT62K6", pack: "4 cells", price: 46.49,
    qty: () => "1", cost: () => 46.49 / 4, ali: "18650 battery with solder tabs",
    note: "Use tabbed cells or spot-weld tabs; never solder to the can. Genuine Molicel P28A from a battery specialist is cheaper (about $7.50 each)." },
  { name: "Power toggle", pick: "VIBICCK mini toggle MTS-102, ON/ON, 3-pin, 15 pcs", search: "VIBICCK 15PCS Mini Toggle Switch ON/ON MTS-102 3Pin", pack: "15 pcs", price: 3.99,
    qty: () => "1", cost: () => 3.99 / 15, ali: "MTS 102 mini toggle switch 3 pin", note: "In the battery + lead. Off = battery disconnected, so charge with it on." },
  { name: "Battery-sense resistors", pick: "2 × 100 kΩ, ¼ W metal film", search: "100k ohm 1/4W metal film resistor 100pcs", pack: "100 pcs", price: 5.49,
    qty: () => "2", cost: () => 0.11, ali: "100K ohm metal film resistor", note: "Any equal pair from 10k to 220k works; 100k is ideal." },
  { name: "Data resistor", pick: "EDGELEC 330 Ω ¼ W metal film, 100 pcs", asin: "B07HDFFN81", pack: "100 pcs", price: 5.49,
    qty: () => "1", cost: () => 0.05, ali: "330 ohm metal film resistor", note: "In series between GPIO10 and the strip's DIN. Pick ¼ W, not ½ W." },
  { name: "Tripod T-nut", pick: "1/4\"-20 T-nut, 4-prong, zinc-plated steel, 5/16\" barrel, 50 pcs", asin: "B0D7HFBGW7", pack: "50 pcs", price: 5.99,
    qty: () => "1", cost: () => 5.99 / 50, ali: "T nut 4 prong 1 4 20 furniture", note: "Pick the 5/16\" barrel (not 7/16 or 9/16)." },
  { name: "Steel hoop wire", pick: "OOK solid steel utility wire, 9 gauge (3.8 mm), galvanized, 50 ft", asin: "B00KHIZR80", pack: "50 ft", price: 12.49, hoop: true,
    qty: (s) => (s.hoop_mm ? m(s.hoop_mm) : "not needed"), cost: (s) => (s.hoop_mm * 1.05 / 15240) * 12.49, ali: "9 gauge galvanized steel wire",
    note: "16 in and up. TPU alone sags at that size; the hoop keeps the ring round." },
  { name: "Silicone wire", pick: "BNTECHGO 22 AWG silicone wire, red + black, 10 ft each", asin: "B01C5DBKW6", pack: "2 × 10 ft", price: 7.48,
    qty: () => "~40 cm", cost: () => 0.25, ali: "22AWG silicone wire red black", note: "1.7 mm across, fits the wire passages. Use 20 AWG for the short battery leads if you have it." },
  { name: "Heat shrink", pick: "Ginsco 580 pcs 2:1 heat-shrink assortment", asin: "B01MFA3OFA", pack: "580 pcs", price: 6.99,
    qty: () => "a few", cost: () => 0.05, ali: "heat shrink tube assortment", note: "" },
  { name: "Wake button", optional: true, pick: "DAOKI 6 × 6 × 5 mm tact switch, 4-pin, 100 pcs", asin: "B01CGMP9GY", pack: "100 pcs", price: 5.49,
    qty: () => "0–1", cost: () => 0, ali: "6x6x5mm tactile push button 4 pin",
    note: "Only if your IP5310 doesn't start its 5 V by itself when the toggle turns on. Check the photos show 4 legs." },
  { name: "Joint pins", pick: "Any 1.75 mm filament offcut", pack: "–", price: 0, qty: (s) => `${s.parts} short pieces`, cost: () => 0, note: "One pins each joint between parts." },
];

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
function renderParts(s) {
  let ring = 0, packs = 0;
  const rows = PARTS.map((p) => {
    const na = p.hoop && !s.hoop_mm;
    const c = na ? 0 : p.cost(s);
    ring += c;
    if (!na && !p.optional && p.price) packs += p.price;
    const amz = p.asin ? amazon(p.asin) : p.search ? amazonSearch(p.search) : "";
    const buy = [amz && `<a class="amz" href="${amz}" target="_blank" rel="noopener nofollow">Amazon</a>`, p.ali && `<a class="ali" href="${ali(p.ali)}" target="_blank" rel="noopener nofollow">AliExpress</a>`].filter(Boolean).join("");
    const alt = p.alt ? ` <a href="${amazon(p.alt.asin)}" target="_blank" rel="noopener nofollow">${p.alt.label}</a>.` : "";
    return `<div class="part${na ? " na" : ""}">
      <h4>${p.name}${p.optional ? '<span class="opt">optional</span>' : ""}</h4>
      <div class="pick">${p.pick}${p.note || alt ? `<small>${p.note}${alt}</small>` : ""}</div>
      <div class="qty">${p.qty(s)}</div>
      <div class="price">${p.price ? fmt$(p.price) + `<small>${p.pack}</small>` : "–"}</div>
      <div class="buy">${buy}</div></div>`;
  });
  $("#parts-list").innerHTML = `<div class="part head"><span>Part</span><span>What to get</span><span>Per ring</span><span>≈ Pack</span><span></span></div>` + rows.join("");
  $("#cost").innerHTML = `<div><dt>Parts per ${s.in} in ring</dt><dd>≈ ${fmt$(ring)} <small>packs shared across rings</small></dd></div>
    <div><dt>Every pack, once</dt><dd>≈ ${fmt$(packs)} <small>enough for 3+ rings</small></dd></div>`;
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
