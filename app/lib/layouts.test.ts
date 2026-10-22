import polyline from "@mapbox/polyline";
import { describe, expect, it } from "vitest";

import {
  ART_SIZE,
  decodeRoutes,
  layoutRoutes,
  type LayoutOptions,
  type Route,
} from "./layouts";

const options: LayoutOptions = {
  layout: "start",
  zoom: 1,
  columns: 2,
  rows: 2,
  spacing: 0.1,
};

const points = (path: string) =>
  [...path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [
    Number(x),
    Number(y),
  ]);

// Two routes in different cities, heading north-east and south.
const london: Route = [
  [51.5, -0.1],
  [51.51, -0.09],
];
const paris: Route = [
  [48.85, 2.35],
  [48.84, 2.35],
];

describe("decodeRoutes", () => {
  it("leaves out routes that can't be drawn as a line", () => {
    const line = polyline.encode([
      [51.5, 0],
      [51.6, 0],
    ]);
    expect(decodeRoutes(["", polyline.encode([[51.5, 0]]), line])).toHaveLength(
      1,
    );
  });
});

describe("same start", () => {
  it("starts every route at the centre, however far apart they really are", () => {
    for (const path of layoutRoutes([london, paris], options)) {
      expect(points(path)[0]).toEqual([ART_SIZE / 2, ART_SIZE / 2]);
    }
  });

  it("draws north at the top", () => {
    const [north, south] = layoutRoutes([london, paris], options).map(
      (path) => points(path)[1][1],
    );
    expect(north).toBeLessThan(ART_SIZE / 2);
    expect(south).toBeGreaterThan(ART_SIZE / 2);
  });

  it("zooms in with a larger zoom", () => {
    const reach = (zoom: number) =>
      points(layoutRoutes([london], { ...options, zoom })[0])[1][0] -
      ART_SIZE / 2;
    // Zoomed out, so nothing is clipped at the edge.
    expect(reach(0.5)).toBeCloseTo(reach(0.25) * 2, 0);
  });

  it("keeps every drawn point inside the picture, even zoomed right in", () => {
    const far: Route = [
      [51.5, -0.1],
      [51.6, -0.1],
    ];
    for (const [x, y] of layoutRoutes([london, far], {
      ...options,
      zoom: 4,
    }).flatMap(points)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(ART_SIZE);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(ART_SIZE);
    }
  });
});

describe("grid", () => {
  const grid = { ...options, layout: "grid" as const };

  it("draws only as many routes as there are cells, starting with the first", () => {
    const routes = Array.from({ length: 6 }, () => london);
    expect(layoutRoutes(routes, grid)).toHaveLength(4);
  });

  it("fills each route's own cell", () => {
    const [first, second] = layoutRoutes([london, paris], grid).map(points);
    const extent = (values: number[]) =>
      Math.max(...values) - Math.min(...values);
    const span = (path: number[][]) =>
      Math.max(extent(path.map(([x]) => x)), extent(path.map(([, y]) => y)));
    // Cells are 500 square; with 10% spacing each route's longer side spans 450.
    expect(span(first)).toBeCloseTo(450, 0);
    expect(span(second)).toBeCloseTo(450, 0);
    // The second route sits in the top-right cell.
    for (const [x, y] of second) {
      expect(x).toBeGreaterThanOrEqual(500);
      expect(y).toBeLessThanOrEqual(500);
    }
  });
});
