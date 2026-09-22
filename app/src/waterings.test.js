import { describe, expect, test } from "vitest";
import { addDays, describeDay, dryness, isoDay, knownNames, latestByZone, zoneHistory } from "./waterings.js";

describe("days", () => {
  test("isoDay uses the local calendar day, zero-padded", () => {
    expect(isoDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  test("addDays crosses month and year boundaries", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2025-12-31", 1)).toBe("2026-01-01");
  });

  test.each([
    ["2026-09-21", "aujourd'hui"],
    ["2026-09-20", "hier"],
    ["2026-09-18", "il y a 3 jours"],
    ["2026-09-15", "il y a 6 jours"],
    ["2026-09-14", "le 14 sept."],
    ["2025-08-12", "le 12 août 2025"],
  ])("describeDay(%s) on 2026-09-21 → %s", (day, text) => {
    expect(describeDay(day, "2026-09-21")).toBe(text);
  });

  test("describeDay handles daylight-saving changes", () => {
    expect(describeDay("2026-03-28", "2026-03-30")).toBe("il y a 2 jours");
  });
});

describe("latestByZone", () => {
  const at = (h) => new Date(2026, 8, 21, h);

  test("latest day wins, whatever the entry order", () => {
    const latest = latestByZone([
      { zone: "B3", by: "Papa", day: "2026-09-21", at: at(8) },
      { zone: "B3", by: "Chris", day: "2026-09-19", at: at(20) },
      { zone: "A1", by: "Papa", day: "2026-09-10", at: at(9) },
    ]);
    expect(latest.get("B3").by).toBe("Papa");
    expect(latest.get("A1").day).toBe("2026-09-10");
    expect(latest.has("C1")).toBe(false);
  });

  test("same day: the latest entry wins; a pending entry (at = null) counts as newest", () => {
    const latest = latestByZone([
      { zone: "B3", by: "Papa", day: "2026-09-21", at: at(8) },
      { zone: "B3", by: "Chris", day: "2026-09-21", at: null },
    ]);
    expect(latest.get("B3").by).toBe("Chris");
  });
});

test("knownNames: most used first, then alphabetical", () => {
  const w = (by) => ({ zone: "A1", by, day: "2026-09-21", at: null });
  expect(knownNames([w("Chris"), w("Papa"), w("Papa"), w("Anna")])).toEqual(["Papa", "Anna", "Chris"]);
});

test.each([
  [null, null],
  ["2026-09-21", 0],
  ["2026-09-20", 1],
  ["2026-09-19", 1],
  ["2026-09-18", 2],
  ["2026-09-15", 2],
  ["2026-09-14", 3],
  ["2025-01-01", 3],
])("dryness(%s) on 2026-09-21 → %s", (day, level) => {
  expect(dryness(day, "2026-09-21")).toBe(level);
});

test("zoneHistory: only that zone, most recent day first, then latest entry", () => {
  const w = (zone, by, day, h) => ({ zone, by, day, at: h == null ? null : new Date(2026, 8, 21, h) });
  const history = zoneHistory([
    w("B3", "a", "2026-09-10", 9),
    w("A1", "x", "2026-09-21", 9),
    w("B3", "b", "2026-09-21", 8),
    w("B3", "c", "2026-09-21", 18),
    w("B3", "d", "2026-09-21", null),
    w("B3", "e", "2026-09-21", null),
  ], "B3");
  expect(history.map((h) => h.by)).toEqual(["d", "e", "c", "b", "a"]);
});
