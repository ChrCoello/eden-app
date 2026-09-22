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

/** Dryness level shown on the map (user's scale, 2026-09-22): 0 = watered 0–4 days ago (green),
 *  then one level per day: 1 = 5 days, 2 = 6, 3 = 7, 4 = 8, 5 = 9 days or more (red).
 *  null = no watering on record. */
const GREEN_DAYS = 4;
const MAX_LEVEL = 5;
export function dryness(lastDay, today = isoDay()) {
  if (!lastDay) return null;
  const n = daysBetween(lastDay, today);
  return Math.min(Math.max(n - GREEN_DAYS, 0), MAX_LEVEL);
}

/** Short day count for a map label: "auj." today, otherwise "6 j". null if never watered. */
export function daysLabel(lastDay, today = isoDay()) {
  if (!lastDay) return null;
  const n = Math.max(daysBetween(lastDay, today), 0);
  return n === 0 ? "auj." : `${n} j`;
}

/** A zone's waterings, most recent first. */
export function zoneHistory(waterings, zone) {
  const time = (w) => w.at?.getTime() ?? Infinity;   // pending entries (no server time yet) are newest
  return waterings
    .filter((w) => w.zone === zone)
    .sort((a, b) => b.day.localeCompare(a.day) || (time(a) === time(b) ? 0 : time(a) < time(b) ? 1 : -1));
}
