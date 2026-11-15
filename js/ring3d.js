// WebGL scenes: the real 16 in ring (CadQuery mesh), its LEDs driven by the firmware effects, and a drone.
import * as THREE from "../vendor/three.module.min.js";

export const REDUCED = matchMedia("(prefers-reduced-motion: reduce)");
// motion is on unless the visitor asked for reduced motion and hasn't pressed Play (main.js owns RL_MOTION)
const moving = () => (window.RL_MOTION ? window.RL_MOTION.on : !REDUCED.matches);
const COARSE = matchMedia("(pointer: coarse)").matches || innerWidth < 760;
const TAU = Math.PI * 2;
const BASE_BOTTOM = 223.5;          // mm from the strip-circle centre down to the base's underside

// ---------------------------------------------------------------- mesh pack (tools/build_site.py)
let packP = null;
export function loadPack(url) {
  packP ||= fetch(url).then((r) => { if (!r.ok) throw new Error("mesh " + r.status); return r.arrayBuffer(); }).then(parsePack);
  return packP;
}
function parsePack(buf) {
  const dv = new DataView(buf), td = new TextDecoder();
  if (td.decode(new Uint8Array(buf, 0, 4)) !== "RLM1") throw new Error("bad mesh pack");
  const n = dv.getUint32(4, true), radius = dv.getFloat32(8, true), parts = {};
  let o = 12;
  const pad = (k) => (4 - (k % 4)) % 4;
  for (let k = 0; k < n; k++) {
    const name = td.decode(new Uint8Array(buf, o, 12)).replace(/\0+$/, ""); o += 12;
    const nv = dv.getUint32(o, true), ni = dv.getUint32(o + 4, true), isz = dv.getUint8(o + 8); o += 12;
    const q = new Int16Array(buf.slice(o, o + nv * 6)); o += nv * 6 + pad(nv * 6);
    const idx = isz === 2 ? new Uint16Array(buf.slice(o, o + ni * 2)) : new Uint32Array(buf.slice(o, o + ni * 4));
    o += ni * isz + pad(ni * isz);
    const pos = new Float32Array(nv * 3);
    for (let i = 0; i < pos.length; i++) pos[i] = q[i] * 0.01;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    parts[name] = g;
  }
  return { parts, radius };
}

// ---------------------------------------------------------------- materials
const glassVS = `
varying vec3 vPos; varying vec3 vView;
void main(){ vPos = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vView = mv.xyz; gl_Position = projectionMatrix * mv; }`;
const glassFS = `
uniform sampler2D uLeds; uniform float uR; uniform float uGain; uniform float uFlash;
varying vec3 vPos; varying vec3 vView;
void main(){
  vec3 n = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 v = normalize(-vView);
  float ndv = abs(dot(n, v));
  float fres = pow(1.0 - ndv, 3.0);
  float u = fract((atan(vPos.y, vPos.x) + 1.5707963) / 6.2831853);
  vec3 led = pow(texture2D(uLeds, vec2(u, 0.5)).rgb, vec3(0.8));
  float rr = length(vPos.xy);
  float d = length(vec2(rr - uR, vPos.z));
  float core = exp(-d * d / 160.0);
  float body = exp(-d / 26.0);
  vec3 hot = mix(led, vec3(max(led.r, max(led.g, led.b))), 0.45 * core);
  vec3 col = (led * (0.025 + 0.2 * body + 0.28 * fres) + hot * 0.6 * core) * uGain;
  vec3 r = reflect(-v, n);
  float s1 = pow(max(dot(r, normalize(vec3(-0.45, 0.75, 0.5))), 0.0), 36.0);
  float s2 = pow(max(dot(r, normalize(vec3(0.7, 0.2, 0.7))), 0.0), 60.0);
  col += vec3(0.85, 0.9, 1.0) * (s1 * 0.5 + s2 * 0.3) + vec3(0.03, 0.035, 0.045) * (0.5 + fres * 3.0);
  col += vec3(uFlash) * (0.25 + core);
  gl_FragColor = vec4(col, 1.0);
}`;
const ptsVS = `
attribute vec3 color; varying vec3 vC; uniform float uSize; uniform float uPx;
void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = max(1.5, uSize * uPx / -mv.z); }`;
const ptsFS = `
varying vec3 vC; uniform float uI; uniform float uK;
void main(){ vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c) * uK); if (a < 0.004) discard; gl_FragColor = vec4(pow(vC, vec3(0.8)) * a * uI, 1.0); }`;

