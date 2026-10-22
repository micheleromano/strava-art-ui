import {
  parseAbsolute,
  parseDate,
  toCalendarDate,
  today,
  type CalendarDate,
} from "@internationalized/date";

import type { Activity } from "./activity";

export type DayRange = { start: CalendarDate; end: CalendarDate };

const DEFAULT_DAYS = 30;

export function defaultRange(timeZone: string): DayRange {
  const end = today(timeZone);
  return { start: end.subtract({ days: DEFAULT_DAYS - 1 }), end };
}

/**
 * Reads `from` and `to` (YYYY-MM-DD) from the URL. Without them, shows the last 30 days,
 * or every activity when none are that recent (e.g. sample data fetched a while ago).
 */
export function rangeFromParams(
  from: string | null,
  to: string | null,
  timeZone: string,
  activities: Activity[],
): DayRange {
  try {
    if (from && to) {
      const range = { start: parseDate(from), end: parseDate(to) };
      if (range.start.compare(range.end) <= 0) return range;
    }
  } catch {
    // An invalid date in the URL falls through to the default.
  }
  const recent = defaultRange(timeZone);
  if (activities.length === 0 || inRange(activities, recent, timeZone).length) {
    return recent;
  }
  return spanOf(activities, timeZone);
}

function spanOf(activities: Activity[], timeZone: string): DayRange {
  const days = activities.map((activity) =>
    toCalendarDate(parseAbsolute(activity.startDate, timeZone)),
  );
  return days.reduce(
    (range, day) => ({
      start: day.compare(range.start) < 0 ? day : range.start,
      end: day.compare(range.end) > 0 ? day : range.end,
    }),
    { start: days[0], end: days[0] },
  );
}

/** Keeps activities that started on any day of the range, as calendar days in `timeZone`. */
export function inRange(
  activities: Activity[],
  range: DayRange,
  timeZone: string,
): Activity[] {
  const from = range.start.toDate(timeZone).getTime();
  const until = range.end.add({ days: 1 }).toDate(timeZone).getTime();
  return activities.filter((activity) => {
    const startedAt = Date.parse(activity.startDate);
    return startedAt >= from && startedAt < until;
  });
}
