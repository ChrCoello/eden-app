# /// script
# dependencies = ["numpy", "scipy", "pillow", "scikit-image", "rasterio", "shapely", "topojson"]
# ///
"""Pre-fill the zone polygons from the scan: seeded watershed + topology-preserving vectorization.

The pencil zones are beds separated by thin grass walkways. Each seed (data/zone_seeds.json)
grows until it meets pencil lines; paths, ink and the paper outside the property are walls.
So every point of the garden ends up in exactly one cell, and each bed also owns the half
of the walkway next to it, which is what we want for tapping on a phone.

Cells are vectorized along pixel edges (neighbours share identical borders), simplified
with shared arcs preserved, converted to meters with data/calibration.json, and written to
data/garden.json.

Run: uv run tools/segment_zones.py [--force]

garden.json is hand-edited afterwards (tools/editor.html). The file records a fingerprint of what
this script generated; if the features no longer match it, the script refuses to overwrite your
edits unless --force is given.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import rasterio.features
import shapely
import topojson
from PIL import Image
from scipy import ndimage as ndi
from shapely.geometry import mapping, shape
from skimage.segmentation import watershed

Image.MAX_IMAGE_PIXELS = None
DATA = Path(__file__).resolve().parent.parent / "data"
K = 3                 # work at 1/3 resolution (~13 cm/px), plenty for pencil sketches
SEED_RADIUS = 14      # px at 1/3 res (~1.8 m): big enough not to get trapped in a handwritten letter
SIMPLIFY_M = 0.15     # Douglas-Peucker tolerance, meters
PATH_MIN_PX = 20 * 23.5 ** 2 / K ** 2   # path pieces under ~20 m2 are specks


def load_scan():
    im = Image.open(DATA / "map.jpg")
    im = im.resize((im.width // K, im.height // K), Image.Resampling.BOX)
    return np.asarray(im).astype(np.int16)


def fill_small_holes(mask, max_px=5 * 23.5 ** 2 / K ** 2):
    """Fill holes under ~5 m2 (stake markers), not the garden blocks enclosed by path loops."""
    holes, _ = ndi.label(ndi.binary_fill_holes(mask) & ~mask)
    sizes = np.bincount(holes.ravel())
    return mask | ((sizes < max_px)[holes] & (holes > 0))


def masks(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    lum = (r + g + b) / 3
    brown = (r > g + 20) & (r > b + 40)                               # paths + terrace
    paths = ndi.binary_opening(brown, iterations=3)                   # drop thin orange boundary lines
    paths = fill_small_holes(ndi.binary_closing(paths, iterations=6))  # bridge stake markers/outlines
    paper = (lum > 215) & (abs(r - g) < 18) & (abs(g - b) < 18)       # outside the property
    ink = lum < 90                                                    # printed black lines
    walls = ndi.binary_opening(ndi.binary_dilation(brown | ink) | paper) | brown
    # pencil = darker than the local background; blue dimension lines are ignored
    blue = (b > r + 25) & (b > g - 5)
    elevation = np.clip(ndi.median_filter(lum, size=31) - lum, 0, 60)
    elevation[blue] = 0
    return paths, walls, ndi.gaussian_filter(elevation, 1.5)


def segment(walls, elevation, seeds):
    markers = np.zeros(walls.shape, np.int32)
    yy, xx = np.ogrid[: walls.shape[0], : walls.shape[1]]
    for i, (x, y) in enumerate(seeds.values(), 1):
        markers[(yy - y / K) ** 2 + (xx - x / K) ** 2 < SEED_RADIUS ** 2] = i
    comp, _ = ndi.label(~walls)
    reached = np.setdiff1d(np.unique(comp[markers > 0]), [0])
    return watershed(elevation, markers, mask=np.isin(comp, reached))


def drop_islands(labels, path_label):
    """Zones keep only their main connected piece. Paths keep pieces over ~20 m2 that touch the
    garden (the red logo in the title block is path-coloured too).
    The freed pixels go back to 0 and are re-assigned by fill_gaps, so no holes appear."""
    out = labels.copy()
    near_garden = ndi.binary_dilation((labels > 0) & (labels != path_label), iterations=2)
    for value in np.setdiff1d(np.unique(labels), [0]):
        pieces, _ = ndi.label(labels == value)
        sizes = np.bincount(pieces.ravel())
        sizes[0] = 0
        if value == path_label:
            keep = (sizes >= PATH_MIN_PX) & np.isin(np.arange(len(sizes)), pieces[near_garden])
        else:
            keep = sizes == sizes.max()
        out[(pieces > 0) & ~keep[pieces]] = 0
    return out


def fill_gaps(labels):
    """Give every unlabeled pixel inside the garden (ink lines, printed text, stake markers) to its
    nearest cell. The closing makes thin unlabeled strips (path outlines running out to the property
    edge) count as inside; otherwise they'd stay as gaps open to the outside."""
    inside = ndi.binary_fill_holes(ndi.binary_closing(labels > 0, iterations=5))
    _, (iy, ix) = ndi.distance_transform_edt(labels == 0, return_indices=True)
    return np.where(inside & (labels == 0), labels[iy, ix], labels)


