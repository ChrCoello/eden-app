// Pure geometry helpers for data/garden.json.
// Garden coordinates are local meters with y up; SVG is y down, so every y is negated here.
import polylabel from "polylabel";

/** Polygon or MultiPolygon → list of polygons (each a list of rings). */
export function polygons(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

/** SVG path data, y flipped. Use with fill-rule="evenodd" for holes. */
export function svgPath(geometry) {
  return polygons(geometry)
    .flat()
    .map((ring) => "M" + ring.slice(0, -1).map(([x, y]) => `${x},${-y}`).join("L") + "Z")
    .join("");
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(a) / 2;
}

export function area(geometry) {
  return polygons(geometry).reduce(
    (sum, [outer, ...holes]) => sum + ringArea(outer) - holes.reduce((h, r) => h + ringArea(r), 0),
    0,
  );
}

/** Best spot for a label, in SVG coordinates: `placed` ([x, y] from the feature's optional
 *  "label" property, set by hand where the automatic spot is poor, e.g. G5's thin strip), else
 *  the point deepest inside the largest part (a centroid can fall outside L-shaped zones such as A1). */
export function labelPoint(geometry, placed) {
  if (placed) return [placed[0], -placed[1]];
  const main = polygons(geometry).reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  const [x, y] = polylabel(main, 0.5);
  return [x, -y];
}

/** Bounding box of features in SVG coordinates: {x, y, width, height}. */
export function svgBounds(features) {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const f of features)
    for (const ring of polygons(f.geometry).flat())
      for (const [x, y] of ring) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, -y); y1 = Math.max(y1, -y);
      }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** Ray-casting point-in-polygon on SVG coordinates (used by tests). */
export function contains(geometry, [px, py]) {
  let inside = false;
  for (const poly of polygons(geometry))
    for (const ring of poly)
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = [ring[i][0], -ring[i][1]], [xj, yj] = [ring[j][0], -ring[j][1]];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
  return inside;
}
