"""Refresh the website's generated files from the LED Ring v2 project (read-only on v2).

    python tools/build_site.py            (or double-click "Rebuild website.bat")

Writes, inside website/:
  assets/ring16.bin   the 16 in ring (body decimated + strip + electronics) as a compact mesh pack for three.js
  img/*.webp          the lit Blender stills from v2/renders16
  demo/app.html       the real RingLink control page (v2/firmware/ringlink/src/page.h) wired to demo/mock.js
"""
import json
import re
import shutil
import struct
import sys
import zipfile
from pathlib import Path

import numpy as np

SITE = Path(__file__).resolve().parents[1]
V2 = SITE.parent / "v2"
SIZES = ["08", "12", "16", "18", "24"]
STYLE = "slim"
BODY_TRIS = 22000


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ meshes
def load_stl(p):
    import trimesh
    m = trimesh.load(p, force="mesh")
    m.merge_vertices()
    return np.asarray(m.vertices, np.float64), np.asarray(m.faces, np.int64)


def decimate(v, f, target):
    if len(f) <= target:
        return v, f
    import open3d as o3d
    m = o3d.geometry.TriangleMesh(o3d.utility.Vector3dVector(v), o3d.utility.Vector3iVector(f))
    m = m.simplify_quadric_decimation(target_number_of_triangles=target)
    m.remove_degenerate_triangles()
    m.remove_unreferenced_vertices()
    return np.asarray(m.vertices), np.asarray(m.triangles)


def strip_frame():
    """Centre + radius of the standard ring's LED strip circle: every version is placed in this frame."""
    sv, _ = load_stl(V2 / "renders16" / "r17_16in_strip.stl")
    c = [(sv[:, k].max() + sv[:, k].min()) / 2 for k in range(3)]
    return c, (sv[:, 0].max() - sv[:, 0].min()) / 2


def pack(files, out_name, frame):
    """files: [(part name, stl path)] -> assets/<out_name> mesh pack (body decimated; front face toward +z)."""
    (cx, cy, cz), radius = frame
    out = []
    for name, path in files:
        v, f = load_stl(path)
        if name == "body":
            v, f = decimate(v, f, BODY_TRIS)
        v = v - [cx, cy, cz]
        q = np.round(v * 100).astype(np.int16)          # 0.01 mm steps, +-327 mm range
        idx = f.astype(np.uint16 if len(v) < 65536 else np.uint32)
        out.append((name[:12], q, idx))
        log(f"  {out_name}: {name:10s} {len(v):6d} verts {len(f):6d} tris")
    buf = bytearray(b"RLM1")
    buf += struct.pack("<If", len(out), radius)
    for name, q, idx in out:
        buf += name.encode().ljust(12, b"\0")
        buf += struct.pack("<IIB3x", len(q), idx.size, 2 if idx.dtype == np.uint16 else 4)
        b = q.tobytes()
        buf += b + b"\0" * (-len(b) % 4)
        b = idx.tobytes()
        buf += b + b"\0" * (-len(b) % 4)
    (SITE / "assets").mkdir(exist_ok=True)
    (SITE / "assets" / out_name).write_bytes(buf)
    log(f"  assets/{out_name} {len(buf) / 1024:.0f} KB")


def build_meshes():
    src = V2 / "renders16"
    parts = ["body", "strip", "hoop", "cell", "chg", "esp", "res", "toggle", "nut"]
    pack([(n, src / f"r17_16in_{n}.stl") for n in parts if (src / f"r17_16in_{n}.stl").exists()], "ring16.bin", strip_frame())


def build_variants():
    """Sense / Dumb versions exported by tools/export_variants.py (needs CadQuery) -> assets/ring16-<variant>.bin"""
    src = SITE / "tools" / "_variants"
    frame = strip_frame()
    for variant in ("sense", "dumb"):
        files = sorted(src.glob(f"{variant}_*.stl"))
        if not files:
            log(f"  {variant}: no export in tools/_variants (run export_variants.py first)")
            continue
        named = [(f.stem[len(variant) + 1:], f) for f in files]
        named.sort(key=lambda t: t[0] != "body")
        pack(named, f"ring16-{variant}.bin", frame)


