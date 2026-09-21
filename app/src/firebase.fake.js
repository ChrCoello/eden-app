// In-memory stand-in for firebase.js, same API. Used by `vite --mode fake` for UI tests
// without touching the real Firestore. Valid code: "test-garden".
const waterings = [];
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
