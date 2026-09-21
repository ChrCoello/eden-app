import { describe, expect, test } from "vitest";
import garden from "../../data/garden.json";
import { area, contains, labelPoint, svgBounds, svgPath } from "./geo.js";

const square = { type: "Polygon", coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]] };
const withHole = {
  type: "Polygon",
  coordinates: [square.coordinates[0], [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
};

describe("geometry helpers", () => {
  test("svgPath flips y and closes each ring", () => {
    expect(svgPath(square)).toBe("M0,0L10,0L10,-10L0,-10Z");
  });

  test("area subtracts holes", () => {
    expect(area(square)).toBe(100);
    expect(area(withHole)).toBe(96);
  });

  test("svgBounds is in SVG space (y down)", () => {
    expect(svgBounds([{ geometry: square }])).toEqual({ x: 0, y: -10, width: 10, height: 10 });
  });

  test("contains handles holes", () => {
    expect(contains(withHole, [2, -2])).toBe(true);
    expect(contains(withHole, [5, -5])).toBe(false);
  });
});

describe("garden.json", () => {
  const zones = garden.features.filter((f) => f.properties.kind === "zone");

  test("has the 35 pencil zones with unique ids", () => {
    const ids = zones.map((f) => f.properties.id);
    expect(ids).toHaveLength(35);
    expect(new Set(ids).size).toBe(35);
  });

  test.each(garden.features.map((f) => [f.properties.id, f]))("label of %s sits inside it", (_, f) => {
    expect(contains(f.geometry, labelPoint(f.geometry))).toBe(true);
  });
});
