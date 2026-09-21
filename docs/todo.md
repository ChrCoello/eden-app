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
      no overlaps, no holes. Current result: OK, garden = 34,845 m² (3.5 ha).
- [ ] 1.6 (User) Review the zones in the editor against what's really on the ground; fix borders.
- [ ] 1.7 (User) Add zone names from the handwritten legend (Name field in the editor).
- [ ] 1.8 Open questions for the user:
  - Unlabeled areas: the big lawn north of H1/H2/G1 and the strip by the house are
    `lawn_north`/`lawn_house` (kind "lawn"). Should they be waterable zones?
  - A faint label in the top-left strip (near the house, west of H3) looks like "B5"/"A6"; it's merged into A1 for now.

## Phase 2 — The app (to be detailed after Phase 1)

- Map view: SVG of zones, colored by days since last watered (today → 1 week+).
- Tap a zone → "Watered now" (optional note), undo for mistaps.
- Zone detail: watering history.
- Open questions:
  - Platform: installable web app (PWA, works offline in the garden), recommended.
  - Storage: only on Dad's phone, or synced so you can see it too?
  - Multi-select zones in one go (watering a whole row)?

## Review

Phase 1 (2026-09-21): pre-filling the zones automatically worked better than hand-tracing
would have, because the pencil loops are clear enough for a seeded watershed. Accuracy is limited by the
pencil sketch itself (~0.5 m), not by the scan (4.3 cm/px) or the calibration (7.9 cm RMS).
Main pitfalls hit: seeds landing inside handwritten letters (fixed with larger disc seeds), path
mask broken by stake markers (fixed with closing + small-hole filling only), holes left by dropped
islands (fixed at raster level before vectorizing).
