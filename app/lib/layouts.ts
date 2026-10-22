import polyline from "@mapbox/polyline";

import { trimEnds } from "./trim-ends";

export const ART_SIZE = 1000;
const PADDING = 40;
const METRES_PER_DEGREE = 111_320;

// Neither layout shows where routes really are, so the app only ever needs their shapes.
export const LAYOUTS = ["start", "grid"] as const;
export type Layout = (typeof LAYOUTS)[number];

export type LayoutOptions = {
  layout: Layout;
  /** Same start: 1 fits most routes; higher zooms in. */
  zoom: number;
  columns: number;
  rows: number;
  /** Grid: share of each cell left empty around its route, 0–1. */
  spacing: number;
};

type Point = [x: number, y: number];
/** Decoded [latitude, longitude] points. */
export type Route = [number, number][];

/** Routes that can be drawn as a line; `trimMetres` hides that much of each end first. */
export function decodeRoutes(encoded: string[], trimMetres = 0): Route[] {
  return encoded
    .map((line) => {
      try {
        const route = polyline.decode(line);
        return trimMetres > 0 ? trimEnds(route, trimMetres) : route;
      } catch {
        // A malformed line is treated like an activity without a map.
        return [];
      }
    })
    .filter((route) => route.length > 1);
}

/**
 * SVG path data for each route, in the order of `routes`; a grid only draws the first
 * cells' worth. Lines are clipped to the picture's edges, so nothing outside it ends up
 * in a downloaded file.
 */
export function layoutRoutes(
  routes: Route[],
  options: LayoutOptions,
): string[] {
  return place(routes, options).map((points) => toPath(clipToPicture(points)));
}

function place(routes: Route[], options: LayoutOptions): Point[][] {
  if (routes.length === 0) return [];
  switch (options.layout) {
    case "start":
      return sameStart(routes, options.zoom);
    case "grid":
      return grid(routes, options.columns, options.rows, options.spacing);
  }
}

/** Every route begins at the centre, all at one scale, so longer routes reach further. */
function sameStart(routes: Route[], zoom: number): Point[][] {
  const local = routes.map((route) => toMetres(route, route[0]));
  // Fit most routes rather than the single longest, which would shrink everything else.
  const reach = percentile(
    local.map((points) =>
      points.reduce(
        (furthest, [x, y]) => Math.max(furthest, Math.abs(x), Math.abs(y)),
        0,
      ),
    ),
    0.9,
  );
  const scale = ((ART_SIZE / 2 - PADDING) / Math.max(reach, 1)) * zoom;
  const centre = ART_SIZE / 2;
  return local.map((points) =>
    points.map(([x, y]): Point => [centre + x * scale, centre + y * scale]),
  );
}

/** The first `columns` × `rows` routes, each scaled to fill its own cell. */
function grid(
  routes: Route[],
  columns: number,
  rows: number,
  spacing: number,
): Point[][] {
  const cellWidth = ART_SIZE / columns;
  const cellHeight = ART_SIZE / rows;
  return routes.slice(0, columns * rows).map((route, index) => {
    const points = toMetres(route, route[0]);
    const box = bounds(points);
    const scale = Math.min(
      (cellWidth * (1 - spacing)) / Math.max(box.width, 1),
      (cellHeight * (1 - spacing)) / Math.max(box.height, 1),
    );
    const left =
      (index % columns) * cellWidth + (cellWidth - box.width * scale) / 2;
    const top =
      Math.floor(index / columns) * cellHeight +
      (cellHeight - box.height * scale) / 2;
    return points.map(([x, y]): Point => [
      left + (x - box.minX) * scale,
      top + (y - box.minY) * scale,
    ]);
  });
}

/** Metres east and south of `origin`, corrected for latitude so shapes aren't stretched. */
function toMetres(route: Route, [lat0, lng0]: [number, number]): Point[] {
  const xScale = Math.cos((lat0 * Math.PI) / 180) * METRES_PER_DEGREE;
  return route.map(([lat, lng]) => [
    (lng - lng0) * xScale,
    -(lat - lat0) * METRES_PER_DEGREE,
  ]);
}

// Loops rather than Math.min(...points): spreading very long routes can overflow the stack.
function bounds(points: Point[]) {
  let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** The parts of a line inside the picture, as separate runs where it leaves and comes back. */
function clipToPicture(points: Point[]): Point[][] {
  const runs: Point[][] = [];
  for (let i = 1; i < points.length; i++) {
    const segment = clipSegment(points[i - 1], points[i]);
    if (!segment) continue;
    const run = runs.at(-1);
    const last = run?.at(-1);
    if (run && last && last[0] === segment[0][0] && last[1] === segment[0][1]) {
      run.push(segment[1]);
    } else {
      runs.push(segment);
    }
  }
  return runs;
}

/** Liang–Barsky: the part of the segment from `a` to `b` inside the picture, if any. */
function clipSegment(a: Point, b: Point): [Point, Point] | null {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let [enter, exit] = [0, 1];
  const edges: [number, number][] = [
    [-dx, a[0]],
    [dx, ART_SIZE - a[0]],
    [-dy, a[1]],
    [dy, ART_SIZE - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
    } else if (p < 0) {
      enter = Math.max(enter, q / p);
    } else {
      exit = Math.min(exit, q / p);
    }
  }
  if (enter > exit) return null;
  return [
    [a[0] + enter * dx, a[1] + enter * dy],
    [a[0] + exit * dx, a[1] + exit * dy],
  ];
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(fraction * (sorted.length - 1))];
}

function toPath(runs: Point[][]): string {
  return runs
    .map((run) =>
      run
        .map(
          ([x, y], index) =>
            `${index === 0 ? "M" : "L"}${round(x)} ${round(y)}`,
        )
        .join(""),
    )
    .join("");
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
