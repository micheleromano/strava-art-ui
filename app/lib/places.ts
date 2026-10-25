import type { Route } from "./layouts";

/** Places snap to a grid this many degrees apart: about 25 km, roughly town level. */
export const PLACE_GRID_DEGREES = 0.25;

export type Place = {
  /** [latitude, longitude], snapped to the grid, never an exact point. */
  location: [number, number];
  /** How many routes are in this grid square. */
  count: number;
};

/**
 * Where a route happened, rounded to about 25 km: its middle point, not its start
 * (which is often someone's home), snapped to the grid. Null for an empty route.
 */
export function placeOf(route: Route): [number, number] | null {
  if (route.length === 0) return null;
  const [lat, lng] = route[Math.floor(route.length / 2)];
  return [snap(lat), snap(lng)];
}

/** Merges places in the same grid square, counting them. Busiest places first. */
export function countPlaces(locations: [number, number][]): Place[] {
  const places = new Map<string, Place>();
  for (const [lat, lng] of locations) {
    // Snapping again is harmless for places already on the grid.
    const location: [number, number] = [snap(lat), snap(lng)];
    const key = location.join(",");
    const place = places.get(key);
    if (place) place.count++;
    else places.set(key, { location, count: 1 });
  }
  return [...places.values()].sort((a, b) => b.count - a.count);
}

/** Where routes happened, rounded to about 25 km and merged; see placeOf. */
export function placesFrom(routes: Route[]): Place[] {
  return countPlaces(
    routes.flatMap((route) => {
      const place = placeOf(route);
      return place ? [place] : [];
    }),
  );
}

function snap(degrees: number): number {
  // `+ 0` turns -0 into 0, so the same square never gets two keys.
  return Math.round(degrees / PLACE_GRID_DEGREES) * PLACE_GRID_DEGREES + 0;
}
