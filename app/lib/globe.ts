import type { Place } from "./places";

type Rgb = [number, number, number];

/** `#rrggbb` as the 0–1 channels cobe takes. */
export function toRgb(hex: string): Rgb {
  return [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  ) as Rgb;
}

/** Dot sizes for cobe: the busiest place biggest, quieter places smaller but still visible. */
export function markersFor(places: Place[]) {
  const busiest = Math.max(1, ...places.slice(0, 1).map(({ count }) => count));
  return places.map(({ location, count }) => ({
    location,
    size: 0.03 + 0.07 * Math.sqrt(count / busiest),
  }));
}

// One full turn every 35 seconds.
const SPIN_PER_SECOND = (2 * Math.PI) / 35;
// After a long gap between frames (a hidden tab, say), don't jump the globe round.
const MAX_FRAME_GAP_MS = 100;

/**
 * How far to turn the globe, in radians, for `elapsedMs` since the last frame. By time,
 * not per frame, so it spins at the same speed on phones that draw fewer frames a second.
 */
export function spinFor(elapsedMs: number): number {
  return (SPIN_PER_SECOND * Math.min(elapsedMs, MAX_FRAME_GAP_MS)) / 1000;
}

/** cobe's spin angle that turns `location`'s longitude to face the viewer. */
export function spinFacing([, lng]: [number, number]): number {
  return Math.PI - ((lng * Math.PI) / 180 - Math.PI / 2);
}

/**
 * The starting tilt, in degrees north (negative is south): toward the busiest place, but
 * only half way, so the globe still reads as a globe from far north or south.
 */
export function defaultTilt(places: Place[]): number {
  return places[0] ? Math.round(places[0].location[0] / 2) : 15;
}

/** cobe's tilt angle for `degrees` north; negative tilts the south toward the viewer. */
export function tiltAngle(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** The globe's own colours, from the picture's background: a dark globe on dark backgrounds. */
export function globeColours(background: string) {
  const [r, g, b] = toRgb(background);
  const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
  // Land dots a little lighter than the background, so the map shows without competing.
  const lift = (channel: number) => channel + (1 - channel) * (dark ? 0.25 : 0);
  const base: Rgb = [lift(r), lift(g), lift(b)];
  return { dark: dark ? 1 : 0, baseColor: base, glowColor: base };
}