function glassMat(tex, R) {
  return new THREE.ShaderMaterial({
    uniforms: { uLeds: { value: tex }, uR: { value: R }, uGain: { value: 1 }, uFlash: { value: 0 } },
    vertexShader: glassVS, fragmentShader: glassFS,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}
function ptsMat(size, intensity, k) {
  return new THREE.ShaderMaterial({
    uniforms: { uSize: { value: size }, uPx: { value: 800 }, uI: { value: intensity }, uK: { value: k } },
    vertexShader: ptsVS, fragmentShader: ptsFS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
}
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5, metalness: 0.4, flatShading: true });
const metalMat = () => new THREE.MeshStandardMaterial({ color: 0x8a929c, roughness: 0.35, metalness: 0.85, flatShading: true });

// ---------------------------------------------------------------- one ring (glass body + LEDs)
function makeRing(pack, opts = {}) {
  const R = pack.radius - 3;
  const group = new THREE.Group();
  const obj = { group, n: 0, tex: null, mats: [], avg: new THREE.Color(0.2, 0.5, 1) };
  const body = new THREE.Mesh(pack.parts.body, glassMat(null, R));
  body.renderOrder = 2;
  const inner = ["strip", "cell", "chg", "esp", "res", "toggle", "nut"];
  for (const k of inner) if (pack.parts[k]) group.add(new THREE.Mesh(pack.parts[k], k === "nut" || k === "toggle" ? metalMat() : darkMat()));
  if (pack.parts.hoop && opts.hoop !== false) group.add(new THREE.Mesh(pack.parts.hoop, metalMat()));
  group.add(body);
  const core = ptsMat(10, 1.0, 9), halo = ptsMat(opts.halo || 95, opts.haloI || 0.06, 7);
  const pg = new THREE.BufferGeometry();
  const P1 = new THREE.Points(pg, core), P2 = new THREE.Points(pg, halo);
  P1.renderOrder = P2.renderOrder = 3;
  group.add(P1, P2);
  obj.mats = [core, halo];
  obj.body = body;
  let refl = null;
  if (opts.reflect) {                                 // glossy-floor reflection of the LEDs
    const rm = ptsMat(opts.halo || 95, 0.03, 6);
    refl = new THREE.Points(pg, rm);
    refl.scale.y = -1; refl.position.y = -2 * BASE_BOTTOM;
    group.add(refl);
    obj.mats.push(rm);
  }
  obj.setCount = (n) => {
    if (n === obj.n) return;
    obj.n = n;
    obj.data = new Uint8Array(n * 4);
    if (obj.tex) obj.tex.dispose();
    obj.tex = new THREE.DataTexture(obj.data, n, 1, THREE.RGBAFormat);
    obj.tex.magFilter = obj.tex.minFilter = THREE.LinearFilter;
    obj.tex.wrapS = THREE.RepeatWrapping;
    obj.tex.colorSpace = THREE.NoColorSpace;
    body.material.uniforms.uLeds.value = obj.tex;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + ((i + 0.5) / n) * TAU; pos[i * 3] = Math.cos(a) * (R - 1); pos[i * 3 + 1] = Math.sin(a) * (R - 1); pos[i * 3 + 2] = 0; }
    pg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.computeBoundingSphere();
  };
  obj.setColors = (out) => {           // out: Uint8 rgb * n
    const n = obj.n, d = obj.data, c = pg.attributes.color.array;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < n; i++) {
      const R8 = out[i * 3], G8 = out[i * 3 + 1], B8 = out[i * 3 + 2];
      d[i * 4] = R8; d[i * 4 + 1] = G8; d[i * 4 + 2] = B8; d[i * 4 + 3] = 255;
      c[i * 3] = R8 / 255; c[i * 3 + 1] = G8 / 255; c[i * 3 + 2] = B8 / 255;
      r += R8; g += G8; b += B8;
    }
    obj.tex.needsUpdate = true;
    pg.attributes.color.needsUpdate = true;
    obj.avg.setRGB(r / n / 255, g / n / 255, b / n / 255);
  };
  obj.setPx = (px) => obj.mats.forEach((m) => (m.uniforms.uPx.value = px));
  return obj;
}

