// Parts list: for every part, a small-pack and a bulk option from each store, with checked prices.
// AliExpress (US store, shipping to the US) and 18650BatteryStore were checked on 14 Nov 2026 by opening each listing.
// Amazon prices are the price-tracker snapshots from v2/bom/make_bom_v2.py (13 Nov 2026); amazon.com itself isn't browsed.
// Offer fields: s = store (amz | ali | shop), what, price (null = search link, no checked price), units (per pack, in the
// part's unit), url, ship = {flat, freeOver} when shipping isn't free, tiers = [[minQty, unitPrice], ...], pick = variant to choose.
(function () {
  const AMZ = (a) => `https://www.amazon.com/dp/${a}`;
  const AMZS = (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q).replace(/%20/g, "+")}`;
  const ALI = (id) => `https://www.aliexpress.com/item/${id}.html`;
  const ALIS = (q) => `https://www.aliexpress.com/w/wholesale-${q.trim().split(/\s+/).map(encodeURIComponent).join("-")}.html`;
  const m = (mm) => (mm / 1000).toFixed(2) + " m";
  window.RL_PRICES_CHECKED = { ali: "14 Nov 2026", shop: "14 Nov 2026", amz: "13 Nov 2026" };
  window.RL_PARTS = [
    { name: "Clear TPU filament", unit: "g", need: (s) => s.grams * 1.1, qty: (s) => `${s.grams} g`,
      note: "Clear / transparent TPU, 1.75 mm. Dry it 6–8 h at 50–60 °C first. Our print profile is tuned for CC3D TPU 72D.",
      small: [
        { s: "amz", what: "3DHoJor TPU 95A, 1 kg, Clear", price: 13.99, units: 1000, url: AMZ("B0DF2VLNPN"), note: "sale price; usually $18–20" },
        { s: "ali", what: "Geeetech TPU, 1 kg", pick: "Transparent", price: 12.99, units: 1000, url: ALI("3256804775295760"), note: "ships free from the US" },
      ],
      bulk: [
        { s: "ali", what: "Geeetech TPU, 5 kg box", pick: "Transparent", price: 45.82, units: 5000, url: ALI("3256809485098677"), note: "ships free from the US" },
        { s: "amz", what: "3DHoJor TPU 95A, 1 kg × several", price: 13.99, units: 1000, url: AMZ("B0DF2VLNPN") },
      ] },
    { name: "WS2812B LED strip", unit: "m", need: (s) => s.strip_mm / 1000, qty: (s) => `${s.leds} LEDs · ${m(s.strip_mm)}`,
      note: "60 LEDs/m, IP30 (bare), 10 mm wide (12 mm max). Not IP65/IP67: the tunnel is 13 × 4 mm.",
      small: [
        { s: "amz", what: "BTF-LIGHTING WS2812B ECO, 5 m", pick: "ECO · IP30 · 60/m · black", price: 13.99, units: 5, url: AMZ("B088BPGMXB"), note: "not the $30 Pure Gold variant" },
        { s: "ali", what: "WS2812B strip, 5 m", pick: "Black PCB · 5m 60 IP30", price: 8.49, units: 5, url: ALI("3256807796309465"), note: "2 m (one ring up to 18 in) is $4.49" },
      ],
      bulk: [
        { s: "ali", what: "WS2812B strip, 5 m reels", pick: "Black PCB · 5m 60 IP30", price: 8.49, units: 5, url: ALI("3256807796309465") },
        { s: "amz", what: "BTF-LIGHTING ECO, 5 m reels", price: 13.99, units: 5, url: AMZ("B088BPGMXB") },
      ] },
    { name: "ESP32-C3 SuperMini", unit: "pcs", need: () => 1, qty: () => "1",
      note: "The plain SuperMini, without pins soldered. Not the OLED or expansion-board versions.",
      small: [
        { s: "amz", what: "Teyleten Robot, 3 pcs", price: 12.99, units: 3, url: AMZ("B0D47G24W3") },
        { s: "ali", what: "ESP32-C3 SuperMini, 1 pc", pick: "ESP32 C3 · 1 pcs", price: 2.95, units: 1, url: ALI("3256807801528426") },
      ],
      bulk: [
        { s: "ali", what: "ESP32-C3 SuperMini, 10 pcs", pick: "10PCS", price: 28.59, units: 10, url: ALI("3256810126572293") },
        { s: "amz", what: "SuperMini 10-packs", price: null, url: AMZS("ESP32-C3 SuperMini 10pcs") },
      ] },
    { name: "USB-C charger + 5 V boost", unit: "pcs", need: () => 1, qty: () => "1",
      note: "IP5310, 5 V 3.1 A boost, USB-C charging. Check the photos show the 5V OUT pads.",
      small: [
        { s: "amz", what: "Teyleten Robot IP5310, 5 pcs", price: 9.99, units: 5, url: AMZ("B0GCVVL4V8") },
        { s: "ali", what: "IP5310 Type-C module, 1 pc", pick: "TYPE-C", price: 2.07, units: 1, url: ALI("3256805310218038") },
      ],
      bulk: [
        { s: "ali", what: "IP5310 Type-C module, each", pick: "TYPE-C", price: 1.17, units: 1, ship: { flat: 5.22, freeOver: 50 }, url: ALI("3256805486471073"), note: "$5.22 shipping, free over $50" },
        { s: "amz", what: "Teyleten Robot IP5310, 5 pcs × several", price: 9.99, units: 5, url: AMZ("B0GCVVL4V8") },
      ] },
    { name: "18650 Li-ion cell", unit: "pcs", need: () => 1, qty: () => "1",
      note: "A genuine high-drain cell. Spot-weld nickel tabs or buy tabbed cells; never solder to the can. Skip AliExpress cells: fakes are common.",
      small: [
        { s: "shop", store: "Specialist", what: "Molicel P28A, each (18650 Battery Store)", price: 5.99, units: 1, url: "https://www.18650batterystore.com/products/molicel-p28a", note: "plus shipping; no tabs",
          tiers: [[1, 5.99], [6, 5.5], [12, 5.25], [24, 4.95], [50, 4.75]] },
        { s: "amz", what: "Samsung 25R flat top, 4-pack", price: 46.49, units: 4, url: AMZ("B0BSLT62K6") },
      ],
      bulk: [
        { s: "shop", store: "Specialist", what: "Molicel P28A (18650 Battery Store)", price: 5.99, units: 1, url: "https://www.18650batterystore.com/products/molicel-p28a",
          note: "$5.25 at 12+, $4.95 at 24+, $4.75 at 50+", tiers: [[1, 5.99], [6, 5.5], [12, 5.25], [24, 4.95], [50, 4.75]] },
      ] },
    { name: "Power toggle", unit: "pcs", need: () => 1, qty: () => "1",
      note: "MTS-102 mini toggle, ON-ON, 3 pins. It sits in the battery + lead.",
      small: [
        { s: "amz", what: "VIBICCK MTS-102, 15 pcs", price: 3.99, units: 15, url: AMZS("VIBICCK 15PCS Mini Toggle Switch ON/ON MTS-102 3Pin"), note: "deal price; usually $7.99" },
        { s: "ali", what: "MTS-102, 10 pcs", pick: "MTS102", price: 3.82, units: 10, url: ALI("3256808118023831") },
      ],
      bulk: [
        { s: "ali", what: "MTS-102, 10 pcs × several", pick: "MTS102", price: 3.82, units: 10, url: ALI("3256808118023831") },
        { s: "amz", what: "VIBICCK MTS-102, 15 pcs × several", price: 3.99, units: 15, url: AMZS("VIBICCK 15PCS Mini Toggle Switch ON/ON MTS-102 3Pin") },
      ] },
    { name: "Battery-sense resistors", unit: "pcs", need: () => 2, qty: () => "2 × 100k",
      note: "¼ W metal film. Any equal pair from 10k to 220k works; 100k is ideal.",
      small: [
        { s: "ali", what: "100k, 100 pcs", pick: "100K", price: 1.11, units: 100, url: ALI("3256807353528247") },
        { s: "amz", what: "100k ¼ W, 100 pcs", price: null, url: AMZS("100k ohm 1/4W metal film resistor 100pcs") },
      ],
      bulk: [{ s: "ali", what: "100k, 100 pcs", pick: "100K", price: 1.11, units: 100, url: ALI("3256807353528247") }] },
    { name: "Data resistor", unit: "pcs", need: () => 1, qty: () => "1 × 330 Ω",
      note: "In series between GPIO10 and the strip's DIN. ¼ W, not ½ W.",
      small: [
        { s: "ali", what: "330 Ω, 100 pcs", pick: "330R", price: 1.1, units: 100, url: ALI("3256807353528247") },
        { s: "amz", what: "EDGELEC 330 Ω, 100 pcs", price: 5.49, units: 100, url: AMZ("B07HDFFN81") },
      ],
      bulk: [{ s: "ali", what: "330 Ω, 100 pcs", pick: "330R", price: 1.1, units: 100, url: ALI("3256807353528247") }] },
    { name: "Tripod T-nut", unit: "pcs", need: () => 1, qty: () => "1",
      note: "1/4\"-20, 4-prong, 5/16\" barrel. AliExpress mostly sells metric T-nuts, so Amazon it is.",
      small: [{ s: "amz", what: "1/4\"-20 T-nuts, 50 pcs", pick: "50pcs · Zinc · 5/16\"", price: 5.99, units: 50, url: AMZ("B0D7HFBGW7") }],
      bulk: [{ s: "amz", what: "1/4\"-20 T-nuts, 100 pcs", price: 6.99, units: 100, url: AMZ("B0CCYQ8QBH") }] },
    { name: "Steel hoop wire", unit: "mm", hoop: true, need: (s) => s.hoop_mm * 1.05, qty: (s) => (s.hoop_mm ? m(s.hoop_mm) : "not needed"),
      note: "9 gauge (3.8 mm) galvanized wire, 16 in rings and up. Hardware stores sell the same roll.",
      small: [{ s: "amz", what: "OOK 9 ga utility wire, 50 ft", price: 12.49, units: 15240, url: AMZ("B00KHIZR80") }],
      bulk: [{ s: "amz", what: "OOK 9 ga utility wire, 50 ft rolls", price: 12.49, units: 15240, url: AMZ("B00KHIZR80") }] },
    { name: "Silicone wire", unit: "cm", need: () => 40, qty: () => "~40 cm",
      note: "22 AWG (1.7 mm) fits the wire passages. 20 AWG for the short battery leads if you have it.",
      small: [
        { s: "amz", what: "BNTECHGO 22 AWG, red + black, 10 ft each", price: 7.48, units: 610, url: AMZ("B01C5DBKW6") },
        { s: "ali", what: "22 AWG silicone wire", price: null, url: ALIS("22AWG silicone wire red black") },
      ],
      bulk: [{ s: "amz", what: "BNTECHGO 22 AWG, 2 × 10 ft", price: 7.48, units: 610, url: AMZ("B01C5DBKW6") }] },
    { name: "Heat shrink", unit: "pcs", need: () => 4, qty: () => "a few",
      note: "",
      small: [
        { s: "amz", what: "Ginsco 2:1 assortment, 580 pcs", price: 6.99, units: 580, url: AMZ("B01MFA3OFA") },
        { s: "ali", what: "Heat-shrink assortment", price: null, url: ALIS("heat shrink tube assortment") },
      ],
      bulk: [{ s: "amz", what: "Ginsco 2:1 assortment, 580 pcs", price: 6.99, units: 580, url: AMZ("B01MFA3OFA") }] },
    { name: "Wake button", optional: true, unit: "pcs", need: () => 1, qty: () => "0–1",
      note: "Only if your IP5310's 5 V doesn't start by itself when the toggle turns on. 6 × 6 × 5 mm, 4 legs.",
      small: [
        { s: "amz", what: "DAOKI 6×6×5 mm, 100 pcs", price: 5.49, units: 100, url: AMZ("B01CGMP9GY") },
        { s: "ali", what: "6×6×5 mm tact switch", price: null, url: ALIS("6x6x5mm tactile push button 4 pin") },
      ],
      bulk: [] },
    { name: "Joint pins", unit: "pcs", need: () => 0, qty: (s) => `${s.parts} short pieces`, note: "Any 1.75 mm filament offcut (PLA or PETG). One pins each joint.", small: [], bulk: [] },
  ];
})();
