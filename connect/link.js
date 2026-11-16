// "Control the rings from this device": the rings' own control page (control.html), with its /api/ requests
// sent over USB (Web Serial) or Bluetooth (Web Bluetooth) to one ring, which hosts the controls for all of them.
// Wire format both ways is a text line:  @<id> <GET|POST|FW> <path|size> <form body>  ->  @<id> <status> <json>
(() => {
  const SVC = '6e0a0001-7a2f-4b6c-9d1e-52696e674c6b', RX = '6e0a0002-7a2f-4b6c-9d1e-52696e674c6b',
        TX = '6e0a0003-7a2f-4b6c-9d1e-52696e674c6b', FWC = '6e0a0004-7a2f-4b6c-9d1e-52696e674c6b';
  const realFetch = window.fetch.bind(window);
  const enc = new TextEncoder(), dec = new TextDecoder();
  const pending = new Map();
  let mode = null, nextId = 1, uploading = false, lastState = null, stateBusy = null;
  let port = null, writer = null, reader = null;          // USB
  let ble = null, bleChain = Promise.resolve();           // Bluetooth

  function handleLine(line) {
    const m = line.replace(/\r$/, '').match(/^@(\d+) (\d+) ?(.*)$/);
    if (!m || !pending.has(+m[1])) return;
    const cb = pending.get(+m[1]);
    pending.delete(+m[1]);
    cb(+m[2], m[3]);
  }
  function send(line) {
    if (mode === 'usb') return writer.write(enc.encode(line + '\n'));
    if (mode === 'ble') return (bleChain = bleChain.then(() => ble.rx.writeValueWithResponse(enc.encode(line))));
    return Promise.reject(new Error('not connected'));
  }
  function waitLine(id, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, ms);
      pending.set(id, (st, body) => { clearTimeout(t); resolve({ st, body }); });
    });
  }

  // ---- USB
  async function usbReadLoop() {
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      }
    } catch (e) {}
    if (mode === 'usb') disconnected('The ring was unplugged.');
  }
  async function connectUsb() {
    if (!('serial' in navigator)) return gate(true, "This browser can't use USB. Use Chrome or Edge on a computer.");
    try {
      const known = (await navigator.serial.getPorts()).filter(p => p.getInfo().usbVendorId === 0x303a);
      port = known.length === 1 ? known[0] : await navigator.serial.requestPort({ filters: [{ usbVendorId: 0x303a }] });
      await port.open({ baudRate: 115200 });
      try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) {}
      writer = port.writable.getWriter();
      reader = port.readable.getReader();
      mode = 'usb';
      usbReadLoop();
      connected();
    } catch (e) {
      port = null;
      gate(true, /open/i.test(e.message) ? 'That port is busy. Close other tabs or programs using the ring, then try again.' : (e.name === 'NotFoundError' ? 'No port picked.' : e.message));
    }
  }

  // ---- Bluetooth
  async function connectBle() {
    if (!navigator.bluetooth) return gate(true, "This browser can't use Bluetooth. Use Chrome or Edge (computer or Android); on iPhone use the free Bluefy browser.");
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [SVC] }] });
      gate(true, 'Connecting to ' + (dev.name || 'the ring') + '...');
      dev.addEventListener('gattserverdisconnected', () => { if (mode === 'ble') disconnected('Bluetooth disconnected.'); });
      const server = await dev.gatt.connect();
      const svc = await server.getPrimaryService(SVC);
      const rx = await svc.getCharacteristic(RX), tx = await svc.getCharacteristic(TX), fw = await svc.getCharacteristic(FWC);
      let buf = '';
      tx.addEventListener('characteristicvaluechanged', e => {
        buf += dec.decode(e.target.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) { handleLine(buf.slice(0, i)); buf = buf.slice(i + 1); }
      });
      await tx.startNotifications();
      ble = { dev, rx, fw };
      bleChain = Promise.resolve();
      mode = 'ble';
      connected();
    } catch (e) {
      ble = null;
      gate(true, e.name === 'NotFoundError' ? 'No ring picked.' : 'Bluetooth: ' + e.message);
    }
  }

  function connected() {
    gate(false);
    document.getElementById('sum').title = mode === 'ble' ? 'Connected over Bluetooth' : 'Connected over USB';
    fwCard();
    if (typeof poll === 'function') poll();
  }
  function disconnected(msg) {
    const was = mode;
    mode = null;
    if (was === 'usb') {
      try { reader && reader.releaseLock(); } catch (e) {}
      try { writer && writer.releaseLock(); } catch (e) {}
      if (port) port.close().catch(() => {});
      port = writer = reader = null;
    }
    if (was === 'ble' && ble) { try { ble.dev.gatt.disconnect(); } catch (e) {} ble = null; }
    for (const [, cb] of pending) cb(503, '{"err":"disconnected"}');
    pending.clear();
    uploading = false;
    gate(true, msg);
  }

  // The control page calls fetch('/api/...'): send it over the link instead.
  window.fetch = (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('/api/')) return realFetch(url, opts);
    if (!mode) return Promise.reject(new Error('not connected'));
    if (uploading && u.startsWith('/api/state') && lastState) return Promise.resolve(new Response(lastState, { status: 200 }));
    if (u.startsWith('/api/state') && stateBusy) return stateBusy.then(() => new Response(lastState || '{}', { status: lastState ? 200 : 503 }));   // one at a time
    const id = nextId++;
    const method = (opts.method || 'GET').toUpperCase();
    const body = opts.body ? String(opts.body).replace(/[\r\n]/g, '') : '';
    const wait = waitLine(id, 15000);
    send(`@${id} ${method} ${u} ${body}`).catch(() => {});
    if (u.startsWith('/api/state')) { stateBusy = wait.catch(() => {}); stateBusy.then(() => { stateBusy = null; }); }
    return wait.then(({ st, body: text }) => {
      if (st === 200 && text.startsWith('{"me"')) lastState = text;
      return new Response(text || '{}', { status: st >= 200 && st <= 599 ? st : 502, headers: { 'Content-Type': 'application/json' } });
    });
  };

  // ---- firmware: over Bluetooth the connected ring passes the file to the host, which updates every ring
  async function bleFirmware() {
    const f = document.getElementById('fwfile').files[0];
    const say = t => { try { toast(t); } catch (e) {} document.getElementById('fwmsg').textContent = t; };
    if (!f) return say('Pick RingLink_x.x_update.bin first');
    const data = new Uint8Array(await f.arrayBuffer());
    if (data[0] !== 0xE9 || data[32] !== 0x32 || data[33] !== 0x54 || data[34] !== 0xCD || data[35] !== 0xAB) return say("That's not an update file - use RingLink_x.x_update.bin");
    const bar = document.getElementById('fwbar'), fill = bar.firstElementChild;
    bar.style.display = 'block'; fill.style.width = '0';
    uploading = true;
    try {
      const id = nextId++;
      const ready = waitLine(id, 20000);
      await send(`@${id} FW ${data.length}`);
      const r1 = await ready;
      if (r1.st === 401) { uploading = false; lock(); return; }
      if (r1.st !== 100) throw new Error(JSON.parse(r1.body || '{}').msg || 'ring said ' + r1.st);
      const done = waitLine(id, 15 * 60000);
      let finished = false;
      done.then(() => { finished = true; }, () => { finished = true; });   // the ring answers early if it rejects the file
      const CH = 244, t0 = performance.now();   // one long Bluetooth packet each
      for (let off = 0; off < data.length && mode === 'ble' && !finished; off += CH) {
        // without waiting for each piece, but every 16th waits for an answer, so at most ~4 KB is in flight
        const piece = data.subarray(off, off + CH), sync = (off / CH) % 16 === 15 || !ble.fw.writeValueWithoutResponse;
        await (bleChain = bleChain.then(() => sync ? ble.fw.writeValueWithResponse(piece) : ble.fw.writeValueWithoutResponse(piece)));
        fill.style.width = (Math.min(1, (off + CH) / data.length) * 100).toFixed(1) + '%';
        if ((off / CH) % 40 === 0) {
          const kbs = (off / 1024) / ((performance.now() - t0) / 1000);
          document.getElementById('fwmsg').textContent = `Sending over Bluetooth... ${Math.round(off / data.length * 100)}% (${kbs.toFixed(1)} KB/s)`;
        }
      }
      const r2 = await done;
      const j = JSON.parse(r2.body || '{}');
      say(r2.st === 200 ? `Sent v${j.ver} - the rings are updating (${j.rings} ring${j.rings == 1 ? '' : 's'}). Bluetooth drops when this ring restarts.` : (j.msg || 'Update failed (' + r2.st + ')'));
    } catch (e) {
      say('Bluetooth update failed: ' + e.message);
    } finally { uploading = false; }
  }
  function fwCard() {
    const fw = document.getElementById('fwinfo'), file = document.getElementById('fwfile'), go = document.getElementById('fwgo');
    if (!fw || !file) return;
    const row = file.closest('.row');
    let note = document.getElementById('linknote');
    if (!note) { note = document.createElement('div'); note.id = 'linknote'; note.className = 'hint'; fw.closest('.card').appendChild(note); }
    if (mode === 'ble') {
      row.style.display = ''; fw.style.display = '';
      go.onclick = bleFirmware;
      note.textContent = 'Over Bluetooth the file goes to this ring, which updates every ring that is on (about a minute per 600 KB).';
    } else {
      row.style.display = 'none'; fw.style.display = 'none';
      note.innerHTML = 'Over USB, update this ring with the Install button on the <a href="../flash/" style="color:var(--acc)">flasher page</a>, or connect over Bluetooth to update every ring.';
    }
  }

  function gate(show, msg) {
    const g = document.getElementById('linkgate');
    if (!g) return;
    g.style.display = show ? 'flex' : 'none';
    document.getElementById('linkmsg').textContent = msg || '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const g = document.createElement('div');
    g.id = 'linkgate';
    g.style.cssText = 'position:fixed;inset:0;z-index:30;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:24px';
    g.innerHTML = `<div class="card" style="width:100%;max-width:400px;text-align:center">
      <h1 style="margin-bottom:6px">LED Rings</h1>
      <div class="sub" style="margin-bottom:14px">Connect to any ring. It hosts the controls for every ring that's on, and you stay on your normal Wi-Fi.</div>
      <button class="btn pri" id="gobt" style="width:100%">Connect over Bluetooth</button>
      <button class="btn" id="gousb" style="width:100%;margin-top:8px">Connect over USB</button>
      <div class="hint" id="linkmsg" style="color:var(--warn)"></div>
      <div class="hint" style="margin-top:12px">Bluetooth: Chrome or Edge (computer or Android). iPhone: the free <b>Bluefy</b> browser.<br>USB: plug a ring into this computer. No PIN needed over USB.<br><a href="../flash/" style="color:var(--acc)">Back to the flasher</a></div></div>`;
    document.body.appendChild(g);
    document.getElementById('gobt').onclick = connectBle;
    document.getElementById('gousb').onclick = connectUsb;
    fwCard();
  });
})();
