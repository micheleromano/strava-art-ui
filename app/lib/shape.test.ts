import { describe, expect, it } from "vitest";

import polyline from "@mapbox/polyline";

import { decodeRoutes, layoutRoutes, SQUARE } from "./layouts";
import { toShape } from "./shape";

// A square-ish loop in London: 1 km north, then 1 km east (0.0144° of longitude at 51.5°N).
const london: [number, number][] = [
  [51.5, -0.1],
  [51.509, -0.1],
  [51.509, -0.0856],
];

describe("toShape", () => {
  it("starts every shape at 0, 0, so the real place is gone", () => {
    expect(toShape(london)[0]).toEqual([0, 0]);
  });

  it("draws exactly like the real route", () => {
    const options = {
      layout: "grid" as const,
      frame: SQUARE,
      zoom: 1,
      columns: 1,
      rows: 1,
      spacing: 0.1,
    };
    const draw = (route: [number, number][]) =>
      layoutRoutes(decodeRoutes([polyline.encode(route)]), options);
    const coordinates = (paths: string[]) =>
      paths
        .join(" ")
        .match(/-?[\d.]+/g)
        ?.map(Number) ?? [];
    const real = coordinates(draw(london));
    const shape = coordinates(draw(toShape(london)));
    // Encoding rounds to about a metre, a fraction of a pixel here.
    expect(shape).toHaveLength(real.length);
    shape.forEach((value, index) => expect(value).toBeCloseTo(real[index], 0));
  });
});
