# Eden app — plan

Goal: an app where Dad taps a zone of the garden map (A1, B3, …) to log that he watered it,
and sees at a glance which zones haven't been watered recently.

Source: `data/20260303_154351.PDF`, a scan (6900×8827 px JPEG) of the surveyor's
"Plan de masse" at 1/500, with hand-drawn pencil zones A1…H3.

## Decisions

- Unit of watering = pencil zones (35 zones: A1–A5, B1–B4, C1–C4, D1–D4, E1–E4, F1–F6, G1–G5, H1–H3).
- No GPS for now → no georeferencing. Coordinates are **local meters**, y up, north up
  (x = px / 23.52, y = −px / 23.40 from the scan's top-left). Can be georeferenced later with one transform.
- Map data = GeoJSON FeatureCollection in local meters (`data/garden.json`), rendered to SVG.
- The zones are beds separated by grass walkways. Each zone cell also owns half of the walkway
  next to it, so the cells tile the garden with no dead space for tapping. The scan can be shown underneath.
- Zone names (legend) filled in later by the user.

## Phase 1 — Digitize the map

- [x] 1.1 Extract the scan from the PDF, rotated upright (north up) → `data/map.jpg` (8827×6900,
      git-ignored, regenerate with `python3 tools/extract_scan.py`) + `data/map_web.webp` (3000 px).
- [x] 1.2 Calibrate pixels → meters: 41 stakes auto-detected (template matching on the ⊗ markers),
      fit against 23 surveyor dimensions. **RMS 7.9 cm, max 19.8 cm**, no skew (x/y scale differ 0.5%).
      Stakes sit 0.10 m outside path edges (note on the plan), so path widths stake-to-stake = 2.70 m.
      → `data/stakes_px.json`, `data/calibration.json`, `tools/calibrate.py`.
- [x] 1.3 Pre-fill instead of hand-tracing: seeded watershed. One seed per handwritten label
      (`data/zone_seeds.json`) grows until it meets pencil lines, with paths/ink/paper as walls. Vectorized along
      pixel edges + topology-preserving simplification, so neighbours share identical borders.
      → `tools/segment_zones.py` → `data/garden.json` (35 zones, 2 lawns, paths; 3433 vertices, 60 KB).
- [x] 1.4 Review/edit tool: `python3 tools/serve.py` → http://localhost:8000/tools/editor.html.
      Select/rename zones, set names, drag corners (shared corners move in every zone that has them),
      add/delete corners, undo, save straight to `data/garden.json`. Tested headlessly (drag + save).
- [x] 1.5 Validation: `uv run tools/check_garden.py [overlay.png]`: valid shapes, all seeds present,
      no overlaps, no holes, garden in one piece. Current result: OK, garden = 35,243 m² (3.5 ha).
- [ ] 1.6 (User) Review the zones in the editor against what's really on the ground; fix borders.
- [ ] 1.7 (User) Add zone names from the handwritten legend (Name field in the editor).
- [ ] 1.8 Open questions for the user:
  - Unlabeled areas: the big lawn north of H1/H2/G1 and the strip by the house are
    `lawn_north`/`lawn_house` (kind "lawn"). Should they be waterable zones?
  - A faint label in the top-left strip (near the house, west of H3) looks like "B5"/"A6"; it's merged into A1 for now.

## Phase 2 — The app

### Decisions (2026-09-21)

- Phone web app, installable on the home screen (PWA manifest + icon). **Online-only**:
  there's mobile signal everywhere in the garden.
- Watering logs synced between everyone who uses the app, live.
- Identity: enter a shared **garden code** once, then pick your name. No passwords.
- Repo stays public → hosted on **GitHub Pages** (deployed by a GitHub Action).
- Backend: **Firebase Firestore** + anonymous auth. No server code, live listeners, free tier
  that never pauses (Supabase free projects pause after a week idle, e.g. in winter).

### Data model (Firestore)

```
gardens/{gardenCode}                      { members: ["Papa", "Chris", ...] }
gardens/{gardenCode}/waterings/{autoId}   { zone: "B3", by: "Papa", at: serverTimestamp }
```
- The garden code is the secret: security rules only allow signed-in (anonymous) users to
  read/write under a garden document that exists; the code is never listed. Good enough for a family app.
- "Last watered" per zone is computed client-side from a live query on the last 60 days
  (35 zones × a few waterings/day, so small).
- Undo = delete the watering doc (only your own, only within a few minutes: enforced in rules).

### Stack

- Vite + vanilla JS, no framework: one map screen and one bottom sheet.
- Map = SVG generated from `data/garden.json` (zones colored, labels, paths), pinch-zoom/pan.
  Optional faint scan background (`map_web.webp`) toggle.
- Tests: Vitest for the pure logic (last-watered aggregation, color scale), Firestore emulator
  for the security rules, Playwright smoke test on a phone viewport.

### Steps

- [x] 2.1 (User) Firebase project `digital-eden-31820` created; web config in `app/src/firebase-config.js`.
      Still to confirm: Firestore created + Anonymous auth enabled; garden code; list of names.
- [x] 2.2 `app/`: Vite 6 + Vitest 3 (they support local Node 20.11; CI uses Node 22), PWA manifest +
      icons (`tools/make_icons.py`), `.github/workflows/deploy.yml` (test → build → Pages).
      Live at https://chrcoello.github.io/eden-app/ (Pages source: GitHub Actions; deploys on push to main).
- [x] 2.3 Map screen (French UI): SVG from `garden.json`, pan, pinch-zoom, wheel zoom, tap → zone sheet
      (id, name, area), "Plan" toggles the scan underneath, "Tout voir" re-fits, dark mode.
      Checked in headless Chrome on a 390×844 touch viewport: taps hit the right zone, pan ≠ tap, pinch zooms.
- [ ] 2.4 First launch: garden code + pick/add your name (remembered on the phone).
- [ ] 2.5 Firestore: live waterings listener, "Watered now" button, 10 s undo toast.
- [ ] 2.6 Coloring by days since last watered (today / 1–2 d / 3–6 d / 7+ d / never) + legend.
- [ ] 2.7 Zone sheet: name, last watered by whom and when, recent history.
- [ ] 2.8 Security rules + emulator tests; unit tests; Playwright phone smoke test.
- [ ] 2.9 Deploy, then test on a real phone with you (and Dad).

### Later (not in the first version)

- Multi-select: tick several zones, then "Watered all".
- Notes/photos per watering, reminders, GPS "you are here".

## Review

Phase 2.2–2.3 (2026-09-21): testing the map zoomed in revealed real gaps in `garden.json`
(thin unassigned strips along path outlines, open to the property edge, so the "no holes" check
missed them). Fixed in `segment_zones.py` (closing before gap-fill; drop path-coloured blobs outside
the garden) and `check_garden.py` now fails if the garden is in several pieces. Re-running the
pipeline wiped the user's hand edits to G1–G3; they were re-applied locally, and the script now refuses
to overwrite a hand-edited `garden.json` without `--force`.

Phase 1 (2026-09-21): pre-filling the zones automatically worked better than hand-tracing
would have, because the pencil loops are clear enough for a seeded watershed. Accuracy is limited by the
pencil sketch itself (~0.5 m), not by the scan (4.3 cm/px) or the calibration (7.9 cm RMS).
Main pitfalls hit: seeds landing inside handwritten letters (fixed with larger disc seeds), path
mask broken by stake markers (fixed with closing + small-hole filling only), holes left by dropped
islands (fixed at raster level before vectorizing).
