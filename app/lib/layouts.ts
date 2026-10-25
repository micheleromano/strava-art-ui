import polyline from "@mapbox/polyline";

import { trimEnds } from "./trim-ends";

/** The picture's short side, in drawing units; the long side scales to match its shape. */
export const ART_SIZE = 1000;
const PADDING = 40;
const METRES_PER_DEGREE = 111_320;

// Neither layout shows where routes really are, so the app only ever needs their shapes.
export const LAYOUTS = ["start", "chain"] as const;
export type Layout = (typeof LAYOUTS)[number];

// Every layout the studio offers. The globe isn't drawn as lines, so it's not in LAYOUTS:
// it shows rounded places on a 3D globe instead (see app/lib/places.ts).
export const ART_LAYOUTS = [...LAYOUTS, "globe"] as const;
export type ArtLayout = (typeof ART_LAYOUTS)[number];

export type Frame = { width: number; height: number };

export const SQUARE: Frame = { width: ART_SIZE, height: ART_SIZE };

/** A frame with the proportions of a `width` × `height` screen, its short side ART_SIZE. */
export function frameFor(width: number, height: number): Frame {
  return width >= height
    ? { width: Math.round((ART_SIZE * width) / height), height: ART_SIZE }
    : { width: ART_SIZE, height: Math.round((ART_SIZE * height) / width) };
}

export type LayoutOptions = {
  layout: Layout;
  frame: Frame;
  /** Same start and chain: 1 fits the picture; higher zooms in. */
  zoom: number;
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
 * SVG path data for each route, in the order of `routes`. Lines are clipped to the picture's edges, so nothing outside it ends up
 * in a downloaded file.
 */
export function layoutRoutes(
  routes: Route[],
  options: LayoutOptions,
  /** Degrees clockwise for each route, in the order of `routes`; missing means 0. */
  rotations: number[] = [],
): string[] {
  const shapes = routes.map((route, index) =>
    rotate(toMetres(route, route[0]), rotations[index] ?? 0),
  );
  return place(shapes, options).map((points) =>
    toPath(clipToPicture(points, options.frame)),
  );
}

function place(shapes: Point[][], options: LayoutOptions): Point[][] {
  if (shapes.length === 0) return [];
  switch (options.layout) {
    case "start":
      return sameStart(shapes, options.frame, options.zoom);
    case "chain":
      return chain(shapes, options.frame, options.zoom);
  }
}

/** Every route begins at the centre, all at one scale, so longer routes reach further. */
function sameStart(local: Point[][], frame: Frame, zoom: number): Point[][] {
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
  // Fits the short side, so routes reach the same way in every direction.
  const radius = Math.min(frame.width, frame.height) / 2 - PADDING;
  const scale = (radius / Math.max(reach, 1)) * zoom;
  const [centreX, centreY] = [frame.width / 2, frame.height / 2];
  return local.map((points) =>
    points.map(([x, y]): Point => [centreX + x * scale, centreY + y * scale]),
  );
}

/** One route on its own, turned by `rotation` degrees and fitted to a square: the route list's previews. */
export function previewPath(route: Route, rotation: number): string {
  const points = rotate(toMetres(route, route[0]), rotation);
  const box = bounds(points);
  const scale = (ART_SIZE * 0.85) / Math.max(box.width, box.height, 1);
  const left = (ART_SIZE - box.width * scale) / 2;
  const top = (ART_SIZE - box.height * scale) / 2;
  return toPath([
    points.map(([x, y]): Point => [
      left + (x - box.minX) * scale,
      top + (y - box.minY) * scale,
    ]),
  ]);
}

/** Metres east and south of `origin`, corrected for latitude so shapes aren't stretched. */
function toMetres(route: Route, [lat0, lng0]: [number, number]): Point[] {
  const xScale = Math.cos((lat0 * Math.PI) / 180) * METRES_PER_DEGREE;
  return route.map(([lat, lng]) => [
    (lng - lng0) * xScale,
    -(lat - lat0) * METRES_PER_DEGREE,
  ]);
}

// Chain: the angles tried for each route, every 15°.
const CHAIN_ANGLES = Array.from({ length: 24 }, (_, index) => index * 15);

type Box = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * Routes joined end to start, oldest first. Each is turned to whichever angle keeps
 * the chain most compact so far, then the whole chain is scaled to fill the picture.
 */
function chain(shapes: Point[][], frame: Frame, zoom: number): Point[][] {
  const placed: Point[][] = new Array(shapes.length);
  let end: Point = [0, 0];
  let box: Box | null = null;
  // Shapes arrive newest first; the chain runs oldest first.
  for (let index = shapes.length - 1; index >= 0; index--) {
    let best: { points: Point[]; box: Box; size: number } | null = null;
    for (const angle of CHAIN_ANGLES) {
      const points = rotate(shapes[index], angle).map(([x, y]): Point => [
        x + end[0],
        y + end[1],
      ]);
      const own = bounds(points);
      const grown: Box = box
        ? {
            minX: Math.min(box.minX, own.minX),
            minY: Math.min(box.minY, own.minY),
            maxX: Math.max(box.maxX, own.maxX),
            maxY: Math.max(box.maxY, own.maxY),
          }
        : own;
      // Relative to the frame, so a wide picture favours a wide chain.
      const size = Math.max(
        (grown.maxX - grown.minX) / frame.width,
        (grown.maxY - grown.minY) / frame.height,
      );
      if (!best || size < best.size) best = { points, box: grown, size };
    }
    placed[index] = best!.points;
    box = best!.box;
    end = best!.points[best!.points.length - 1];
  }

  const { minX, minY, maxX, maxY } = box!;
  const scale =
    Math.min(
      (frame.width - 2 * PADDING) / Math.max(maxX - minX, 1),
      (frame.height - 2 * PADDING) / Math.max(maxY - minY, 1),
    ) * zoom;
  const [centreX, centreY] = [(minX + maxX) / 2, (minY + maxY) / 2];
  return placed.map((points) =>
    points.map(([x, y]): Point => [
      frame.width / 2 + (x - centreX) * scale,
      frame.height / 2 + (y - centreY) * scale,
    ]),
  );
}

/** Turns a shape clockwise around its start (0, 0); y points down, as on screen. */
function rotate(points: Point[], degrees: number): Point[] {
  if (degrees % 360 === 0) return points;
  const radians = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return points.map(([x, y]): Point => [x * cos - y * sin, x * sin + y * cos]);
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
function clipToPicture(points: Point[], frame: Frame): Point[][] {
  const runs: Point[][] = [];
  for (let i = 1; i < points.length; i++) {
    const segment = clipSegment(points[i - 1], points[i], frame);
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
function clipSegment(a: Point, b: Point, frame: Frame): [Point, Point] | null {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  let [enter, exit] = [0, 1];
  const edges: [number, number][] = [
    [-dx, a[0]],
    [dx, frame.width - a[0]],
    [-dy, a[1]],
    [dy, frame.height - a[1]],
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
