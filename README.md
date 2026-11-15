# Crystal Gates website

Static site for Crystal Gates, open-source FPV LED race gates running the RingLink firmware. No build step: the folder is the site, ready for GitHub Pages.

- **Preview:** double-click `Preview website.bat` (serves http://127.0.0.1:5191).
- **Refresh from the project:** double-click `Rebuild website.bat` after CAD or firmware changes. It runs
  `tools/build_site.py`, which reads `../v2` (never writes there) and regenerates:
  `assets/ring16.bin` (ring mesh for the 3D views), `img/*.webp` (renders), `stl/<size>/` + zips,
  `js/data.js` (sizes table), `js/fw.js` (firmware version) and `demo/app.html` (the real control page from `page.h`).
- **Build photos:** drop JPGs into `img/build/` with the names shown on each placeholder
  (`01-print-plate.jpg`, `02-printed-set.jpg`, `03-strip-leads.jpg` ... `14-first-on.jpg`). They appear automatically.

## Files

| | |
|---|---|
| `index.html`, `css/site.css` | the page |
| `js/main.js` | sizes, parts list (Amazon ASINs from `v2/bom/make_bom_v2.py`), reveals, motion toggle |
| `js/ring3d.js` | three.js scenes: hero fly-through and the live demo course |
| `js/sim.js` | RingLink effects ported from `ringlink/src/main.cpp`, plus a pretend set of rings for the demo |
| `demo/mock.js` | answers the control page's `/api/*` calls from the simulator |
| `vendor/three.module.min.js` | three.js r170 (MIT) |

The 3D views respect `prefers-reduced-motion` (still frames plus a Play button) and pause when off screen.

## License

Designs, STL files and firmware: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). three.js (vendor/) is MIT.