def to_meters(geom, px_per_m):
    sx, sy = px_per_m
    return shapely.transform(geom, lambda c: np.column_stack([c[:, 0] * K / sx, -c[:, 1] * K / sy]))


def fingerprint(features):
    return hashlib.sha256(json.dumps(features, sort_keys=True).encode()).hexdigest()[:16]


def check_not_hand_edited(path):
    if not path.exists() or "--force" in sys.argv:
        return
    current = json.loads(path.read_text())
    if current.get("generated") != fingerprint(current["features"]):
        sys.exit(f"{path} has been edited since it was generated. Re-run with --force to discard those edits.")


def main():
    out = DATA / "garden.json"
    check_not_hand_edited(out)
    seeds_doc = json.loads((DATA / "zone_seeds.json").read_text())
    kinds = {**{n: "zone" for n in seeds_doc["zones"]}, **{n: "lawn" for n in seeds_doc["lawns"]}}
    seeds = {**seeds_doc["zones"], **seeds_doc["lawns"]}
    px_per_m = json.loads((DATA / "calibration.json").read_text())["px_per_m"]

    paths, walls, elevation = masks(load_scan())
    labels = segment(walls, elevation, seeds)
    names = list(seeds) + ["paths"]
    kinds["paths"] = "path"
    labels[paths] = len(names)
    labels = fill_gaps(drop_islands(fill_gaps(labels), len(names)))

    cells = {}
    for geom, value in rasterio.features.shapes(labels, mask=labels > 0, connectivity=4):
        cells.setdefault(names[int(value) - 1], []).append(shape(geom))
    features = [{"type": "Feature", "properties": {"id": n, "kind": kinds[n]},
                 "geometry": mapping(to_meters(shapely.union_all(g), px_per_m))} for n, g in cells.items()]

    topo = topojson.Topology({"type": "FeatureCollection", "features": features},
                             toposimplify=SIMPLIFY_M, prequantize=False)
    fc = json.loads(topo.to_geojson())
    for f in fc["features"]:
        f.pop("id", None)
        f["geometry"] = mapping(shapely.set_precision(shape(f["geometry"]), 0.01))
        f["properties"].setdefault("name", "")
    fc["features"].sort(key=lambda f: (f["properties"]["kind"] != "zone", f["properties"]["id"]))
    fc["generated"] = fingerprint(fc["features"])
    out.write_text(json.dumps(fc, separators=(",", ":")))

    for f in fc["features"]:
        print(f'{f["properties"]["id"]:>11} {f["properties"]["kind"]:>5} {shape(f["geometry"]).area:8.0f} m2')


if __name__ == "__main__":
    main()