# ------------------------------------------------------------------ images
def build_images():
    from PIL import Image
    (SITE / "img").mkdir(exist_ok=True)
    for p in sorted((V2 / "renders16").glob("*.png")):
        im = Image.open(p).convert("RGB")
        for w, tag in ((1600, ""), (800, "-sm")):
            r = im.copy()
            r.thumbnail((w, w * 2))
            name = p.stem.replace("r17_16in_", "ring16-") + tag + ".webp"
            r.save(SITE / "img" / name, "WEBP", quality=82, method=6)
        log(f"  img {p.name}")


# ------------------------------------------------------------------ STLs + data
def build_stls_and_data():
    S = json.load(open(V2 / "stl" / "summary.json"))
    sizes = []
    for s in SIZES:
        d = S.get(f"{STYLE}_{s}in")
        if not d:
            continue
        src = V2 / "stl" / STYLE / f"{s}in"
        dst = SITE / "stl" / f"{int(s)}in"
        if dst.exists():
            shutil.rmtree(dst)
        dst.mkdir(parents=True)
        files = []
        for f in d["files"]:
            fp = src / f["file"]
            if not fp.exists():
                continue
            shutil.copy2(fp, dst / f["file"])
            files.append({"file": f["file"], "cm3": f["cm3"], "bed": f["bed"], "kb": round(fp.stat().st_size / 1024)})
        zname = f"crystal-gates-{int(s)}in-stl.zip"
        with zipfile.ZipFile(dst / zname, "w", zipfile.ZIP_DEFLATED) as z:
            for f in files:
                z.write(dst / f["file"], f["file"])
        sizes.append({
            "in": int(s), "parts": d["parts"], "leds": d["leds"], "strip_mm": d["strip_mm"],
            "grams": d["grams_gyroid"], "grams_solid": d["grams_100"], "hoop_mm": d["hoop_mm"],
            "bed": max(max(f["bed"]) for f in files) if files else 0,
            "zip": f"stl/{int(s)}in/{zname}", "zip_kb": round((dst / zname).stat().st_size / 1024),
            "files": [{**f, "path": f"stl/{int(s)}in/{f['file']}"} for f in files],
        })
        log(f"  stl {s}in: {len(files)} files")
    js = "// generated by tools/build_site.py from v2/stl/summary.json - do not edit\nwindow.RL_SIZES = " + json.dumps(sizes, indent=1) + ";\n"
    (SITE / "js" / "data.js").write_text(js, encoding="utf-8")


# ------------------------------------------------------------------ sizes (build guide)
def build_sizes():
    S = json.load(open(V2 / "stl" / "summary.json"))
    sizes = []
    for s in SIZES:
        d = S.get(f"{STYLE}_{s}in")
        if d:
            sizes.append({"in": int(s), "parts": d["parts"], "leds": d["leds"], "strip_mm": d["strip_mm"], "grams": d["grams_gyroid"],
                          "hoop_mm": d["hoop_mm"], "bed": max(max(f["bed"]) for f in d["files"])})
    (SITE / "js" / "sizes.js").write_text("// generated by tools/build_site.py from v2/stl/summary.json\nwindow.RL_SIZES = " + json.dumps(sizes) + ";\n", encoding="utf-8")
    log(f"  js/sizes.js: {', '.join(str(x['in']) for x in sizes)} in")


# ------------------------------------------------------------------ /flash and /connect from the firmware's web flasher (v2/firmware/site)
FLASHER = "https://elmagoct.github.io/ringlink/"     # firmware files stay where "Publish website.bat" puts them
BAR = ('<nav class="cg-bar" aria-label="Crystal Gates"><a class="cg-home" href="../">Crystal Gates</a><span>'
       '<a href="../build/"{b}>Build</a><a href="../flash/"{f}>Flash</a><a href="../connect/"{c}>Connect</a></span></nav>'
       '<style>.cg-bar{{position:relative;z-index:1000;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 14px;background:#060709;'
       'border-bottom:1px solid rgba(255,255,255,.08);font:500 14px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}}'
       '.cg-bar a{{color:#c4cad4;text-decoration:none;padding:7px 10px;border-radius:99px}}.cg-bar a:hover,.cg-bar a[aria-current]{{color:#fff;'
       'background:rgba(255,255,255,.08)}}.cg-bar .cg-home{{color:#fff;font-weight:650;padding-left:2px}}.cg-bar span{{display:flex;gap:2px}}</style>')


