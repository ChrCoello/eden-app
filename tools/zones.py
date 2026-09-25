"""Split a zone along drawn lines, or merge two neighbouring zones, in data/garden.json.

Like chemin.py, a split nodes the zone's border, its neighbours' borders and the lines together
(snap-rounded once to the 1 cm grid), so the new pieces and their neighbours keep sharing
identical corners and tools/editor.html can still drag them.

Used by tools/serve.py (POST /split, /merge).
"""
import re

import shapely
from shapely.geometry import LineString, mapping, shape

from chemin import CUT, GRID

ID_RE = re.compile(r"^[A-Za-z0-9_]{1,20}$")   # what the Firestore rules accept as a watering's zone
MERGEABLE = CUT | {"chemin"}


def _index(feats, fid):
    i = next((i for i, f in enumerate(feats) if f["properties"]["id"] == fid), None)
    if i is None:
        raise ValueError(f'No feature "{fid}".')
    return i


def split(fc, zid, branches):
    """Cuts zone `zid` along the lines. The largest piece keeps `zid`; the others get the
    temporary ids zid~1, zid~2… (by decreasing area), to be renamed in the editor.
    Returns (new feature collection, report lines, piece ids largest first)."""
    feats = fc["features"]
    i = _index(feats, zid)
    if feats[i]["properties"]["kind"] not in CUT:
        raise ValueError(f"Only zones and lawns can be split, not a {feats[i]['properties']['kind']}.")
    lines = [LineString(b) for b in branches if len(b) >= 2]
    if not lines:
        raise ValueError("Draw at least one line of 2 points.")
    geoms = [shape(f["geometry"]) for f in feats]
    zone = geoms[i]
    # The lines inside the zone, plus 2 cm past its border so they surely cross it; the stubs
    # outside are dangles that polygonize drops.
    cut = shapely.union_all(lines).intersection(zone.buffer(2 * GRID))
    hit = [j for j, g in enumerate(geoms) if g.distance(zone) < 5 * GRID]
    edges = shapely.union_all([geoms[j].boundary for j in hit] + [cut], grid_size=GRID)
    owned, pieces = {}, []
    for face in shapely.get_parts(shapely.polygonize(shapely.get_parts(edges))):
        p = face.representative_point()
        owner = next((j for j in hit if geoms[j].contains(p)), None)
        if owner == i:
            pieces.append(face)
        elif owner is not None:
            owned.setdefault(owner, []).append(face)
    pieces = sorted([q for q in pieces if q.area > 0], key=lambda q: -q.area)
    while len(pieces) > 1 and pieces[-1].area < 0.05:        # hairline sliver from snapping: join a neighbour
        s = pieces.pop()
        k = max(range(len(pieces)), key=lambda k: s.boundary.intersection(pieces[k].boundary).length)
        pieces[k] = shapely.union_all([pieces[k], s], grid_size=GRID)
    if len(pieces) < 2:
        raise ValueError(f"The line must cross {zid} from one border to another.")
    if pieces[-1].area < 1:
        raise ValueError(f"One piece would be only {pieces[-1].area:.2f} m²: check where the line ends.")

    out = [dict(f) for f in feats]
    for j, faces in owned.items():       # neighbours: same shape, plus the corners where a line meets them
        out[j]["geometry"] = mapping(shapely.union_all(faces, grid_size=GRID))
    out[i]["geometry"] = mapping(pieces[0])
    props = {k: v for k, v in feats[i]["properties"].items() if k != "label"}   # may land in any piece
    out[i] = {**out[i], "properties": props}
    ids = [zid] + [f"{zid}~{n}" for n in range(1, len(pieces))]
    new = [{"type": "Feature",
            "properties": {**props, "id": pid, "name": "", **({"trees": None} if "trees" in props else {})},
            "geometry": mapping(q)} for pid, q in zip(ids[1:], pieces[1:])]
    out[i + 1:i + 1] = new
    report = [f"{zid}: {zone.area:.0f} m² → " + " + ".join(f"{q.area:.0f}" for q in pieces) + " m²"]
    if props.get("trees") is not None:
        report.append(f"trees: {props['trees']} stay on {zid}, the new pieces are 'not counted'")
    return {**fc, "features": out}, report, ids


def merge(fc, keep, other):
    """Joins `other` into `keep` (which keeps its id, name and settings). Returns (fc, report)."""
    feats = fc["features"]
    i, j = _index(feats, keep), _index(feats, other)
    if i == j:
        raise ValueError("Pick a different zone to merge with.")
    a, b = feats[i]["properties"], feats[j]["properties"]
    if a["kind"] != b["kind"] or a["kind"] not in MERGEABLE:
        raise ValueError(f"Only two zones, two lawns or two chemins can be merged ({keep} is a {a['kind']}, {other} a {b['kind']}).")
    ga, gb = shape(feats[i]["geometry"]), shape(feats[j]["geometry"])
    if ga.boundary.intersection(gb.boundary).length < 0.05:
        raise ValueError(f"{keep} and {other} don't share a border.")
    g = shapely.union_all([ga, gb], grid_size=GRID)
    if not g.is_valid or len(shapely.get_parts(g)) != 1:
        raise ValueError(f"Merging {keep} and {other} doesn't give one clean shape.")
    report = [f"{keep}: {ga.area:.0f} + {gb.area:.0f} → {g.area:.0f} m² ({other} removed)"]
    props = dict(a)
    if a["kind"] == "zone":
        if a.get("auto") != b.get("auto"):
            report.append(f"note: {other} had automatic watering {'on' if b.get('auto') else 'off'}; {keep}'s setting is kept")
        props["trees"] = a["trees"] + b["trees"] if a.get("trees") is not None and b.get("trees") is not None else None
        report.append(f"note: waterings logged on {other} stay under that id and no longer show")
    out = [dict(f) for f in feats]
    out[i] = {**out[i], "properties": props, "geometry": mapping(g)}
    del out[j]
    return {**fc, "features": out}, report
