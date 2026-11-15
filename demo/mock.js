// Stands in for the rings: the control page's fetch('/api/...') calls go to a simulated set of rings.
// Inside the website the set lives in the parent page (window.RL_FLEET) so the 3D course shows every change.
(function () {
  "use strict";
  var standalone = true;
  try { standalone = !(window.parent !== window && window.parent.RL_FLEET); } catch (e) { standalone = true; }
  if (standalone) {
    document.write('<script src="../js/fw.js"><\/script><script src="../js/sim.js"><\/script>');
  }
  function fleet() {
    try { if (window.parent !== window && window.parent.RL_FLEET) return window.parent.RL_FLEET; } catch (e) {}
    if (!window.RL_FLEET) { window.RL_FLEET = new window.RingSim.Fleet(); setInterval(function () { window.RL_FLEET.step(); }, 50); }
    return window.RL_FLEET;
  }
  function parse(body) {
    var o = {};
    if (!body) return o;
    if (typeof body === "string") body = new URLSearchParams(body);
    if (body.forEach) body.forEach(function (v, k) { o[k] = v; });
    return o;
  }
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (url, opts) {
    var path = String(url).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (path.indexOf("/api/") !== 0) return realFetch(url, opts);
    opts = opts || {};
    var res = fleet().api((opts.method || "GET").toUpperCase(), path, parse(opts.body));
    return new Promise(function (ok) {
      setTimeout(function () { ok(new Response(JSON.stringify(res[1]), { status: res[0], headers: { "Content-Type": "application/json" } })); }, 25);
    });
  };
  // the firmware upload uses XMLHttpRequest: pretend to upload, then the rings "update" one by one
  var RealXHR = window.XMLHttpRequest;
  function FakeXHR() { this.upload = {}; this.status = 0; this.responseText = ""; }
  FakeXHR.prototype.open = function (m, url) { this._url = url; };
  FakeXHR.prototype.setRequestHeader = function () {};
  FakeXHR.prototype.send = function () {
    var self = this, p = 0;
    var tick = setInterval(function () {
      p = Math.min(1, p + 0.08);
      if (self.upload.onprogress) self.upload.onprogress({ lengthComputable: true, loaded: p, total: 1 });
      if (p >= 1) {
        clearInterval(tick);
        var res = fleet().api("POST", "/api/fw", {});
        self.status = res[0]; self.responseText = JSON.stringify(res[1]);
        if (self.onload) self.onload();
      }
    }, 90);
  };
  window.XMLHttpRequest = function () {
    var x = new RealXHR(), f = new FakeXHR(), use = null;
    return new Proxy({}, {
      get: function (_, k) {
        if (k === "open") return function (m, url) { use = String(url).indexOf("/api/") === 0 ? f : x; return use.open.apply(use, arguments); };
        var o = use || x, v = o[k];
        return typeof v === "function" ? v.bind(o) : v;
      },
      set: function (_, k, v) { (use || f)[k] = v; if (!use) x[k] = v; return true; },
    });
  };
  // the demo has no real firmware file to pick: let "Update all rings" run without one
  document.addEventListener("DOMContentLoaded", function () {
    var inp = document.getElementById("fwfile");
    if (inp) {
      try { Object.defineProperty(inp, "files", { get: function () { return [new File(["demo"], "RingLink_" + (window.RL_FW || (window.parent.RL_FW) || "2.9") + "_update.bin")]; } }); } catch (e) {}
    }
    document.documentElement.classList.add("rl-demo");
  });
})();
