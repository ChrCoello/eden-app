// Pure watering logic: no Firebase here, so it's unit-testable.
// A watering is {zone, by, day: "YYYY-MM-DD" (local calendar day), at: Date|null}.

/** Local calendar day as YYYY-MM-DD (toISOString would use UTC and shift late evenings). */
export function isoDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day, n) {
  const [y, m, d] = day.split("-").map(Number);
  return isoDay(new Date(y, m - 1, d + n));
}

function daysBetween(from, to) {
  const utc = (day) => Date.UTC(...day.split("-").map((v, i) => Number(v) - (i === 1 ? 1 : 0)));
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Latest watering per zone: latest day wins, then latest entry that day. */
export function latestByZone(waterings) {
  const latest = new Map();
  for (const w of waterings) {
    const cur = latest.get(w.zone);
    if (!cur || w.day > cur.day || (w.day === cur.day && (w.at ?? Infinity) > (cur.at ?? Infinity))) {
      latest.set(w.zone, w);
    }
  }
  return latest;
}

/** Names already used, most frequent first, for the name suggestions. */
export function knownNames(waterings) {
  const counts = new Map();
  for (const { by } of waterings) counts.set(by, (counts.get(by) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}

const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** "aujourd'hui", "hier", "il y a 3 jours", "le 12 août", "le 12 août 2025". */
export function describeDay(day, today = isoDay()) {
  const n = daysBetween(day, today);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return "hier";
  if (n > 1 && n < 7) return `il y a ${n} jours`;
  const [y, m, d] = day.split("-").map(Number);
  return `le ${d} ${MONTHS[m - 1]}${y === Number(today.slice(0, 4)) ? "" : ` ${y}`}`;
}

/** Dryness level shown on the map: 0 = watered today, 1 = 1–2 days ago, 2 = 3–6 days,
 *  3 = a week or more, null = no watering on record. */
export function dryness(lastDay, today = isoDay()) {
  if (!lastDay) return null;
  const n = daysBetween(lastDay, today);
  return n <= 0 ? 0 : n <= 2 ? 1 : n <= 6 ? 2 : 3;
}

/** A zone's waterings, most recent first. */
export function zoneHistory(waterings, zone) {
  const time = (w) => w.at?.getTime() ?? Infinity;   // pending entries (no server time yet) are newest
  return waterings
    .filter((w) => w.zone === zone)
    .sort((a, b) => b.day.localeCompare(a.day) || (time(a) === time(b) ? 0 : time(a) < time(b) ? 1 : -1));
}