// ---------------------------------------------------------------- drone (a small 3.5" freestyle quad, nose = +z)
function makeDrone() {
  const g = new THREE.Group(), body = new THREE.Group();
  g.add(body);
  const carbon = new THREE.MeshStandardMaterial({ color: 0x1b1f25, roughness: 0.55, metalness: 0.35, flatShading: true });
  const plate = new THREE.MeshStandardMaterial({ color: 0x262b33, roughness: 0.6, metalness: 0.2, flatShading: true });
  const bell = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.25, metalness: 0.95 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff5a1f, roughness: 0.45, metalness: 0.2, emissive: 0x3a1000 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); body.add(m); return m; };
  for (const a of [Math.PI / 4, -Math.PI / 4]) add(new THREE.BoxGeometry(150, 4, 11), carbon, 0, 0, 0, 0, a, 0);
  add(new THREE.BoxGeometry(32, 3, 70), carbon, 0, 0, 0);
  add(new THREE.BoxGeometry(30, 3, 66), carbon, 0, 22, 0);
  for (const [x, z] of [[-13, -26], [13, -26], [-13, 26], [13, 26]]) add(new THREE.CylinderGeometry(1.6, 1.6, 20, 6), bell, x, 11, z);
  add(new THREE.BoxGeometry(22, 12, 26), plate, 0, 9, -4);                      // stack
  add(new THREE.BoxGeometry(28, 20, 62), plate, 0, 35, -4);                     // LiPo
  add(new THREE.BoxGeometry(29, 21, 9), accent, 0, 35, -4);                     // strap
  const cam = new THREE.Group(); cam.position.set(0, 12, 30); cam.rotation.x = -0.45; body.add(cam);
  const camBox = new THREE.Mesh(new THREE.BoxGeometry(19, 19, 15), carbon); cam.add(camBox);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(6, 7.5, 9, 18), new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.1, metalness: 0.9 }));
  lens.rotation.x = Math.PI / 2; lens.position.z = 11; cam.add(lens);
  const glint = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), new THREE.MeshBasicMaterial({ color: 0x5d7cff }));
  glint.position.z = 15.6; cam.add(glint);
  add(new THREE.CylinderGeometry(1, 1, 46, 6), carbon, 0, 26, -44, -0.7, 0, 0);  // antenna
  const tail = add(new THREE.SphereGeometry(3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a3a }), 0, 6, -36);
  const props = [];
  const disc = new THREE.CircleGeometry(45, 40);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xd8e4ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide });
  const blade = new THREE.BoxGeometry(88, 1.2, 8);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, transparent: true, opacity: 0.55 });
  [[53, 53, 1], [-53, 53, -1], [53, -53, -1], [-53, -53, 1]].forEach(([x, z, dir]) => {
    add(new THREE.CylinderGeometry(10, 10, 6, 20), carbon, x, 4, z);
    add(new THREE.CylinderGeometry(10.5, 10.5, 9, 20), bell, x, 11, z);
    const d = add(disc, discMat, x, 17, z, -Math.PI / 2);
    const b = add(blade, bladeMat, x, 17, z);
    props.push({ b, dir });
  });
  return {
    group: g, tail,
    spin(t) { props.forEach((p, i) => (p.b.rotation.y = p.dir * t * 0.09 + i)); },
  };
}

