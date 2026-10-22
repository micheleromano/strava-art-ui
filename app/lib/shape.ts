/**
 * A route of [lat, lng] points as offsets from its own first point, so it keeps its
 * shape but no longer says where it is. Longitude offsets are scaled for latitude, so
 * the shape draws the same as it would in its real place.
 */
export function toShape(route: [number, number][]): [number, number][] {
  if (route.length === 0) return [];
  const [lat0, lng0] = route[0];
  const xScale = Math.cos((lat0 * Math.PI) / 180);
  return route.map(([lat, lng]) => [lat - lat0, (lng - lng0) * xScale]);
}
