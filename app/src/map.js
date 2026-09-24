// The garden map: SVG built from garden.json, with pan, pinch-zoom and tap-to-select.
import { labelPoint, svgBounds, svgPath } from "./geo.js";

const NS = "http://www.w3.org/2000/svg";
const TAP_SLOP = 10;        // px a finger may move and still count as a tap
const LABEL_PX = 13;        // label size on screen, whatever the zoom
const MAX_PX_PER_M = 60;
const DROP = "M12 2.5C9 7 5.5 10.6 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10.6 15 7 12 2.5Z";   // same as the 💧 button

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  parent?.append(node);
  return node;
}

/**
 * @param {SVGSVGElement} svg
 * @param {object} garden     GeoJSON FeatureCollection (local meters)
 * @param {object} scan       {url, width, height} of the background plan, in meters
 * @param {(id: string|null) => void} onSelect
 */
export function createMap(svg, garden, scan, onSelect) {
  const view = el("g", {}, svg);
  const scanImg = el("image", { href: scan.url, width: scan.width, height: scan.height, class: "scan" }, view);
  const shapes = el("g", {}, view);
  // Robinets (water taps): drawn in screen pixels, so each is scaled by 1 / k in apply(). Display only,
  // under the zone labels (which carry the day counts).
  const taps = el("g", { class: "robinets" }, view);
  const robinets = (garden.robinets ?? []).map(({ name, at: [x, y] }) => {
    const g = el("g", { class: "robinet" }, taps);
    el("circle", { r: 9 }, g);
    el("path", { d: DROP, transform: "scale(0.6) translate(-12 -11.75)" }, g);
    if (name) el("text", { y: -14 }, g).textContent = name;
    return [g, x, -y];
  });
  const labels = el("g", { class: "labels" }, view);

  const byId = new Map();
  const labelById = new Map();
  for (const f of garden.features) {
    const { id, kind } = f.properties;
    const shape = el("path", { d: svgPath(f.geometry), "fill-rule": "evenodd", class: `shape ${kind}` }, shapes);
    if (kind === "path" || kind === "chemin") continue;     // not tappable, no label
    shape.dataset.id = id;
    const [x, y] = labelPoint(f.geometry);
    if (kind === "zone") labelById.set(id, el("text", { x, y, class: "label" }, labels));
    byId.set(id, shape);
  }

  // ---- view transform: screen = world * k + (tx, ty) --------------------------------
  // North-up. Rotating was measured: the garden (~190 m wide × 230 m tall) fits a portrait phone
  // best as is; a quarter-turn makes it 16% smaller.
  let k = 1, tx = 0, ty = 0, minK = 0.1;
  const home = svgBounds(garden.features.filter((f) => f.properties.kind !== "path"));

  function apply() {
    view.setAttribute("transform", `translate(${tx} ${ty}) scale(${k})`);
    labels.style.fontSize = `${LABEL_PX / k}px`;
    labels.style.strokeWidth = `${3 / k}px`;    // halo around labels, constant on screen too
    for (const [g, x, y] of robinets) g.setAttribute("transform", `translate(${x} ${y}) scale(${1 / k})`);
  }
  function fit(b = home, pad = 12) {
    const { width, height } = svg.getBoundingClientRect();
    k = Math.min((width - 2 * pad) / b.width, (height - 2 * pad) / b.height);
    minK = k * 0.8;
    tx = (width - b.width * k) / 2 - b.x * k;
    ty = (height - b.height * k) / 2 - b.y * k;
    apply();
  }
  function zoomAt(sx, sy, factor) {
    const nk = Math.min(Math.max(k * factor, minK), MAX_PX_PER_M);
    tx = sx - ((sx - tx) * nk) / k;
    ty = sy - ((sy - ty) * nk) / k;
    k = nk;
    apply();
  }

  // ---- gestures ------------------------------------------------------------------------
  const pointers = new Map();
  let gesture = null;   // {startX, startY, target, multi}
  const local = (e) => {
    const r = svg.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const pinch = () => {
    const [a, b] = [...pointers.values()];
    return { mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], dist: Math.hypot(a[0] - b[0], a[1] - b[1]) };
  };

  svg.addEventListener("pointerdown", (e) => {
    svg.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      const [x, y] = local(e);
      gesture = { startX: x, startY: y, target: e.target.closest("[data-id]"), multi: false };
    } else if (gesture) {
      gesture.multi = true;
    }
  });
  svg.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    const before = pointers.size === 2 ? pinch() : null;
    const [px, py] = pointers.get(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (before) {
      const after = pinch();
      tx += after.mid[0] - before.mid[0];
      ty += after.mid[1] - before.mid[1];
      zoomAt(after.mid[0], after.mid[1], after.dist / before.dist);
    } else if (pointers.size === 1) {
      const [x, y] = pointers.get(e.pointerId);
      tx += x - px;
      ty += y - py;
      apply();
    }
  });
  const release = (e) => {
    if (!pointers.delete(e.pointerId) || pointers.size || !gesture) return;
    const [x, y] = local(e);
    const tap = !gesture.multi && Math.hypot(x - gesture.startX, y - gesture.startY) < TAP_SLOP;
    if (tap && e.type === "pointerup") select(gesture.target?.dataset.id ?? null);
    gesture = null;
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    const [x, y] = local(e);
    zoomAt(x, y, Math.exp(-e.deltaY * 0.002));
  }, { passive: false });
  // Re-fit when the phone is turned only: height also changes when a phone's address bar hides.
  let fittedWidth = 0;
  new ResizeObserver(() => {
    const { width } = svg.getBoundingClientRect();
    if (width && width !== fittedWidth) { fittedWidth = width; fit(); }
  }).observe(svg);

  // Zone name, plus an optional smaller second line; the pair stays centred on the label point.
  function setLabel(text, name, note) {
    const x = text.getAttribute("x");
    const line = (content, attrs) => {
      const t = el("tspan", { x, ...attrs });
      t.textContent = content;
      return t;
    };
    text.replaceChildren(line(name, note ? { dy: "-0.55em" } : {}));
    if (note) text.append(line(note, { dy: "1.15em", class: "note" }));
  }
  for (const [id, text] of labelById) setLabel(text, id, null);

  // ---- selection -----------------------------------------------------------------------
  let selected = null;
  function select(id) {
    byId.get(selected)?.classList.remove("selected");
    selected = byId.has(id) ? id : null;
    const shape = byId.get(selected);
    shape?.classList.add("selected");
    shape?.parentNode.append(shape);           // draw the outline above its neighbours
    onSelect(selected);
  }

  return {
    select,
    /** Colour zones and caption their labels: levelOf(id) → dryness 0..5, null for "never
     *  watered", or "auto"; noteOf(id) → a second label line (e.g. "6 j"), or null for none. */
    setDryness(levelOf, noteOf = () => null) {
      for (const [id, shape] of byId) shape.dataset.dry = levelOf(id) ?? "never";
      for (const [id, text] of labelById) setLabel(text, id, noteOf(id));
    },
    fit: () => fit(),
    setScanVisible: (on) => scanImg.classList.toggle("visible", on),
  };
}
