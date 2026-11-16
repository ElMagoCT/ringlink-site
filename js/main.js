// Page wiring: hero + course scenes, sizes, parts list, small live visuals.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
// The 3D views animate by default; the Pause button stops them, and that choice is remembered on this device.
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
window.RL_MOTION = { on: store.get("rl-motion") !== "off" };
function setMotion(on, save) {
  window.RL_MOTION.on = on;
  if (save) store.set("rl-motion", on ? "on" : "off");
  document.documentElement.classList.toggle("motion-on", on);
  $$(".motion-btn").forEach((b) => { b.setAttribute("aria-pressed", String(on)); b.querySelector("span").textContent = on ? "Pause animation" : "Play animation"; });
  dispatchEvent(new Event("rl-motion"));
}
const syncMotion = () => setMotion(store.get("rl-motion") !== "off");
$$(".motion-btn").forEach((b) => (b.onclick = () => setMotion(!window.RL_MOTION.on, true)));
REDUCED.addEventListener?.("change", syncMotion);
syncMotion();
const PACK = "assets/ring16.bin";
const Sim = window.RingSim;

// ---------------------------------------------------------------- firmware version + nav
$$(".fw-ver").forEach((e) => (e.textContent = window.RL_FW || "2.9"));
const nav = $("#nav");
const onScroll = () => nav.classList.toggle("solid", scrollY > 40);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
const secs = ["features", "app", "versions"].map((id) => document.getElementById(id));
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
  const r = heroWrap.getBoundingClientRect(), span = r.height - innerHeight;
  heroP = span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  return heroP;
}
function heroCss() {
  const p = heroProgress();
  heroWrap.style.setProperty("--p", p.toFixed(4));
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
  import("./ring3d.js").then(({ initHero, initCourse, initVersions }) => {
    initHero($("#hero-canvas"), { packUrl: PACK, onColor: setAccent, progress: heroProgress, onRace: raceHud }).catch(fail);
    const cc = $("#course-canvas");
    // build the course when it first gets near the screen
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      initCourse(cc, { packUrl: PACK, fleet, autoNext: () => $("#auto-next").checked }).catch(fail);
    }, { rootMargin: "600px" });
    io.observe(cc);
    // versions turntable: built when it gets near the screen, switched by the three cards
    const vc = $("#ver-canvas");
    const vio = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      vio.disconnect();
      initVersions(vc, { packs: { standard: PACK, sense: "assets/ring16-sense.bin", dumb: "assets/ring16-dumb.bin" } })
        .then((v) => { versions = v; }).catch(fail);
    }, { rootMargin: "500px" });
    vio.observe(vc);
  }).catch(fail);
}
// ---------------------------------------------------------------- hero race HUD: the app's race screen, clicking NEXT at each gate
const hud = $(".race-hud"), hudGates = $$(".rh-gates i"), hudNext = $(".rh-next"), pop = $(".click-pop");
hudGates.forEach((g, i) => (g.textContent = i + 1));
let hudKey = "";
function raceHud(e) {
  if (e.type === "click") {
    hudNext.classList.remove("press"); void hudNext.offsetWidth; hudNext.classList.add("press");
    clearTimeout(hudNext._t); hudNext._t = setTimeout(() => hudNext.classList.remove("press"), 420);
    if (e.at.x > 0 && e.at.x < 1 && e.at.y > 0 && e.at.y < 1) {
      pop.style.left = e.at.x * 100 + "%"; pop.style.top = e.at.y * 100 + "%";
      pop.classList.remove("go"); void pop.offsetWidth; pop.classList.add("go");
    }
    return;
  }
  const on = e.p > 0.045 && e.p < 0.995, fin = e.target === 254;
  // caption follows the race: before gate 1, after gates 1-2, after 3-4, finished
  const stage = fin ? 5 : e.passed >= 3 ? 3 : e.passed >= 1 ? 1 : 0;
  $$(".race-captions p").forEach((c) => c.classList.toggle("on", on && +c.dataset.s === stage));
  const key = [on, fin, e.passed, (e.time * 10) | 0].join();
  if (key === hudKey) return;
  hudKey = key;
  hud.classList.toggle("on", on);
  hud.classList.toggle("finish", fin);
  const s = Math.floor(e.time), t = Math.floor((e.time - s) * 10);
  $(".rh-time").textContent = `0:${String(s).padStart(2, "0")}.${t}`;
  $(".rh-state").textContent = fin ? "Finished!" : `Fly through gate ${e.target} of ${e.n}`;
  hudNext.firstChild.textContent = fin ? "FINISHED" : "NEXT ▸ ";
  hudNext.querySelector("b").textContent = fin ? "" : e.target < e.n ? e.target + 1 : "FINISH";
  hudGates.forEach((g, i) => { g.className = fin || i < e.passed ? "done" : i === e.passed ? "next" : ""; });
}
// ---------------------------------------------------------------- versions cards
let versions = null;
function pickVersion(b) {
  $$(".v-list button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
  $("#v-spec").textContent = b.dataset.spec;
  if (versions) versions.select(b.dataset.v);
}
$$(".v-list button").forEach((b) => (b.onclick = () => pickVersion(b)));
$("#v-spec").textContent = $(".v-list button").dataset.spec;
function fail(e) { console.warn("3D view unavailable:", e); root.classList.add("no-webgl"); }

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

