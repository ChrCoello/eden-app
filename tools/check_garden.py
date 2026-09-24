# /// script
# dependencies = ["shapely", "pillow"]
# ///
"""Sanity-check data/garden.json and render it over the scan.

Checks: valid geometries, ids unique and accepted by the Firestore rules,
no overlaps, robinets well-formed. Gaps between zones are allowed and only listed.
Run: uv run tools/check_garden.py [overlay.png]
"""
import itertools
import json
import math
import re
import sys
from pathlib import Path

import shapely
from PIL import Image, ImageDraw
from shapely.geometry import shape

Image.MAX_IMAGE_PIXELS = None
DATA = Path(__file__).resolve().parent.parent / "data"

fc = json.loads((DATA / "garden.json").read_text())
sx, sy = json.loads((DATA / "calibration.json").read_text())["px_per_m"]
seeds = json.loads((DATA / "zone_seeds.json").read_text())
geoms = {f["properties"]["id"]: shape(f["geometry"]) for f in fc["features"]}
ids = [f["properties"]["id"] for f in fc["features"]]

problems = []
problems += [f"invalid geometry: {k}" for k, g in geoms.items() if not g.is_valid]
problems += [f"duplicate id: {k}" for k in {i for i in ids if ids.count(i) > 1}]
# the Firestore rules only accept waterings whose zone matches this (app/firestore.rules)
problems += [f'id "{k}" must be 1-20 letters, digits or _' for k in ids if not re.fullmatch(r"[A-Za-z0-9_]{1,20}", k)]
# zones can be split, merged and renamed in the editor, so a seed without its zone is only a note
gone = [k for k in [*seeds["zones"], *seeds["lawns"]] if k not in geoms]
for f in fc["features"]:
    props = f["properties"]
    if props["kind"] != "zone":
        continue
    if not isinstance(props.get("auto"), bool):
        problems.append(f'{props["id"]}: "auto" must be true or false')
    trees = props.get("trees")
    if trees is not None and not (isinstance(trees, int) and not isinstance(trees, bool) and trees >= 0):
        problems.append(f'{props["id"]}: "trees" must be a whole number >= 0, or null')
# robinets (water taps): points next to the features, [{"name": str, "at": [x, y]}]
robinets = fc.get("robinets", [])
for i, r in enumerate(robinets):
    at = r.get("at")
    if not isinstance(r.get("name"), str):
        problems.append(f"robinet {i + 1}: \"name\" must be text")
    if not (isinstance(at, list) and len(at) == 2 and all(isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) for v in at)):
        problems.append(f"robinet {i + 1} ({r.get('name')}): \"at\" must be [x, y] in meters")
valid = {k: g for k, g in geoms.items() if g.is_valid}   # overlap maths needs valid shapes
for (ka, a), (kb, b) in itertools.combinations(valid.items(), 2):
    if (area := a.intersection(b).area) > 0.05:
        problems.append(f"overlap {ka}/{kb}: {area:.2f} m2")
union = shapely.union_all(list(valid.values()))
# zones don't have to cover the garden: gaps are fine, listed for information only
holes = [shapely.Polygon(r) for p in shapely.get_parts(union) for r in p.interiors]
notes = [f"gap of {h.area:.1f} m2 near ({h.centroid.x:.0f}, {h.centroid.y:.0f})" for h in holes if h.area > 0.05]
if (n := len(shapely.get_parts(union))) > 1:
    notes.append(f"the zones form {n} separate pieces")

zones = [g for f, g in zip(fc["features"], geoms.values()) if f["properties"]["kind"] == "zone"]
print(f"{len(zones)} zones, {len(geoms)} features, {len(robinets)} robinets, garden {union.area:.0f} m2, "
      f"{sum(len(shapely.get_coordinates(g)) for g in geoms.values())} vertices")
for note in notes:
    print(f"note: {note}")
if gone:
    print(f"note: seeded zones no longer in the file (renamed or merged?): {', '.join(gone)}")
print("\n".join(problems) or "OK: no problems")

if len(sys.argv) > 1:
    scale = 0.25
    im = Image.open(DATA / "map.jpg").convert("RGB")
    im = im.resize((int(im.width * scale), int(im.height * scale)))
    draw = ImageDraw.Draw(im)
    to_px = lambda coords: [(x * sx * scale, -y * sy * scale) for x, y in coords]
    for k, g in geoms.items():
        for part in shapely.get_parts(g):
            for ring in [part.exterior, *part.interiors]:
                draw.line(to_px(ring.coords), fill="blue" if k == "paths" else "red", width=2)
        c = g.representative_point()
        draw.text((c.x * sx * scale - 8, -c.y * sy * scale - 5), k, fill="black")
    for r in robinets:
        (px, py), = to_px([r["at"]])
        draw.ellipse((px - 5, py - 5, px + 5, py + 5), fill="deepskyblue", outline="black")
        draw.text((px + 7, py - 5), r["name"], fill="navy")
    im.save(sys.argv[1])
sys.exit(1 if problems else 0)
