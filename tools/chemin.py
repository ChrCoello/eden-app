"""Carve a chemin (grass walkway) out of the zones of data/garden.json.

A chemin is drawn as middle lines ("branches") plus a width. The band around them is cut out of
the zones and lawns it covers (never out of the gravel paths) and becomes a feature of kind
"chemin". Carving into an existing chemin id adds to it.

Neighbours must keep sharing identical corners (tools/editor.html moves shared corners together),
so the borders of every feature the band touches are noded together with the band outline, and
each of those features is rebuilt from the resulting faces.

Used by tools/serve.py (POST /carve).
"""
import shapely
from shapely.geometry import LineString, mapping, shape

CUT = {"zone", "lawn"}      # kinds a chemin is cut out of
MIN_AREA = 0.5              # m2: a zone must keep at least this much
GRID = 0.01                 # m: garden.json coordinates are in cm


def carve(fc, branches, width, cid):
    """Returns (new feature collection, report lines). Raises ValueError on bad input."""
    cid = cid.strip()
    lines = [LineString(b) for b in branches if len(b) >= 2]
    if not cid:
        raise ValueError("The chemin needs an id.")
    if not lines:
        raise ValueError("Draw at least one line of 2 points.")
    if not 0.3 <= width <= 10:
        raise ValueError("Width must be between 0.3 and 10 m.")
    band = shapely.union_all([l.buffer(width / 2, cap_style="flat", join_style="round", quad_segs=4) for l in lines])
    out, report, chemin = cut_out(fc, band, cid, "chemin", CUT, whole=False)
    if len(small := [q for q in shapely.get_parts(chemin) if q.area < 2 * width ** 2]) > 0:
        report.append(f"warning: {len(small)} small piece(s) of {cid}: does a line end cross a path into the next block?")
    return out, sorted(report, key=lambda r: (r.startswith("warning"), r))


def cut_out(fc, area, cid, kind, cut, whole):
    """Cuts `area` out of the features of the kinds in `cut` that it covers; it becomes feature `cid` of
    `kind`, or is added to it if `cid` exists. Where `area` covers no feature, it only takes the gaps
    enclosed by the garden (a chemin stays inside it), or all of it if `whole` (a house). A chemin's
    small leftovers join a neighbour; with `whole`, what's left of a feature stays that feature's.
    Returns (new feature collection, report lines, new geometry of `cid`). Raises ValueError."""
    feats = fc["features"]
    same = [f for f in feats if f["properties"]["id"] == cid]
    if same and same[0]["properties"]["kind"] != kind:
        raise ValueError(f'"{cid}" is already used by a {same[0]["properties"]["kind"]}.')

    geoms = [shape(f["geometry"]) for f in feats]
    # Gaps between zones stay gaps, except the part the area covers, which becomes the new feature.
    gaps = [shapely.Polygon(r) for p in shapely.get_parts(shapely.union_all(geoms)) for r in p.interiors]
    fill = shapely.union_all([h for h in gaps if h.intersects(area)])
    covered = shapely.union_all([area, fill])
    # Snap-rounding can nudge borders by up to a cm: features just short of the area are included
    # so both sides of a nudged border move together.
    hit = [i for i, (f, g) in enumerate(zip(feats, geoms)) if g.distance(covered) < 5 * GRID or f["properties"]["id"] == cid]
    if not whole and not any(feats[i]["properties"]["kind"] in cut and geoms[i].intersection(area).area > 0.01 for i in hit):
        raise ValueError(f"The {kind} doesn't cross any zone.")
    if not same:
        feats = feats + [{"type": "Feature", "properties": {"id": cid, "kind": kind, "name": ""}, "geometry": None}]
        geoms = geoms + [shapely.Polygon()]
    target = next(i for i, f in enumerate(feats) if f["properties"]["id"] == cid)

    # Faces of the arrangement: every border of the touched features plus the area's outline, noded
    # once with snap-rounding to the file's 1 cm grid, so every face is valid and on the grid.
    edges = shapely.union_all([geoms[i].boundary for i in hit] + [area.boundary], grid_size=GRID)
    owned = {}
    for face in shapely.get_parts(shapely.polygonize(shapely.get_parts(edges))):
        p = face.representative_point()
        owner = next((i for i in hit if geoms[i].contains(p)), None)
        if owner is None and (whole or fill.contains(p)) and area.contains(p):
            owner = target
        elif owner is None:
            continue                               # outside the touched features (e.g. a block inside a path loop)
        elif feats[owner]["properties"]["kind"] in cut and area.contains(p):
            owner = target
        owned.setdefault(owner, []).append(face)
    new = {i: shapely.union_all(owned[i], grid_size=GRID) if i in owned else shapely.Polygon() for i in {*hit, target}}
    geom = lambda i: new.get(i, geoms[i])

    # A small piece cut off a feature (under 10% of it) joins the one it shares the longest border with.
    for i in [i for i in new if feats[i]["properties"]["kind"] in cut and not whole]:
        main, *crumbs = sorted(shapely.get_parts(new[i]), key=lambda q: -q.area)
        for c in [c for c in crumbs if c.area < 0.1 * new[i].area]:
            shared = {j: c.boundary.intersection(geom(j).boundary).length
                      for j in range(len(feats)) if j != i and feats[j]["properties"]["kind"] in cut | {kind}}
            j = max(shared, key=lambda j: (feats[j]["properties"]["kind"] in cut, shared[j]))
            if shared[j] > 0:
                new[i] = new[i].difference(c, grid_size=GRID)
                new[j] = shapely.union_all([geom(j), c], grid_size=GRID)

    report, out = [], [dict(f) for f in feats]
    for i, g in new.items():
        f, fid = out[i], feats[i]["properties"]["id"]
        if f["properties"]["kind"] in cut and g.area < MIN_AREA:
            raise ValueError(f"{fid} would disappear under the {kind}.")
        if not g.is_valid:
            raise ValueError(f"{fid} would get an invalid shape: try a slightly different line.")
        n = len(shapely.get_parts(g))
        f["geometry"] = mapping(g)
        if abs(g.area - geoms[i].area) >= 0.05:
            report.append(f"{fid}: {geoms[i].area:.0f} → {g.area:.0f} m²" + (f" ({n} pieces)" if n > 1 else ""))
    return {**fc, "features": out}, report, new[target]
