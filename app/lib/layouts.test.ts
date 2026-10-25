import polyline from "@mapbox/polyline";
import { describe, expect, it } from "vitest";

import {
  ART_SIZE,
  decodeRoutes,
  frameFor,
  layoutRoutes,
  previewPath,
  SQUARE,
  type LayoutOptions,
  type Route,
} from "./layouts";

const options: LayoutOptions = {
  layout: "start",
  frame: SQUARE,
  zoom: 1,
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

describe("rotation", () => {
  // Heads due north from its start.
  const north: Route = [
    [51.5, -0.1],
    [51.51, -0.1],
  ];

  it("turns a route clockwise around its start", () => {
    const [[startX, startY], [endX, endY]] = points(
      layoutRoutes([north], options, [90])[0],
    );
    expect([startX, startY]).toEqual([ART_SIZE / 2, ART_SIZE / 2]);
    // North turned 90° clockwise points east: right of the start, level with it.
    expect(endX).toBeGreaterThan(startX);
    expect(endY).toBeCloseTo(startY, 0);
  });

  it("only turns the routes it's given an angle for", () => {
    const [turned, unturned] = layoutRoutes([north, north], options, [180]);
    expect(points(turned)[1][1]).toBeGreaterThan(ART_SIZE / 2);
    expect(points(unturned)[1][1]).toBeLessThan(ART_SIZE / 2);
  });

  it("refits a turned route to its preview square", () => {
    const [[x1, y1], [x2, y2]] = points(previewPath(north, 90));
    // Now horizontal, it spans 85% of the square's width instead of its height.
    expect(Math.abs(x2 - x1)).toBeCloseTo(850, 0);
    expect(y2).toBeCloseTo(y1, 0);
  });
});

describe("chain", () => {
  const chain = { ...options, layout: "chain" as const };
  // Ten identical routes heading 1 km north: joined in a straight line they'd be tiny.
  const north: Route = [
    [51.5, -0.1],
    [51.505, -0.1],
    [51.509, -0.1],
  ];
  const routes = Array.from({ length: 10 }, () => north);

  it("starts each route where the one before it finished, oldest first", () => {
    const drawn = layoutRoutes(routes, chain).map(points);
    // Routes arrive newest first, so each route continues from the next one in the list.
    for (let i = 0; i < drawn.length - 1; i++) {
      const newerStart = drawn[i][0];
      const olderEnd = drawn[i + 1].at(-1)!;
      expect(newerStart[0]).toBeCloseTo(olderEnd[0], 0);
      expect(newerStart[1]).toBeCloseTo(olderEnd[1], 0);
    }
  });

  it("turns routes so the chain stays compact and each route stays large", () => {
    for (const path of layoutRoutes(routes, chain).map(points)) {
      const [[x1, y1], [x2, y2]] = [path[0], path.at(-1)!];
      // A straight chain of ten would make each route under 100 across.
      expect(Math.hypot(x2 - x1, y2 - y1)).toBeGreaterThan(300);
    }
  });

  it("keeps the whole chain inside the picture", () => {
    for (const [x, y] of layoutRoutes(routes, chain).flatMap(points)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(ART_SIZE);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(ART_SIZE);
    }
  });
});

describe("screen-shaped frames", () => {
  const wide = frameFor(1920, 1080);
  const tall = frameFor(1170, 2532);
  const routes = [london, paris];

  it("keeps the short side and stretches the long side to the screen's proportions", () => {
    expect(wide).toEqual({ width: 1778, height: ART_SIZE });
    expect(tall).toEqual({ width: ART_SIZE, height: 2164 });
  });

  const inside = (drawn: number[][]) => {
    for (const [x, y] of drawn) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(wide.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(wide.height);
    }
  };

  it("starts every route at the middle of a wide picture", () => {
    const drawn = layoutRoutes(routes, { ...options, frame: wide }).map(points);
    inside(drawn.flat());
    for (const route of drawn) {
      expect(route[0]).toEqual([wide.width / 2, wide.height / 2]);
    }
  });

  it("centres the chain in a wide picture", () => {
    const drawn = layoutRoutes(routes, {
      ...options,
      layout: "chain",
      frame: wide,
    }).flatMap(points);
    inside(drawn);
    const xs = drawn.map(([x]) => x);
    const middle = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(middle).toBeCloseTo(wide.width / 2, 0);
  });
});
