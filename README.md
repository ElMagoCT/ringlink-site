# Crystal Gates website

Static site for Crystal Gates, open-source FPV LED race gates running the RingLink firmware. No build step: the folder is the site, ready for GitHub Pages.

- **Preview:** double-click `Preview website.bat` (serves http://127.0.0.1:5191).
- **Refresh from the project:** double-click `Rebuild website.bat` after CAD or firmware changes. It runs
  `tools/build_site.py`, which reads `../v2` (never writes there) and regenerates:
  `assets/ring16.bin` (ring mesh for the 3D views), `img/*.webp` (renders), `js/fw.js` (firmware version)
  and `demo/app.html` (the real control page from `page.h`).
- **Versions viewer (Standard / Sense / Dumb):** after CAD changes to a version, export its assembled ring with a
  CadQuery Python (`C:\Users\micah\brophy-tshirt-cannon\cad\.venv\Scripts\python.exe tools\export_variants.py`),
  then `Rebuild website.bat` packs it into `assets/ring16-<version>.bin`.
- **Files, parts list and build guide live on MakerWorld**, not here. The write-up to paste there is in
  `../makerworld/` (description + wiring image; `parts.js` holds the checked prices it came from).
- **MakerWorld link:** the "Files, parts & guide on MakerWorld" button (`#mw-link` in `index.html`) and the footer
  link point at a MakerWorld search until the model page exists.

## Files

| | |
|---|---|
| `index.html`, `css/site.css` | the page |
| `js/main.js` | hero race HUD and captions, effects card, reveals, motion toggle |
| `js/ring3d.js` | three.js scenes: the scroll-driven race hero (5 gates) and the live demo course |
| `js/sim.js` | RingLink effects ported from `ringlink/src/main.cpp`, plus a pretend set of rings for the demo |
| `demo/mock.js` | answers the control page's `/api/*` calls from the simulator |
| `vendor/three.module.min.js` | three.js r170 (MIT) |

The 3D views animate by default (Pause button in the hero and the demo; the choice is remembered) and pause when off screen.

## License

Designs and firmware: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). three.js (vendor/) is MIT.
