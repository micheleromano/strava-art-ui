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

/** The spin speed slider's range: 1 is slowest, 10 fastest. */
export const SPIN_SPEED = { min: 1, max: 10, initial: 3 } as const;
// After a long gap between frames (a hidden tab, say), don't jump the globe round.
const MAX_FRAME_GAP_MS = 100;

/** Seconds for one full turn at `speed`: 2 minutes at 1, 40 seconds at 3, 12 seconds at 10. */
export function secondsPerTurn(speed: number): number {
  return 120 / speed;
}

/**
 * How far to turn the globe, in radians, for `elapsedMs` since it was last drawn. By time,
 * not per frame, so it spins at the same speed however many frames a device draws.
 */
export function spinFor(elapsedMs: number, speed: number): number {
  const radiansPerSecond = (2 * Math.PI) / secondsPerTurn(speed);
  return (radiansPerSecond * Math.min(elapsedMs, MAX_FRAME_GAP_MS)) / 1000;
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
