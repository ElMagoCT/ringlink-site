// Build guide page: size picker fills in the size-dependent numbers; photo slots fill in from img/build/.
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const SIZES = window.RL_SIZES || [];
  const m = (mm) => (mm / 1000).toFixed(2) + " m";
  const picker = $("#size-picker");
  let cur = SIZES.find((s) => s.in === 16) || SIZES[0];

  function select(s) {
    cur = s;
    $$("button", picker).forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.in === s.in)));
    $("#size-line").textContent = `${s.in} in · ${s.leds} LEDs · ${s.parts} parts + cover · ${s.grams} g TPU · bed ${s.bed} mm` + (s.hoop_mm ? ` · steel hoop ${m(s.hoop_mm)}` : "");
    $$(".leds-label").forEach((e) => (e.textContent = s.leds));
    $$(".parts-label").forEach((e) => (e.textContent = s.parts));
    $$(".pins-label").forEach((e) => (e.textContent = s.parts));
    $$(".bed-label").forEach((e) => (e.textContent = s.bed + " mm"));
    $$(".hoop-label").forEach((e) => (e.textContent = s.hoop_mm ? m(s.hoop_mm) : "–"));
    $$(".hoop-only").forEach((e) => (e.hidden = !s.hoop_mm));
  }
  SIZES.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.textContent = s.in + " in"; b.dataset.in = s.in;
    b.onclick = () => select(s);
    picker.appendChild(b);
  });
  picker.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    select(SIZES[(SIZES.indexOf(cur) + d + SIZES.length) % SIZES.length]);
    $(`button[data-in="${cur.in}"]`, picker).focus();
  });
  if (cur) select(cur);

  // build photos: drop img/build/<name>.jpg in and it appears in its slot
  $$("#assembly li").forEach((li) => {
    const f = document.createElement("figure");
    f.className = "ph"; f.dataset.src = li.dataset.src;
    f.innerHTML = `<figcaption>Photo · ${li.dataset.src.split("/").pop()}</figcaption>`;
    li.prepend(f);
  });
  $$(".ph[data-src]").forEach((f) => {
    const img = new Image();
    img.onload = () => { img.alt = f.textContent.trim(); f.prepend(img); f.classList.add("has"); };
    img.loading = "lazy"; img.decoding = "async";
    img.src = "../" + f.dataset.src;
  });
})();
