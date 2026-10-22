import { CalendarDate } from "@internationalized/date";
import { describe, expect, it } from "vitest";

import type { Activity } from "./activity";
import { inRange, rangeFromParams } from "./date-range";

const activityAt = (startDate: string): Activity => ({
  startDate,
  polyline: "",
});

const september1st = {
  start: new CalendarDate(2026, 9, 1),
  end: new CalendarDate(2026, 9, 1),
};

describe("inRange", () => {
  // 23:30 UTC on 31 August is already 1 September in Berlin (UTC+2), but still 31 August in Los Angeles.
  const lateNight = activityAt("2026-08-31T23:30:00Z");

  it("uses the person's own calendar day, not UTC's", () => {
    expect(inRange([lateNight], september1st, "Europe/Berlin")).toHaveLength(1);
    expect(
      inRange([lateNight], september1st, "America/Los_Angeles"),
    ).toHaveLength(0);
  });

  it("includes the whole last day of the range", () => {
    const lastMinute = activityAt("2026-09-01T21:59:00Z"); // 23:59 in Berlin
    const nextDay = activityAt("2026-09-01T22:00:00Z"); // 00:00 on 2 Sept in Berlin
    expect(
      inRange([lastMinute, nextDay], september1st, "Europe/Berlin"),
    ).toEqual([lastMinute]);
  });
});

describe("rangeFromParams", () => {
  it("reads dates from the URL", () => {
    const range = rangeFromParams("2026-09-01", "2026-09-30", "UTC", []);
    expect(range.start.toString()).toBe("2026-09-01");
    expect(range.end.toString()).toBe("2026-09-30");
  });

  it.each([
    ["missing", null, null],
    ["invalid", "not-a-date", "2026-09-30"],
    ["backwards", "2026-09-30", "2026-09-01"],
  ])("falls back to the last 30 days when dates are %s", (_, from, to) => {
    const range = rangeFromParams(from, to, "UTC", []);
    expect(range.end.compare(range.start)).toBe(29);
  });

  it("covers every activity when none are from the last 30 days", () => {
    const range = rangeFromParams(null, null, "Europe/Berlin", [
      activityAt("2024-03-10T12:00:00Z"),
      activityAt("2023-11-30T23:30:00Z"), // 1 December in Berlin
      activityAt("2024-01-05T12:00:00Z"),
    ]);
    expect(range.start.toString()).toBe("2023-12-01");
    expect(range.end.toString()).toBe("2024-03-10");
  });
});
