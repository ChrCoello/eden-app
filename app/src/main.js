import garden from "../../data/garden.json";
import calibration from "../../data/calibration.json";
import scanUrl from "../../data/map_web.webp";
import { addWatering, gardenExists, watchWaterings } from "./firebase.js";
import { area } from "./geo.js";
import { createMap } from "./map.js";
import {
  addDays, daysLabel, describeDay, dryness, drynessLabels, isoDay, knownNames, latestByZone, zoneHistory,
} from "./waterings.js";
import "./style.css";

const $ = (id) => document.getElementById(id);
const features = new Map(garden.features.map((f) => [f.properties.id, f]));
const HISTORY_DAYS = 365;
const PREVIOUS_SHOWN = 4;

// Per-phone memory. Storage can be unavailable (private mode): the app still works, it just forgets.
const stored = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } },
  remove: (key) => { try { localStorage.removeItem(key); } catch { /* ignore */ } },
};
const CODE_KEY = "eden.gardenCode";
const NAME_KEY = "eden.name";

let gardenCode = stored.get(CODE_KEY);
let waterings = [];
let latest = new Map();
let currentZone = null;
let stopSync = () => {};

// ---- map & zone sheet -------------------------------------------------------------------
const [imgW, imgH] = calibration.image_size;
const [pxX, pxY] = calibration.px_per_m;
const scan = { url: scanUrl, width: imgW / pxX, height: imgH / pxY };
const map = createMap($("map"), garden, scan, showZone);

/** Zones on automatic watering aren't logged by hand. */
const isAuto = (id) => features.get(id).properties.auto === true;

function zoneTitle(id) {
  return features.get(id).properties.kind === "lawn" ? "Pelouse" : id;
}

function showZone(id) {
  currentZone = id;
  $("sheet").hidden = !id;
  if (!id) return;
  const { kind, name } = features.get(id).properties;
  $("zone-id").textContent = zoneTitle(id);
  $("zone-name").textContent = name || (kind === "lawn" ? "" : "Pas encore de nom");
  $("zone-area").textContent = `${Math.round(area(features.get(id).geometry))} m²`;
  $("water").hidden = isAuto(id);
  const [last, ...previous] = isAuto(id) ? [] : zoneHistory(waterings, id);
  $("last-watering").textContent = isAuto(id)
    ? "Arrosage automatique"
    : last ? `Dernier arrosage : ${describeDay(last.day)}, par ${last.by}` : "Aucun arrosage enregistré";
  $("history").replaceChildren(...previous.slice(0, PREVIOUS_SHOWN).map((w) => {
    const li = document.createElement("li");
    li.textContent = `${describeDay(w.day)}, par ${w.by}`;
    return li;
  }));
}

/** Re-derive everything that depends on the data or on today's date. */
function refresh() {
  const today = isoDay();
  map.setDryness(
    (id) => (isAuto(id) ? "auto" : dryness(latest.get(id)?.day, today)),
    // the day count repeats the colour in words: readable whatever your colour vision
    (id) => (isAuto(id) ? null : daysLabel(latest.get(id)?.day, today)),
  );
  if (currentZone) showZone(currentZone);
}
// A phone app stays open for days: "today" moves on while it's in the background.
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

$("legend").prepend(...drynessLabels().map((text, level) => {
  const li = document.createElement("li");
  const swatch = document.createElement("i");
  swatch.dataset.dry = level;
  li.append(swatch, text);
  return li;
}));

$("close").addEventListener("click", () => map.select(null));
$("scan-toggle").addEventListener("click", (e) => {
  const on = e.currentTarget.getAttribute("aria-pressed") !== "true";
  e.currentTarget.setAttribute("aria-pressed", on);
  map.setScanVisible(on);
});

// ---- adding a watering ------------------------------------------------------------------
const dialog = $("water-dialog");

$("water").addEventListener("click", () => {
  $("water-title").textContent = `Arrosage : ${zoneTitle(currentZone)}`;
  $("names").replaceChildren(...knownNames(waterings).map((n) => new Option(n)));
  $("by").value = stored.get(NAME_KEY) ?? "";
  $("day").value = $("day").max = isoDay();
  $("water-error").textContent = "";
  $("water-ok").disabled = false;
  dialog.showModal();
  if (!$("by").value) $("by").focus();
});

$("water-cancel").addEventListener("click", () => dialog.close());

$("water-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const by = $("by").value.trim();
  const day = $("day").value;
  if (!by) return ($("water-error").textContent = "Indiquez votre nom.");
  if (day > isoDay()) return ($("water-error").textContent = "Ce jour n'est pas encore passé.");
  $("water-ok").disabled = true;
  try {
    await addWatering(gardenCode, { zone: currentZone, by, day });
    stored.set(NAME_KEY, by);
    dialog.close();
    toast(`${zoneTitle(currentZone)} : arrosage enregistré`);
  } catch (err) {
    console.error(err);
    $("water-error").textContent = "Échec de l'enregistrement. Vérifiez la connexion et réessayez.";
    $("water-ok").disabled = false;
  }
});

// ---- garden code & sync -----------------------------------------------------------------
function startSync() {
  $("gate").hidden = true;
  stopSync();
  stopSync = watchWaterings(gardenCode, addDays(isoDay(), -HISTORY_DAYS), (list) => {
    waterings = list;
    latest = latestByZone(list);
    refresh();
  }, (err) => {
    console.error(err);
    if (err.code === "permission-denied") return askForCode("Ce code n'est plus valide.");
    toast("Connexion impossible pour le moment.");
  });
}

function askForCode(message = "") {
  stopSync();
  stored.remove(CODE_KEY);
  gardenCode = null;
  $("gate-error").textContent = message;
  $("gate").hidden = false;
  $("code").focus();
}

$("gate-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("code").value.trim();
  const button = e.submitter;
  button.disabled = true;
  $("gate-error").textContent = "";
  try {
    if (code.includes("/") || !(await gardenExists(code))) {   // "/" can't be in a document id
      $("gate-error").textContent = "Code inconnu. Vérifiez l'orthographe.";
      return;
    }
    gardenCode = code;
    stored.set(CODE_KEY, code);
    startSync();
  } catch (err) {
    console.error(err);
    $("gate-error").textContent = "Connexion impossible. Vérifiez le réseau et réessayez.";
  } finally {
    button.disabled = false;
  }
});

let toastTimer;
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3000);
}

if (gardenCode) startSync();
else askForCode();