def build_flasher_pages():
    src = V2 / "firmware" / "site"
    cur = ' aria-current="page"'
    # /flash: the install page, installing straight from the published manifest (GitHub Pages allows it cross-origin)
    h = (src / "index.html").read_text(encoding="utf-8")
    h = h.replace('<html lang="en">', '<html lang="en" data-theme="dark">', 1)
    h = re.sub(r"<title>.*?</title>", "<title>Flash firmware · Crystal Gates</title>", h, 1)
    h = h.replace('manifest="manifest.json"', f'manifest="{FLASHER}manifest.json"')
    h = h.replace("fetch('manifest.json')", f"fetch('{FLASHER}manifest.json')")
    h = h.replace("$('dl').href = app.path;", f"$('dl').href = new URL(app.path, '{FLASHER}manifest.json').href;")
    h = h.replace('href="control.html"', 'href="../connect/"')
    h = h.replace("<h1>LED Rings firmware</h1>", "<h1>Flash the firmware</h1>")
    h = h.replace("</title>", '</title>\n<link rel="icon" href="../img/icon.svg" type="image/svg+xml">', 1)
    h = h.replace("<body>", "<body>\n" + BAR.format(b="", f=cur, c=""), 1)
    for need in (f'manifest="{FLASHER}manifest.json"', "../connect/", "cg-bar"):
        if need not in h:
            sys.exit(f"flash page: couldn't patch '{need}' (the flasher page changed?)")
    (SITE / "flash").mkdir(exist_ok=True)
    (SITE / "flash" / "index.html").write_text(h, encoding="utf-8")
    # /connect: the control page over USB / Bluetooth, with its transport script
    c = (src / "control.html").read_text(encoding="utf-8")
    c = re.sub(r"<title>.*?</title>", "<title>Connect over USB or Bluetooth · Crystal Gates</title>", c, 1)
    c = re.sub(r"<body([^>]*)>", lambda m: m.group(0) + "\n" + BAR.format(b="", f="", c=cur), c, count=1)
    (SITE / "connect").mkdir(exist_ok=True)
    (SITE / "connect" / "index.html").write_text(c, encoding="utf-8")
    js = (src / "link.js").read_text(encoding="utf-8").replace('href="./"', 'href="../flash/"')
    (SITE / "connect" / "link.js").write_text(js, encoding="utf-8")
    log(f"  flash/index.html, connect/index.html + link.js")


# ------------------------------------------------------------------ demo control page
def build_demo():
    src = (V2 / "firmware" / "ringlink" / "src" / "page.h").read_text(encoding="utf-8")
    m = re.search(r'R"rawliteral\((.*)\)rawliteral"', src, re.S)
    if not m:
        sys.exit("page.h: couldn't find the PAGE raw literal")
    html = m.group(1)
    # links the ring serves itself but the website doesn't
    html = re.sub(r'<link rel="manifest"[^>]*>', "", html)
    html = re.sub(r'<link rel="(icon|apple-touch-icon)"[^>]*>', "", html)
    html = html.replace("<head>", '<head>\n<!-- demo copy of the RingLink control page; mock.js stands in for the rings -->\n'
                        '<script src="mock.js"></script>', 1)
    (SITE / "demo").mkdir(exist_ok=True)
    (SITE / "demo" / "app.html").write_text(html, encoding="utf-8")
    main = (V2 / "firmware" / "ringlink" / "src" / "main.cpp").read_text(encoding="utf-8")
    # the version people can actually flash: the web flasher's manifest, not main.cpp (which may be mid-edit)
    try:
        ver = json.load(open(V2 / "firmware" / "site" / "manifest.json"))["version"]
    except Exception:
        mj, mn = (re.search(rf"#define\s+FW_{k}\s+(\d+)", main) for k in ("MAJOR", "MINOR"))
        ver = f"{mj.group(1)}.{mn.group(1)}" if mj and mn else "?"
    (SITE / "js" / "fw.js").write_text(f'// generated\nwindow.RL_FW = "{ver}";\n', encoding="utf-8")
    log(f"  demo/app.html ({len(html) / 1024:.0f} KB), firmware v{ver}")


if __name__ == "__main__":
    steps = sys.argv[1:] or ["meshes", "variants", "images", "demo", "sizes", "pages"]   # STLs + parts list live on MakerWorld now
    if "meshes" in steps:
        build_meshes()
    if "variants" in steps:
        build_variants()
    if "images" in steps:
        build_images()
    if "stls" in steps:
        build_stls_and_data()
    if "demo" in steps:
        build_demo()
    if "sizes" in steps:
        build_sizes()
    if "pages" in steps:
        build_flasher_pages()
    log("done")
