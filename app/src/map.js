// The garden map: SVG built from garden.json, with pan, pinch-zoom and tap-to-select.
import { labelPoint, svgBounds, svgPath } from "./geo.js";

const NS = "http://www.w3.org/2000/svg";
const TAP_SLOP = 10;        // px a finger may move and still count as a tap
const LABEL_PX = 13;        // label size on screen, whatever the zoom
const MAX_PX_PER_M = 60;
// Tap icon of the robinets, 24×24, fill-rule evenodd: traced from data/751924.png (user's choice).
const TAP = "M20.07 23.95C19.11 23.76 18.38 22.84 18.38 21.84C18.38 21.41 18.85 20.34 19.50 19.31C19.93 18.64 19.99 18.56 20.17 18.46C20.31 18.38 20.27 18.38 18.92 18.38C17.58 18.38 17.51 18.37 17.34 18.28C17.01 18.09 16.97 17.94 16.97 16.97C16.97 15.98 16.92 15.82 16.59 15.66C16.43 15.57 16.32 15.56 15.55 15.56L14.69 15.56L14.55 15.70C14.16 16.12 13.23 16.61 12.48 16.82C12.08 16.92 11.93 16.94 11.30 16.94C10.66 16.94 10.51 16.92 10.12 16.82C9.36 16.61 8.44 16.12 8.04 15.70L7.90 15.56L6.00 15.56L4.10 15.56L3.94 15.87C3.68 16.38 3.12 16.79 2.54 16.92C2.40 16.95 1.90 16.97 1.42 16.97C0.43 16.97 0.29 16.93 0.10 16.59C0.00 16.42 -0.00 16.41 -0.00 12.05C-0.00 7.68 0.00 7.68 0.10 7.50C0.29 7.17 0.43 7.12 1.42 7.12C1.90 7.12 2.40 7.15 2.54 7.18C3.12 7.30 3.68 7.72 3.94 8.23L4.10 8.53L6.00 8.53L7.90 8.53L8.04 8.39C8.20 8.23 8.94 7.71 9.09 7.67C9.19 7.63 9.19 7.61 9.19 6.28L9.19 4.92L8.89 4.92C8.48 4.92 8.25 4.99 7.67 5.26C6.90 5.61 6.43 5.69 5.79 5.55C4.52 5.29 3.56 4.11 3.56 2.81C3.56 1.52 4.52 0.34 5.79 0.07C6.43 -0.06 6.90 0.01 7.67 0.37C7.95 0.50 8.27 0.63 8.39 0.65C8.68 0.72 13.92 0.72 14.20 0.65C14.32 0.63 14.64 0.50 14.92 0.37C15.70 0.01 16.16 -0.06 16.80 0.07C18.07 0.34 19.03 1.52 19.03 2.81C19.03 4.11 18.07 5.29 16.80 5.55C16.16 5.69 15.70 5.61 14.92 5.26C14.34 4.99 14.11 4.92 13.70 4.92L13.41 4.92L13.41 6.28C13.41 7.61 13.41 7.63 13.50 7.67C13.65 7.71 14.40 8.23 14.55 8.39L14.69 8.53L16.36 8.53C18.17 8.53 18.70 8.58 19.41 8.78C21.49 9.39 23.14 11.04 23.75 13.12C23.95 13.83 24.00 14.36 24.00 16.17C24.00 17.77 24.00 17.83 23.90 18.00C23.85 18.10 23.72 18.22 23.62 18.28C23.46 18.37 23.39 18.38 22.05 18.38C20.70 18.38 20.65 18.38 20.80 18.46C20.98 18.56 21.04 18.64 21.46 19.31C22.12 20.34 22.59 21.41 22.59 21.84C22.59 23.19 21.37 24.21 20.07 23.95ZM20.81 22.50C21.06 22.37 21.21 22.09 21.17 21.82C21.13 21.57 20.57 20.46 20.49 20.46C20.40 20.46 19.84 21.57 19.80 21.82C19.74 22.21 20.07 22.59 20.47 22.59C20.56 22.59 20.71 22.55 20.81 22.50ZM22.59 15.75C22.59 15.08 22.57 14.37 22.54 14.19C22.22 12.00 20.53 10.32 18.34 9.99C18.15 9.96 17.23 9.94 16.15 9.94C14.96 9.94 14.26 9.92 14.17 9.89C14.10 9.86 13.91 9.72 13.76 9.57C13.28 9.11 12.85 8.86 12.23 8.67C11.73 8.51 10.86 8.51 10.36 8.67C9.74 8.86 9.31 9.11 8.84 9.57C8.68 9.72 8.49 9.86 8.42 9.89C8.34 9.92 7.58 9.94 6.25 9.94L4.22 9.94L4.22 12.05L4.22 14.16L6.25 14.16C7.58 14.16 8.34 14.17 8.42 14.21C8.49 14.23 8.68 14.38 8.84 14.53C9.31 14.98 9.74 15.24 10.36 15.43C10.86 15.59 11.73 15.59 12.23 15.43C12.85 15.24 13.28 14.98 13.76 14.53C13.91 14.38 14.10 14.23 14.17 14.21C14.34 14.14 16.31 14.14 16.65 14.20C17.28 14.32 17.88 14.78 18.14 15.34C18.31 15.71 18.38 16.02 18.38 16.55L18.38 16.97L20.48 16.97L22.59 16.97L22.59 15.75ZM2.44 15.47C2.56 15.41 2.66 15.31 2.72 15.19C2.81 15.01 2.81 14.92 2.81 12.05C2.81 9.18 2.81 9.08 2.72 8.91C2.58 8.63 2.35 8.53 1.83 8.53L1.41 8.53L1.41 12.05L1.41 15.56L1.83 15.56C2.16 15.56 2.29 15.54 2.44 15.47ZM12.00 5.61C12.00 4.13 12.00 4.06 12.10 3.89C12.28 3.57 12.45 3.52 13.28 3.52C14.31 3.52 14.65 3.59 15.49 3.98C15.90 4.17 16.00 4.19 16.27 4.19C16.79 4.19 17.27 3.87 17.50 3.38C17.64 3.08 17.64 2.55 17.50 2.24C17.27 1.75 16.79 1.43 16.27 1.43C16.00 1.43 15.90 1.46 15.49 1.65C14.50 2.11 14.50 2.11 11.30 2.11C8.10 2.11 8.10 2.11 7.10 1.65C6.69 1.46 6.59 1.43 6.33 1.43C5.80 1.43 5.32 1.75 5.09 2.24C4.96 2.55 4.96 3.08 5.09 3.38C5.32 3.87 5.80 4.19 6.33 4.19C6.59 4.19 6.69 4.17 7.10 3.98C7.94 3.59 8.29 3.52 9.32 3.52C10.15 3.52 10.31 3.57 10.49 3.89C10.59 4.06 10.59 4.13 10.59 5.61L10.59 7.15L11.30 7.15L12.00 7.15L12.00 5.61Z";

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
    el("circle", { r: 11 }, g);
    el("path", { d: TAP, "fill-rule": "evenodd", transform: "scale(0.72) translate(-12 -12)" }, g);
    if (name) el("text", { y: -16 }, g).textContent = name;
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