// fly a drone along a closed curve; banks into turns and pitches nose-down like a real quad
function makeFlight(curve, speed, bankSpeed) {
  const L = curve.getLength(), T0 = new THREE.Vector3(), T1 = new THREE.Vector3(), up = new THREE.Vector3();
  const x = new THREE.Vector3(), y = new THREE.Vector3(), m = new THREE.Matrix4(), pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.32);
  const du = 0.004;
  return {
    L, u: 0,
    pose(obj, u) {
      u = ((u % 1) + 1) % 1;
      curve.getPointAt(u, obj.position);
      const f = curve.getTangentAt(u, new THREE.Vector3());
      curve.getTangentAt((u + du) % 1, T1);
      curve.getTangentAt((u - du + 1) % 1, T0);
      const kv = T1.sub(T0).multiplyScalar(1 / (2 * du * L));            // curvature vector (1/mm)
      up.set(0, 9810, 0).addScaledVector(kv, bankSpeed * bankSpeed);
      y.copy(up).addScaledVector(f, -up.dot(f)).normalize();
      x.crossVectors(y, f);
      m.makeBasis(x, y, f);
      obj.quaternion.setFromRotationMatrix(m).multiply(pitch);
    },
    advance(dt) { this.u = (this.u + (speed * dt) / L) % 1; return this.u; },
  };
}

