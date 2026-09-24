"""Add a house (or another building) to data/garden.json from outlines drawn in the editor.

Each outline is a list of corners; the polygon they enclose is cut out of every zone, lawn, chemin and
gravel path it covers (so their areas no longer count it) and becomes a feature of kind "house". All of
the outline becomes house, also where no feature was. Drawing again with the same id adds a building.

Used by tools/serve.py (POST /house).
"""
import shapely
from shapely.geometry import Polygon

from chemin import CUT, cut_out
from zones import ID_RE

COVERED = CUT | {"chemin", "path"}   # kinds a house is cut out of: everything under it


def add_house(fc, outlines, hid):
    """Returns (new feature collection, report lines). Raises ValueError on bad input."""
    hid = hid.strip()
    if not ID_RE.match(hid):
        raise ValueError(f'ID "{hid}": use 1-20 letters, digits or _.')
    rings = [o for o in outlines if len(o) >= 3]
    if not rings:
        raise ValueError("Click at least 3 corners.")
    polys = [Polygon(o) for o in rings]
    if bad := [i + 1 for i, p in enumerate(polys) if not p.is_valid]:
        raise ValueError(f"Outline {', '.join(map(str, bad))} crosses itself: click the corners in order around the house.")
    area = shapely.union_all(polys)
    if area.area < 1:
        raise ValueError("The house is smaller than 1 m²: draw its outline.")
    out, report, _ = cut_out(fc, area, hid, "house", COVERED, whole=True)
    return out, sorted(report)                   # includes the house itself: "maison: 0 → 150 m²"
