"""Export the assembled 16 in ring of each version (standard / sense / dumb) for the website's 3D viewer.
Reads v2/cad (never writes there); writes STLs to tools/_variants/<variant>_*.stl.
Needs a Python with CadQuery, e.g.:
    C:\\Users\\micah\\brophy-tshirt-cannon\\cad\\.venv\\Scripts\\python.exe tools\\export_variants.py [sense dumb]
then `python tools/build_site.py variants` packs them into assets/ring16-<variant>.bin."""
import os
import sys
from pathlib import Path

import cadquery as cq

SITE = Path(__file__).resolve().parents[1]
CAD = SITE.parent / "v2" / "cad"
sys.path.insert(0, str(CAD))
import base2 as B  # noqa: E402
import ring2 as R  # noqa: E402

OUT = SITE / "tools" / "_variants"
OUT.mkdir(exist_ok=True)
for variant in sys.argv[1:] or ["sense", "dumb"]:
    p = R.P(diameter_in=16, base_style="slim", variant=variant)
    ring, sts = R.build(p)
    shapes = [wp.val() for _, wp, _, _ in R.split(p, ring, sts)]
    for extra in ("cover", "cap"):                 # the bay cover (standard/sense) or the T-nut cap (dumb)
        fn = getattr(B, extra, None)
        if fn:
            try:
                shapes.append(fn(p).val())
            except Exception as e:                  # not every version has every part
                print(f"  {variant}: no {extra} ({type(e).__name__})")
    pre = OUT / variant
    cq.Compound.makeCompound(shapes).exportStl(f"{pre}_body.stl", tolerance=0.02, angularTolerance=0.05)
    try:
        s = R.strip_solid(p)
        if s is not None:
            s.val().exportStl(f"{pre}_strip.stl", tolerance=0.05, angularTolerance=0.1)
    except Exception as e:
        print(f"  {variant}: no strip ({type(e).__name__})")
    comps = B.components(p)
    hp = R.hoop_solid(p)
    if hp is not None:
        comps["hoop"] = hp
    for k, v in comps.items():
        v.val().exportStl(f"{pre}_{k}.stl", tolerance=0.05, angularTolerance=0.1)
    print(variant, "parts:", ", ".join(["body"] + list(comps)), flush=True)
