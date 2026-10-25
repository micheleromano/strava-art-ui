/** The only activity fields we keep: enough to filter and draw routes, nothing more. */
export type Activity = {
  /** ISO 8601 in UTC, as Strava's `start_date`. */
  startDate: string;
  /** Google encoded polyline; empty when the activity has no map. */
  polyline: string;
  /**
   * Only in the owner's sample, whose polylines are shapes with no real position:
   * where it happened, rounded to about 25 km (see placeOf), so the sample can show a globe.
   */
  place?: [number, number];
};
