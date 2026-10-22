import type { Activity } from "./activity";
import { decodeRoutes, type Route } from "./layouts";

export type ListedRoute = {
  /** Stays the same when other activities are added or removed, e.g. by "Get latest activities". */
  id: string;
  /** The day it happened, formatted for the person. */
  date: string;
  /** Position among routes on the same day (1-based), and how many there are; 1 of 1 when alone. */
  sameDay: { position: number; count: number };
  route: Route;
};

/**
 * The routes that can be drawn from `activities`, newest first. `trimMetres` hides that
 * much of each end. Activities without a usable map are counted in `skipped`.
 */
export function listRoutes(
  activities: Activity[],
  trimMetres: number,
  formatDate: (startDate: string) => string,
): { routes: ListedRoute[]; skipped: number } {
  const newestFirst = [...activities].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  );
  const drawable = newestFirst.flatMap((activity) => {
    const [route] = decodeRoutes([activity.polyline], trimMetres);
    return route
      ? [{ activity, route, date: formatDate(activity.startDate) }]
      : [];
  });

  const perDay = new Map<string, number>();
  for (const { date } of drawable)
    perDay.set(date, (perDay.get(date) ?? 0) + 1);
  const seen = new Map<string, number>();
  const routes = drawable.map(({ activity, route, date }) => {
    const position = (seen.get(date) ?? 0) + 1;
    seen.set(date, position);
    return {
      id: `${activity.startDate}:${hash(activity.polyline)}`,
      date,
      sameDay: { position, count: perDay.get(date) ?? 1 },
      route,
    };
  });
  return { routes, skipped: activities.length - routes.length };
}

/** A short fingerprint of a route line (FNV-1a), so ids stay small. */
function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}
