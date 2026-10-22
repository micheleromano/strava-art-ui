const EARTH_RADIUS_M = 6_371_000;

/**
 * Removes the first and last `metres` of a route of [lat, lng] points, so it
 * doesn't show where it starts and finishes (often someone's home). Returns an
 * empty array when nothing is left.
 */
export function trimEnds(
  points: [number, number][],
  metres: number,
): [number, number][] {
  const along = [0];
  for (let i = 1; i < points.length; i++) {
    along.push(along[i - 1] + distance(points[i - 1], points[i]));
  }
  const total = along.at(-1) ?? 0;
  const kept = points.filter(
    (_, i) => along[i] >= metres && along[i] <= total - metres,
  );
  return kept.length > 1 ? kept : [];
}

/** Haversine distance in metres between two [lat, lng] points. */
function distance([lat1, lng1]: number[], [lat2, lng2]: number[]): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}
