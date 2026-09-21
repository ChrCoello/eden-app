import garden from "../../data/garden.json";
import calibration from "../../data/calibration.json";
import scanUrl from "../../data/map_web.webp";
import { area } from "./geo.js";
import { createMap } from "./map.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const features = new Map(garden.features.map((f) => [f.properties.id, f]));

const [imgW, imgH] = calibration.image_size;
const [pxX, pxY] = calibration.px_per_m;
const scan = { url: scanUrl, width: imgW / pxX, height: imgH / pxY };

const map = createMap($("map"), garden, scan, showZone);

function showZone(id) {
  const sheet = $("sheet");
  sheet.hidden = !id;
  if (!id) return;
  const { kind, name } = features.get(id).properties;
  $("zone-id").textContent = kind === "lawn" ? "Pelouse" : id;
  $("zone-name").textContent = name || (kind === "lawn" ? "" : "Pas encore de nom");
  $("zone-area").textContent = `${Math.round(area(features.get(id).geometry))} m²`;
}

$("close").addEventListener("click", () => map.select(null));
$("fit").addEventListener("click", () => map.fit());
$("scan-toggle").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", on);
  map.setScanVisible(on);
});
