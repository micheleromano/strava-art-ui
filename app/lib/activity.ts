/** The only activity fields we keep: enough to filter and draw routes, nothing more. */
export type Activity = {
  /** ISO 8601 in UTC, as Strava's `start_date`. */
  startDate: string;
  /** Google encoded polyline; empty when the activity has no map. */
  polyline: string;
};
