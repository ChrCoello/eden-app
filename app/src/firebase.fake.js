// In-memory stand-in for firebase.js, same API. Used by `npm run dev:fake` (and UI tests) to try
// the app without touching the real Firestore. Valid code: "test-garden". Reloading resets it.
import { addDays, isoDay } from "./waterings.js";

// Sample waterings so every colour shows at once: [zone, days ago].
const waterings = [["E1", 1], ["E2", 4], ["E3", 5], ["E4", 6], ["F2", 7], ["F4", 8], ["G3", 12], ["F1", 2]]
  .map(([zone, n]) => ({ zone, by: "Démo", day: addDays(isoDay(), -n), at: new Date() }));
const listeners = new Set();
const delay = () => new Promise((r) => setTimeout(r, 50));

export async function gardenExists(code) {
  await delay();
  return code === "test-garden";
}

export function watchWaterings(code, sinceDay, onChange) {
  const notify = () => onChange(waterings.filter((w) => w.day >= sinceDay));
  listeners.add(notify);
  setTimeout(notify, 0);
  return () => listeners.delete(notify);
}

export async function addWatering(code, { zone, by, day }) {
  await delay();
  waterings.push({ zone, by, day, at: new Date() });
  listeners.forEach((l) => l());
}