function uNearest(curve, p, samples = 1500) {
  let best = 0, bd = Infinity;
  const v = new THREE.Vector3();
  for (let i = 0; i < samples; i++) { curve.getPointAt(i / samples, v); const d = v.distanceToSquared(p); if (d < bd) { bd = d; best = i / samples; } }
  return best;
}
const crossed = (a, b, u) => (a <= b ? u > a && u <= b : u > a || u <= b);

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: !COARSE, alpha: false, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, COARSE ? 1.5 : 2));
  r.setClearColor(0x060709, 1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  return r;
}
function lights(scene) {
  scene.add(new THREE.HemisphereLight(0xbcd2ff, 0x0b0c10, 1.1));
  const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(-600, 900, 700); scene.add(k);
  const pl = new THREE.PointLight(0x4488ff, 0, 900, 1.6); scene.add(pl);
  return pl;
}
function floor(scene, y, size, glowR) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCol: { value: new THREE.Color(0.2, 0.4, 1) }, uR: { value: glowR } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: `uniform vec3 uCol; uniform float uR; varying vec3 vW;
      void main(){ float d = length(vW.xz); vec2 g = abs(fract(vW.xz / 250.0 - 0.5) - 0.5) / fwidth(vW.xz / 250.0);
        float line = (1.0 - min(min(g.x, g.y), 1.0)) * 0.05 * exp(-d / 2600.0);
        vec3 c = uCol * 0.42 * exp(-d * d / (uR * uR)) + vec3(0.55, 0.65, 0.85) * line;
        gl_FragColor = vec4(c, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m);
  return mat;
}
// run fn(dt, t) only while the canvas is on screen and the tab is visible
function loop(canvas, fn, still) {
  let vis = false, raf = 0, last = 0;
  const tick = (now) => { raf = 0; if (!vis || document.hidden || !moving()) return; const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016; last = now; fn(dt, now / 1000); raf = requestAnimationFrame(tick); };
  const start = () => { if (!raf && vis && !document.hidden && moving()) { last = 0; raf = requestAnimationFrame(tick); } };
  const kick = () => { if (!vis) return; if (moving()) start(); else still(); };
  new IntersectionObserver((e) => { vis = e[0].isIntersecting; kick(); }, { rootMargin: "80px" }).observe(canvas);
  document.addEventListener("visibilitychange", start);
  addEventListener("rl-motion", kick);
  canvas.addEventListener("webglcontextrestored", () => setTimeout(kick, 50));
  return { start };
}
function fit(renderer, camera, canvas, objs) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const px = (renderer.getDrawingBufferSize(new THREE.Vector2()).y / 2) * camera.projectionMatrix.elements[5];
  objs.forEach((o) => o.setPx(px));
}

// ================================================================ HERO: one ring, a drone looping through it
export async function initHero(canvas, { packUrl, onColor, progress }) {
  const pack = await loadPack(packUrl);
  const Sim = window.RingSim;
  const renderer = makeRenderer(canvas), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 5, 30000);
  scene.fog = new THREE.FogExp2(0x060709, 0.00012);
  const pl = lights(scene);
  const ring = makeRing(pack, { reflect: true, halo: 110 });
  ring.setCount(71);
  scene.add(ring.group);
  const BACK = [[1350, -2300, -0.55], [2750, -4500, -0.6], [4000, -6900, -0.5]].map(([x, z, ry], i) => {
    const o = makeRing(pack, { reflect: true, halo: 110 });
    o.setCount(71); o.group.position.set(x, 0, z); o.group.rotation.y = ry; scene.add(o.group);
    return { o, r: Sim.makeRing({ leds: 71, order: i + 2 }) };
  });
  const fl = floor(scene, -BASE_BOTTOM, 14000, 520);
  const drone = makeDrone(); scene.add(drone.group);

  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  const curve = new THREE.CatmullRomCurve3([P(0, 0, -260), P(0, 0, 0), P(0, 0, 260), P(-60, 60, 700), P(-420, 230, 1150), P(-1150, 420, 650),
    P(-1350, 380, -450), P(-750, 200, -1250), P(-150, 60, -900)], true, "centripetal");
  const flight = makeFlight(curve, 1250, 2700);
  const uGate = uNearest(curve, P(0, 0, 0));

  // looks the hero cycles through: each pass through the gate moves to the next one
  const H = Sim.hex;
  const LOOKS = [
    { race: 1 },
    { effect: 1, c: ["ff0000", "000000", "000000"], speed: 150 },
    { effect: 11, c: ["ff00c8", "00e5ff", "000000"], speed: 140, intensity: 120 },
    { effect: 4, c: ["00b0ff", "001020", "000000"], speed: 170, intensity: 160 },
    { effect: 19, c: ["0050ff", "00e0b0", "000000"], speed: 140 },
    { effect: 8, c: ["ff3000", "000000", "000000"], speed: 128, intensity: 140 },
    { effect: 5, c: ["ff5a00", "ff0070", "000000"], speed: 150, intensity: 160 },
  ];
  const r = Sim.makeRing({ leds: 71, order: 1 });
  const show = { power: 1, effect: 1, bri: 255, speed: 128, intensity: 128, c: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], mode: 0, numbers: 0,
    rc: [H("0028ff"), H("00ff40"), H("0028ff")] };
  const race = { target: 1, go: 1, lap: 1, laps: 1 };
  let look = 0, flash = 0, speedT = 0;
  const setLook = (i) => {
    look = i % LOOKS.length; const L = LOOKS[look];
    show.mode = L.race ? 1 : 0; race.target = 1;
    if (!L.race) { show.effect = L.effect; show.c = L.c.map(H); show.speed = L.speed || 128; show.intensity = L.intensity || 128; }
  };
  setLook(moving() ? 0 : 1);

  const cam = { pos: P(0, 0, 0), tgt: P(0, 0, 0), mx: 0, my: 0, tx: 0, ty: 0 };
  const KEYS = [[0, P(-760, 170, 1650), P(30, -40, 0)], [0.55, P(-60, 30, 1150), P(0, 0, 0)], [1, P(150, 10, -700), P(1350, -20, -2300)]];
  const ease = (x) => x * x * (3 - 2 * x);
  function placeCamera(p) {
    let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++;
    const [a, pa, ta] = KEYS[i], [b, pb, tb] = KEYS[i + 1], k = ease(Math.min(1, Math.max(0, (p - a) / (b - a))));
    cam.pos.lerpVectors(pa, pb, k); cam.tgt.lerpVectors(ta, tb, k);
    cam.mx += (cam.tx - cam.mx) * 0.05; cam.my += (cam.ty - cam.my) * 0.05;
    const zoom = 1 + Math.max(0, 0.9 / camera.aspect - 1) * (1 - k * (i > 0 ? 1 : 0)) * (1 - p);
    camera.position.copy(cam.pos).sub(cam.tgt).multiplyScalar(zoom).add(cam.tgt).add(P(cam.mx * 90 * (1 - p), cam.my * 50 * (1 - p), 0));
    camera.lookAt(cam.tgt);
    // composition: ring to the right of the headline on wide screens, above it on tall ones; centred as we fly in
    const w = canvas.clientWidth, h = canvas.clientHeight, off = 1 - ease(Math.min(1, p * 1.8));
    if (w && h) camera.setViewOffset(w, h, camera.aspect > 1.15 ? -w * 0.2 * off : 0, camera.aspect > 1.15 ? 0 : h * 0.16 * off, w, h);
  }
  if (!COARSE) addEventListener("pointermove", (e) => { cam.tx = e.clientX / innerWidth - 0.5; cam.ty = 0.5 - e.clientY / innerHeight; }, { passive: true });

  let lastU = 0, tms = 0, colorT = 0;
  function frame(dt) {
    tms += dt * 1000;
    speedT += dt * 1000 * Math.pow(2, (show.speed - 128) / 42);
    const u = flight.advance(dt);
    if (crossed(lastU, u, uGate)) {
      if (show.mode) { race.target = 2; setTimeout(() => setLook(look + 1), 650); } else setLook(look + 1);
      flash = 1;
    }
    lastU = u;
    flight.pose(drone.group, u);
    drone.spin(tms);
    const env = { show, race, t: tms, dt: dt * 1000, N: 4, speedT };
    ring.setColors(Sim.frame(r, env));
    BACK.forEach((b) => b.o.setColors(Sim.frame(b.r, env)));
    flash *= Math.pow(0.02, dt);
    ring.body.material.uniforms.uFlash.value = flash * 0.5;
    fl.uniforms.uCol.value.copy(ring.avg);
    pl.color.copy(ring.avg); pl.intensity = 2.5e5 * (ring.avg.r + ring.avg.g + ring.avg.b + 0.1);
    pl.position.set(0, 0, 0);
    placeCamera(progress());
    renderer.render(scene, camera);
    colorT += dt;
    if (onColor && colorT > 0.12) { colorT = 0; onColor(ring.avg); }
  }
  function still() {               // reduced motion: one calm frame
    setLook(1);
    flight.pose(drone.group, uGate - 0.05);
    const env = { show, race, t: 4000, dt: 16, N: 4, speedT: 4000 };
    ring.setColors(Sim.frame(r, env));
    BACK.forEach((b) => b.o.setColors(Sim.frame(b.r, env)));
    fl.uniforms.uCol.value.copy(ring.avg);
    placeCamera(0);
    renderer.render(scene, camera);
    if (onColor) onColor(ring.avg);
  }
  const doFit = () => { fit(renderer, camera, canvas, [ring]); if (!moving()) still(); };
  new ResizeObserver(doFit).observe(canvas);
  doFit();
  loop(canvas, frame, still);
  return { renderer };
}

// ================================================================ COURSE: the demo's set of rings, live from the simulator
export async function initCourse(canvas, { packUrl, fleet, autoNext }) {
  const pack = await loadPack(packUrl);
  const Sim = window.RingSim;
  const renderer = makeRenderer(canvas), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(38, 1, 5, 40000);
  scene.fog = new THREE.FogExp2(0x060709, 0.00011);
  lights(scene);
  const fm = floor(scene, 0, 20000, 2600);
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  // the course runs diagonally away from the camera so every gate is seen at an angle; small slalom left/right
  const AX = P(0.8, 0, -0.6), PERP = P(0.6, 0, 0.8);
  const slots = [0, 1, 2, 3, 4].map((i) => AX.clone().multiplyScalar((i - 2) * 850).addScaledVector(PERP, i % 2 ? -260 : 260));
  const gates = fleet.rings.map((rg, i) => {
    const o = makeRing(pack, { halo: 100, haloI: 0.07, hoop: rg.size >= 16 });
    scene.add(o.group);
    return { o, rg, slot: slots[i] || P(i * 950 - 1900, 0, 0), size: 0 };
  });
  const drone = makeDrone(); drone.group.scale.setScalar(0.9); scene.add(drone.group);
  let curve, flight, gateU = [], lastU = 0;

  function layout() {
    gates.forEach((g, i) => {
      const s = g.rg.size / 16;
      g.size = g.rg.size;
      g.o.group.scale.setScalar(s);
      g.center = g.slot.clone().setY(BASE_BOTTOM * s);
      g.o.group.position.copy(g.center);
      const a = gates[Math.max(0, i - 1)].slot, b = gates[Math.min(gates.length - 1, i + 1)].slot;
      g.dir = b.clone().sub(a).setY(0).normalize();
      g.o.group.rotation.y = Math.atan2(g.dir.x, g.dir.z);
    });
    const pts = [];
    gates.forEach((g) => { pts.push(g.center.clone().addScaledVector(g.dir, -260), g.center.clone(), g.center.clone().addScaledVector(g.dir, 260)); });
    const at = (a, b, y) => AX.clone().multiplyScalar(a).addScaledVector(PERP, b).setY(y);
    pts.push(at(2600, 300, 380), at(2400, -1200, 560), at(0, -1500, 640), at(-2400, -1200, 560), at(-2600, 250, 380));
    curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
    const u = flight ? flight.u : 0;
    flight = makeFlight(curve, 1900, 2600); flight.u = u;
    gateU = gates.map((g) => uNearest(curve, g.center, 2000));
  }
  layout();

  let tms = 0, boost = 1;
  function frame(dt) {
    tms += dt * 1000;
    const env = fleet.step();
    if (gates.some((g) => g.size !== g.rg.size)) { layout(); aim(); }
    // racing: hurry to the green gate so the demo doesn't keep you waiting
    const R = env.race, tg = env.show.mode && R.target > 0 && R.target !== 254 ? gates.findIndex((g) => g.rg.order === R.target) : -1;
    const ahead = tg >= 0 ? (gateU[tg] - flight.u + 1) % 1 : 0;
    boost += ((ahead > 0.12 ? 2.4 : 1) - boost) * Math.min(1, dt * 3);
    const u = flight.advance(dt * boost);
    gates.forEach((g, i) => {
      if (crossed(lastU, u, gateU[i]) && autoNext() && env.show.mode && env.race.target && env.race.target !== 254 && env.race.target === g.rg.order) {
        fleet.raceAction("next"); fleet.changed();
      }
    });
    lastU = u;
    flight.pose(drone.group, u);
    drone.spin(tms);
    paint(env);
  }
  let avg = new THREE.Color();
  function paint(env) {
    avg.setRGB(0, 0, 0);
    gates.forEach((g) => { const out = Sim.frame(g.rg, env); g.o.setCount(g.rg.n); g.o.setColors(out); avg.add(g.o.avg); });
    fm.uniforms.uCol.value.copy(avg.multiplyScalar(0.14));
    renderer.render(scene, camera);
  }
  function still() { flight.pose(drone.group, gateU[2] - 0.02); paint(fleet.step()); }
  // frame every gate: step the camera back until all of them sit inside ~86 % of the view
  const viewDir = P(-0.22, 0.5, 1).normalize();
  function aim() {
    const c = P(0, 0, 0);
    gates.forEach((g) => c.add(g.center));
    c.divideScalar(gates.length);
    let D = 4000;
    for (let k = 0; k < 5; k++) {
      camera.position.copy(c).addScaledVector(viewDir, D);
      camera.lookAt(c);
      camera.updateMatrixWorld();
      let m = 0;
      gates.forEach((g) => {
        const r = (240 * g.rg.size) / 16;
        for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0]]) {
          const q = g.center.clone().add(P(dx, dy, 0)).project(camera);
          m = Math.max(m, Math.abs(q.x), Math.abs(q.y));
        }
      });
      D *= m / 0.86;
    }
  }
  const doFit = () => { fit(renderer, camera, canvas, gates.map((g) => g.o)); aim(); if (!moving()) still(); };
  new ResizeObserver(doFit).observe(canvas);
  doFit();
  // reduced motion: no flying drone, but the rings still follow what you tap in the app
  fleet.onChange(() => { if (!moving()) still(); });
  loop(canvas, frame, still);
  return { renderer };
}
