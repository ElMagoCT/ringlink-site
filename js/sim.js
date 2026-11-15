// RingLink simulator: the firmware's effects (ported 1:1 from ringlink/src/main.cpp renderEffect / renderRace)
// plus a pretend set of rings that answers the control page's /api/* calls, so the real page runs in the demo.
(function () {
  "use strict";
  const SIN = new Uint8Array(256);
  for (let i = 0; i < 256; i++) SIN[i] = Math.round(127.5 + 127.5 * Math.sin((i * 2 * Math.PI) / 256));
  const sin8 = (x) => SIN[x & 255];
  const fl = Math.floor;
  const hex = (h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const toHex = (c) => c.map((v) => v.toString(16).padStart(2, "0")).join("");
  const BLACK = [0, 0, 0];

  function hsv(h, s, v, px, j) {
    h &= 255;
    const region = fl(h / 43), rem = (h - region * 43) * 6;
    const p = (v * (255 - s)) >> 8, q = (v * (255 - ((s * rem) >> 8))) >> 8, t = (v * (255 - ((s * (255 - rem)) >> 8))) >> 8;
    let r, g, b;
    switch (region) {
      case 0: r = v; g = t; b = p; break;
      case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break;
      case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break;
      default: r = v; g = p; b = q;
    }
    px[j] = r; px[j + 1] = g; px[j + 2] = b;
  }
  const setc = (px, j, c) => { px[j] = c[0]; px[j + 1] = c[1]; px[j + 2] = c[2]; };
  const mix = (px, j, a, b, t) => { for (let k = 0; k < 3; k++) px[j + k] = a[k] + Math.trunc(((b[k] - a[k]) * t) / 255); };
  const scale8 = (v, s) => (v * (s + 1)) >> 8;
  const scalec = (px, j, c, s) => { for (let k = 0; k < 3; k++) px[j + k] = scale8(c[k], s); };

  const EFFECT_NAMES = ["Solid", "Rainbow", "Course Rainbow", "Breathe", "Comet", "Twin Comets", "Theater", "Sparkle", "Fire", "Strobe",
    "Course Wave", "Spin Gradient", "Halves", "Confetti", "Wipe", "Heartbeat", "Relay", "Alternate", "Scanner", "Plasma", "Twinkle", "Ripple"];

  // ring: {px: Uint8Array(n*3), heat: Uint8Array(n), n, order}; show: {effect, intensity, c:[[r,g,b]x3]}; N = gates in the course
  function renderEffect(ring, show, S, dt, N) {
    const n = ring.n, px = ring.px, o = ring.order, inn = show.intensity;
    const C0 = show.c[0], C1 = show.c[1], C2 = show.c[2];
    N = Math.max(N, 1);
    S = Math.max(0, fl(S)) >>> 0;
    switch (show.effect) {
      default:
      case 0: for (let i = 0; i < n; i++) setc(px, i * 3, C0); break;
      case 1: for (let i = 0; i < n; i++) hsv(fl((i * 256) / n) + fl(S / 12), 255, 255, px, i * 3); break;
      case 2: { const h = (fl(S / 16) - o * (16 + fl(inn / 4))) & 255; for (let i = 0; i < n; i++) hsv(h + fl((i * 24) / n), 255, 255, px, i * 3); break; }
      case 3: { let l = sin8(fl(S / 14) - 64); l = fl((l * l) / 255); for (let i = 0; i < n; i++) mix(px, i * 3, C1, C0, l); break; }
      case 4: case 5: {
        const tail = 3 + fl((inn * n) / 400), head = fl((S * n) / 1600) % n;
        const c = [0, 0, 0];
        for (let i = 0; i < n; i++) {
          const d = (head - i + n) % n;
          if (d < tail) { let l = 255 - fl((d * 255) / tail); l = fl((l * l) / 255); mix(px, i * 3, C2, C0, l); } else setc(px, i * 3, C2);
          if (show.effect === 5) {
            const d2 = (i - ((n - head) % n) + n) % n;
            if (d2 < tail) { let l = 255 - fl((d2 * 255) / tail); l = fl((l * l) / 255); scalec(c, 0, C1, l); for (let k = 0; k < 3; k++) px[i * 3 + k] = Math.min(255, px[i * 3 + k] + c[k]); }
          }
        }
        break;
      }
      case 6: { const gap = 2 + fl(inn / 40), step = fl(S / 90); for (let i = 0; i < n; i++) setc(px, i * 3, (i + step) % gap === 0 ? C0 : C1); break; }
      case 7: case 13: {
        const fade = Math.min(60, Math.max(4, dt * 2));
        for (let j = 0; j < n * 3; j++) px[j] = px[j] > fade ? px[j] - fade : 0;
        const spawn = 1 + fl((inn * n) / 2000);
        for (let s = 0; s < spawn; s++) if (Math.random() * 100 < 40) {
          const i = fl(Math.random() * n);
          if (show.effect === 7) setc(px, i * 3, C0); else hsv(fl(Math.random() * 256), 220, 255, px, i * 3);
        }
        break;
      }
      case 8: {
        const heat = ring.heat;
        for (let i = 0; i < n; i++) {
          const target = 60 + fl(Math.random() * 196);
          heat[i] = heat[i] + Math.trunc(((target - heat[i]) * (40 + fl(inn / 4))) / 255);
          const h = heat[i], j = i * 3;
          if (h < 128) { px[j] = h * 2; px[j + 1] = fl(h / 8); px[j + 2] = 0; }
          else { px[j] = 255; px[j + 1] = Math.min(255, fl(((h - 128) * 3) / 2)); px[j + 2] = h > 220 ? Math.min(255, (h - 220) * 3) : 0; }
        }
        break;
      }
      case 9: { const period = 1100 - inn * 4, on = S % period < 40; for (let i = 0; i < n; i++) setc(px, i * 3, on ? C0 : C1); break; }
      case 10: {
        const span = (N + 2) * 1000, p = (S % span) / 1000, d = Math.abs(p - o);
        const l = d < 1 ? fl((1 - d) * 255) : 0;
        for (let i = 0; i < n; i++) mix(px, i * 3, C1, C0, l);
        break;
      }
      case 11: {
        const three = C2[0] | C2[1] | C2[2];
        for (let i = 0; i < n; i++) {
          const pos = ((fl((i * 768) / n) + fl(S / 6)) & 0xffff) % 768;
          if (three) {
            const seg = fl(pos / 256), t = pos % 256;
            const a = seg === 0 ? C0 : seg === 1 ? C1 : C2, b = seg === 0 ? C1 : seg === 1 ? C2 : C0;
            mix(px, i * 3, a, b, t);
          } else {
            let t = pos % 384; t = t < 192 ? fl((t * 255) / 192) : fl(((383 - t) * 255) / 192);
            mix(px, i * 3, C0, C1, t);
          }
        }
        break;
      }
      case 12: {
        const p = S % 600, swap = fl(S / 600) & 1, flick = p < 300 ? fl(p / 50) & 1 : 1;
        for (let i = 0; i < n; i++) { const a = (i < fl(n / 2) ? 1 : 0) ^ swap; setc(px, i * 3, flick ? (a ? C0 : C1) : a ? C1 : C0); }
        break;
      }
      case 14: {
        const k = fl((S * n) / 1500) % (2 * n);
        for (let i = 0; i < n; i++) setc(px, i * 3, k < n ? (i < k ? C0 : C1) : i < k - n ? C1 : C0);
        break;
      }
      case 15: {
        const p = S % 1300; let l = 0;
        if (p < 600) l = Math.exp(-p / 90);
        if (p >= 260) l = Math.max(l, 0.8 * Math.exp(-(p - 260) / 110));
        for (let i = 0; i < n; i++) mix(px, i * 3, C1, C0, fl(l * 255));
        break;
      }
      case 16: {
        const lapMs = 900, turn = (fl(S / lapMs) % N) + 1, head = fl(((S % lapMs) * n) / lapMs), tail = 4 + fl(n / 6);
        for (let i = 0; i < n; i++) {
          const d = (head - i + n) % n;
          if (o === turn && d < tail) mix(px, i * 3, C1, C0, 255 - fl((d * 255) / tail)); else setc(px, i * 3, C1);
        }
        break;
      }
      case 17: { const beat = fl(S / 700) & 1; for (let i = 0; i < n; i++) setc(px, i * 3, (o + beat) & 1 ? C0 : C1); break; }
      case 18: {
        const p = S % 2000, pos = p < 1000 ? p / 1000 : (2000 - p) / 1000, w = 0.06 + inn / 1500;
        for (let i = 0; i < n; i++) {
          const m = Math.min(i, n - i) / (n / 2), d = Math.abs(m - pos);
          mix(px, i * 3, C1, C0, d < w ? fl((1 - d / w) * 255) : 0);
        }
        break;
      }
      case 19: {
        for (let i = 0; i < n; i++) {
          const a = fl((i * 512) / n) & 255;
          const v = fl((sin8(a + fl(S / 9)) + sin8(a * 2 - fl(S / 13) + o * 40)) / 2);
          mix(px, i * 3, C0, C1, v);
        }
        break;
      }
      case 20: {
        for (let i = 0; i < n; i++) {
          const seed = (Math.imul(i, 2654435761) ^ Math.imul(o, 40503)) >>> 0;
          const ph = ((seed >>> 8) + fl(S / (8 + (seed & 7)))) & 255;
          let l = sin8(ph); l = l > 200 ? fl(((l - 200) * 255) / 55) : 0;
          mix(px, i * 3, C2, seed & 16 ? C0 : C1, l);
        }
        break;
      }
      case 21: {
        let l = sin8(fl(S / 8) - o * (20 + fl(inn / 3))); l = fl((l * l) / 255);
        for (let i = 0; i < n; i++) mix(px, i * 3, C1, C0, l);
        break;
      }
    }
  }

  const RACE_DONE = 254;
  function renderRace(ring, show, race, t) {
    const n = ring.n, px = ring.px, o = ring.order;
    if (race.target === RACE_DONE) { for (let i = 0; i < n; i++) hsv(fl((i * 256) / n) + fl(t / 3), 255, fl(t / 120) & 1 ? 255 : 160, px, i * 3); return; }
    if (race.target === 0 && race.go && race.go - t > 0) {
      const rem = race.go - t, on = rem <= 3000 && rem % 1000 > 500;
      for (let i = 0; i < n; i++) setc(px, i * 3, on ? [255, 0, 0] : rem > 3000 ? show.rc[0] : BLACK);
      return;
    }
    let col = show.rc[0], level = 255;
    if (o && race.target && o === race.target) { col = show.rc[1]; level = 170 + fl(sin8(fl(t / 4)) / 3); }
    else if (o && race.target && o < race.target) col = show.rc[2];
    else if (!o) level = 40;
    for (let i = 0; i < n; i++) scalec(px, i * 3, col, level);
  }

  // ---------------------------------------------------------------- one ring's frame (what main.cpp's loop does)
  function makeRing(o) {
    const r = Object.assign({ name: "Ring", order: 0, leds: 71, size: 16 }, o);
    r.n = r.leds; r.px = new Uint8Array(r.n * 3); r.heat = new Uint8Array(r.n); r.out = new Uint8Array(r.n * 3);
    return r;
  }
  function resize(r) { if (r.n !== r.leds) { r.n = r.leds; r.px = new Uint8Array(r.n * 3); r.heat = new Uint8Array(r.n); r.out = new Uint8Array(r.n * 3); } }

  // fills ring.out (brightness applied). env = {show, race, t, dt, N, speedT}
  function frame(r, env) {
    resize(r);
    const { show, race, t, dt, N } = env, n = r.n, px = r.px;
    let bri = show.bri;
    if (r.identUntil && r.identUntil > t) { const on = fl(t / 150) & 1; px.fill(on ? 255 : 0); bri = 200; }
    else if (r.ota) {                                                   // firmware update: fills up green
      const k = fl(n * Math.min(1, r.ota)); px.fill(0); for (let i = 0; i < k; i++) setc(px, i * 3, [0, 160, 40]); bri = 160;
    } else if (r.probeUntil && r.probeUntil > t) {                      // LED-count detection: white steps, then green
      const e = 6000 - (r.probeUntil - t); px.fill(0);
      if (e < 4000) { const k = Math.min(n, 8 * (1 + fl(e / 300))); for (let i = 0; i < k; i++) setc(px, i * 3, [120, 120, 120]); }
      else for (let i = 0; i < n; i++) setc(px, i * 3, [0, 90, 20]);
      bri = 255;
    } else if (show.numbers) {
      px.fill(0);
      const k = r.order || 1;
      for (let d = 0; d < k; d++) { const at = fl((d * n) / k); for (let w = 0; w < 3 && at + w < n; w++) setc(px, (at + w) * 3, r.order ? [255, 255, 255] : [255, 0, 0]); }
      bri = Math.max(bri, 120);
    } else if (!show.power) px.fill(0);
    else if (show.mode) renderRace(r, show, race, t);
    else renderEffect(r, show, env.speedT, dt, N);
    for (let j = 0; j < n * 3; j++) r.out[j] = (px[j] * bri) / 255;
    return r.out;
  }

  // ---------------------------------------------------------------- the pretend set of rings
  const LI = [[4200, 100], [4100, 92], [4000, 82], [3900, 70], [3800, 58], [3700, 43], [3600, 28], [3500, 17], [3400, 9], [3300, 4], [3200, 0]];
  const pct = (mv) => { for (let i = 0; i < LI.length - 1; i++) if (mv >= LI[i + 1][0]) { const [a, pa] = LI[i], [b, pb] = LI[i + 1]; return Math.round(pb + ((mv - b) * (pa - pb)) / (a - b)); } return 0; };

  class Fleet {
    constructor() {
      this.t0 = performance.now();
      this.show = { power: 1, effect: 10, bri: 170, speed: 128, intensity: 128, c: [hex("00e5ff"), hex("001020"), [0, 0, 0]], mode: 0, numbers: 0,
        warn: 3400, cut: 3200, tx: 34, rc: [hex("0028ff"), hex("00ff00"), hex("0028ff")] };
      this.race = { target: 0, lap: 1, laps: 2, go: 0, end: 0, splits: [] };
      this.pin = 1; this.ota = null; this.listeners = [];
      const R = [["Start", 16, 71, 4080, -58], ["Gate 2", 12, 52, 3990, -64], ["Dive", 18, 80, 3920, -71], ["Gate 4", 16, 71, 4010, -77], ["Finish", 24, 109, 3860, -83]];
      this.rings = R.map(([name, size, leds, mv, rssi], i) => makeRing({
        mac: "58cf79" + (0x3354 + i * 0x1b7).toString(16).padStart(6, "0"), name, size, leds, order: i + 1, mv, rssi,
        leader: i === 0, hops: i < 3 ? 0 : 1, lsrc: i === 2 ? 2 : 1, calib: 0, fw: window.RL_FW || "2.9",
      }));
      this.speedT = 0; this.last = 0;
    }
    now() { return performance.now() - this.t0; }
    N() { return this.rings.reduce((m, r) => Math.max(m, r.order), 0); }
    // advance the clocks; call once per animation frame
    step() {
      const t = this.now(), dt = this.last ? Math.min(100, t - this.last) : 16;
      this.last = t;
      this.speedT += dt * Math.pow(2, (this.show.speed - 128) / 42);
      const R = this.race;
      if (this.show.mode && R.target === 0 && R.go && t >= R.go) { R.target = 1; R.splits = []; R.lap = 1; }
      if (this.ota) this.otaStep(t);
      return { show: this.show, race: R, t, dt, N: this.N(), speedT: this.speedT };
    }
    onChange(fn) { this.listeners.push(fn); }
    changed() { this.listeners.forEach((f) => f(this)); }
    state() {
      const s = this.show, R = this.race, t = this.now();
      let el = 0;
      if (R.go) el = R.target === RACE_DONE ? R.end - R.go : t - R.go;
      return {
        me: this.rings[0].mac, fw: window.RL_FW || "2.9", pin: this.pin,
        show: { power: s.power, effect: s.effect, bri: s.bri, speed: s.speed, intensity: s.intensity, c: s.c.map(toHex), mode: s.mode,
          numbers: s.numbers, warn: s.warn, cut: s.cut, tx: s.tx, rc: s.rc.map(toHex) },
        race: { target: R.target, lap: R.lap, laps: R.laps, n: this.N(), elapsed: Math.round(el), splits: R.splits },
        rings: this.rings.map((r) => {
          const mv = Math.round(r.mv - (s.power ? 60 : 0) + Math.sin(t / 7000 + r.order) * 6);
          return { mac: r.mac, name: r.name, order: r.order, leds: r.leds, size: r.size, mv, batt: pct(mv), calib: r.calib, leader: r.leader ? 1 : 0,
            online: 1, me: r.leader ? 1 : 0, fw: r.fw, lsrc: r.lsrc, probe: r.lsrc === 1 ? r.leds : 0, rssi: r.leader ? 0 : r.rssi, hops: r.hops,
            bpct: r.leader ? 100 : 96 - r.hops * 4, nb: [] };
        }),
        ota: this.ota ? { state: 1, ver: this.ota.ver, msg: this.ota.msg, jobs: this.ota.jobs } : { state: 0, ver: "", msg: "", jobs: [] },
      };
    }
    raceAction(a) {
      const R = this.race, s = this.show, t = this.now(), N = this.N();
      if (a === "enter") { s.mode = 1; R.target = 0; R.go = 0; R.splits = []; R.lap = 1; }
      else if (a === "exit") { s.mode = 0; R.target = 0; R.go = 0; R.splits = []; R.lap = 1; }
      else if (a === "reset") { R.target = 0; R.go = 0; R.splits = []; R.lap = 1; }
      else if (a === "arm") { s.mode = 1; R.target = 0; R.go = t + 3600; R.splits = []; R.lap = 1; }
      else if (a === "next") {
        s.mode = 1;
        if (R.target === 0) { R.target = 1; R.go = t; R.splits = []; R.lap = 1; }
        else if (R.target !== RACE_DONE) {
          R.splits.push([R.target, R.lap, Math.round(t - R.go)]);
          if (R.target < N) R.target++;
          else if (R.lap < R.laps) { R.lap++; R.target = 1; }
          else { R.target = RACE_DONE; R.end = t; }
        }
      } else if (a === "back") {
        if (R.splits.length) { const x = R.splits.pop(); R.target = x[0]; R.lap = x[1]; }
        else if (R.target === 1) { R.target = 0; R.go = 0; }
      }
    }
    otaStep(t) {
      const O = this.ota, per = 2600;
      const k = Math.floor((t - O.t0) / per), f = ((t - O.t0) % per) / per;
      const order = O.order;
      order.forEach((r, i) => { O.jobs[i][1] = i < k ? 2 : i === k ? 1 : 0; r.ota = i === k ? f : 0; });
      if (k >= order.length) { order.forEach((r) => (r.ota = 0)); this.ota = null; this.changed(); }
      else O.msg = "Updating " + order[k].name + "...";
    }
    // the control page's HTTP API -> [status, json]
    api(method, path, body) {
      const p = body || {}, t = this.now(), s = this.show, num = (k, lo, hi) => Math.max(lo, Math.min(hi, parseInt(p[k], 10) || 0));
      switch (path) {
        case "/api/state": return [200, this.state()];
        case "/api/login": return [200, { ok: 1 }];
        case "/api/show":
          for (const k of ["power", "effect", "bri", "speed", "intensity", "mode", "numbers", "tx"]) if (k in p) s[k] = num(k, 0, 255);
          if ("warn" in p) s.warn = num("warn", 2800, 4200);
          if ("cut" in p) s.cut = num("cut", 2800, 4200);
          ["c0", "c1", "c2"].forEach((k, i) => { if (k in p && /^[0-9a-f]{6}$/i.test(p[k])) s.c[i] = hex(p[k]); });
          ["rc0", "rc1", "rc2"].forEach((k, i) => { if (k in p && /^[0-9a-f]{6}$/i.test(p[k])) s.rc[i] = hex(p[k]); });
          if (s.effect > 21) s.effect = 0;
          break;
        case "/api/race":
          if ("laps" in p) this.race.laps = num("laps", 1, 20);
          if (p.a) this.raceAction(p.a);
          break;
        case "/api/ring": {
          const r = this.rings.find((x) => x.mac === p.mac);
          if (!r) return [404, { ok: 0 }];
          if (p.name != null) r.name = String(p.name).slice(0, 15) || r.name;
          if (p.size != null && +p.size) { r.size = +p.size; }
          if (p.leds != null && +p.leds > 0) { r.leds = Math.min(150, +p.leds); r.lsrc = 2; }
          if (p.detect) { r.probeUntil = t + 6000; r.lsrc = 1; }
          if (p.calib != null) r.calib = +p.calib;
          break;
        }
        case "/api/order": {
          const macs = String(p.macs || "").split(",");
          this.rings.forEach((r) => { const i = macs.indexOf(r.mac); r.order = i >= 0 ? i + 1 : 0; });
          break;
        }
        case "/api/identify":
          this.rings.forEach((r) => { if (p.mac === "all" || r.mac === p.mac) r.identUntil = t + 1800; });
          break;
        case "/api/pin": this.pin = p.pin === "none" ? 0 : 1; break;
        case "/api/fw": {
          const order = this.rings.filter((r) => !r.leader).concat(this.rings.filter((r) => r.leader));
          this.ota = { t0: t, ver: this.rings[0].fw, msg: "Starting...", order, jobs: order.map((r) => [r.mac, 0]) };
          this.changed();
          return [200, { ok: 1, ver: this.rings[0].fw, rings: order.length }];
        }
        default: return [404, { ok: 0 }];
      }
      this.changed();
      return [200, this.state()];
    }
  }

  window.RingSim = { Fleet, makeRing, frame, renderEffect, EFFECT_NAMES, hex };
})();
