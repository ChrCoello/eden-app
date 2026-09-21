# /// script
# dependencies = ["shapely", "pillow"]
# ///
"""Sanity-check data/garden.json and render it over the scan.

Checks: valid geometries, every seeded zone present exactly once, no overlaps, no holes.
Run: uv run tools/check_garden.py [overlay.png]
"""
import itertools
import json
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
problems += [f"missing: {k}" for k in [*seeds["zones"], *seeds["lawns"]] if k not in geoms]
valid = {k: g for k, g in geoms.items() if g.is_valid}   # overlap maths needs valid shapes
for (ka, a), (kb, b) in itertools.combinations(valid.items(), 2):
    if (area := a.intersection(b).area) > 0.05:
        problems.append(f"overlap {ka}/{kb}: {area:.2f} m2")
union = shapely.union_all(list(valid.values()))
holes = [shapely.Polygon(r) for p in shapely.get_parts(union) for r in p.interiors]
problems += [f"hole of {h.area:.2f} m2 near ({h.centroid.x:.0f}, {h.centroid.y:.0f})" for h in holes if h.area > 0.05]

zones = [g for f, g in zip(fc["features"], geoms.values()) if f["properties"]["kind"] == "zone"]
print(f"{len(zones)} zones, {len(geoms)} features, garden {union.area:.0f} m2, "
      f"{sum(len(shapely.get_coordinates(g)) for g in geoms.values())} vertices")
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
    im.save(sys.argv[1])
sys.exit(1 if problems else 0)
