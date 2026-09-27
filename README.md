# eden-app

A phone web app for keeping track of who watered which part of the garden, and when.
The garden plan (a surveyor's scan) is shown as a map split into zones; tap a zone to log a
watering. Zones are colored by how long ago they were last watered. Everyone who enters the same
garden code shares the same log in real time.

The zone shapes live in `data/garden.json` and are drawn by hand with a local editor (`tools/editor.html`).

## Tech stack

- **App** (`app/`): vanilla JavaScript + SVG, bundled with [Vite](https://vite.dev); installable as a PWA.
- **Backend**: [Firebase](https://firebase.google.com) — Firestore for the waterings, anonymous Auth,
  access controlled by `app/firestore.rules`.
- **Tests**: [Vitest](https://vitest.dev); the security rules are tested against the Firestore emulator (needs Java 21+).
- **Hosting**: GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main`
  that touches the app or its data (tests run first).
- **Tools** (`tools/`): Python scripts for the map data — [Shapely](https://shapely.readthedocs.io) for
  geometry, Pillow / NumPy / SciPy / scikit-image for the scan. Run with [uv](https://docs.astral.sh/uv/),
  which installs each script's dependencies on the fly.

## The app

```sh
cd app
npm install
npm run dev          # http://localhost:5173, also reachable from a phone on the same network
npm run dev:fake     # same, with an in-memory backend instead of Firestore (for UI work)
npm test             # unit tests
npm run test:rules   # Firestore rules tests, in the emulator
npm run build        # production build → app/dist
npm run deploy:rules # push app/firestore.rules to Firebase
```

On first launch the app asks for a garden code: it must match an existing `gardens/{code}` document in Firestore.

## The zone editor

```sh
uv run tools/serve.py
```

Then open <http://localhost:8000/tools/editor.html>. The server serves the repo and lets the editor save
`data/garden.json` in place. (`python3 tools/serve.py` also works, but without the chemin, split, merge
and house tools, which need Shapely.)

In the editor:

| Action | How |
| --- | --- |
| Pan / zoom | drag / mouse wheel |
| Select | click a zone |
| Move a corner | drag a handle (orange = shared: moves both zones) |
| Add a corner | double-click an edge of the selected zone |
| Delete corners | shift-click a handle, or shift-drag a box then Delete |
| Chemin (walkway) | "Draw a chemin", click its middle line, Apply: it is cut out of the zones |
| Split a zone | select it, "Split this zone", draw lines across it, Apply, name each piece |
| Merge zones | select one, "Merge with…", click its neighbour (the first keeps its ID) |
| House | "Draw a house", click its corners in order, Apply |
| Robinet (tap) | "Add a robinet", click where it is, name it; drag to move, Delete to remove |
| Undo | Ctrl+Z |

After editing, check the result:

```sh
uv run tools/check_garden.py [overlay.png]   # validates geometry and ids, optionally renders over the scan
```

Commit `data/garden.json` and push to `main` to deploy it.

## Other tools

| Script | What it does |
| --- | --- |
| `tools/extract_scan.py` | Extracts the scanned plan from the PDF → `data/map.jpg` and `data/map_web.webp` |
| `tools/calibrate.py` | Fits the pixel → meter scale against the surveyor's dimensions → `data/calibration.json` |
| `tools/segment_zones.py` | Pre-fills the zones from the scan and `data/zone_seeds.json`; refuses to overwrite hand edits without `--force` |
| `tools/make_icons.py` | Draws the app icons → `app/public/` |

## License

MIT
