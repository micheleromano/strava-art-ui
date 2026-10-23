import polyline from "@mapbox/polyline";
import { describe, expect, it } from "vitest";

import type { Activity } from "./activity";
import { listRoutes } from "./listed-routes";

const activity = (startDate: string, lat: number): Activity => ({
  startDate,
  polyline: polyline.encode([
    [lat, 0],
    [lat + 0.01, 0],
  ]),
});

const formatDate = (startDate: string) => startDate.slice(0, 10);

describe("listRoutes", () => {
  const older = activity("2026-09-01T12:00:00Z", 51.5);
  const newer = activity("2026-09-05T12:00:00Z", 51.6);

  it("lists routes newest first", () => {
    const { routes } = listRoutes([older, newer], 0, formatDate);
    expect(routes.map(({ date }) => date)).toEqual([
      "2026-09-05",
      "2026-09-01",
    ]);
  });

  // A route someone hid must stay hidden, and keep its rotation, after the list changes.
  it("keeps each route's id when a newer activity arrives", () => {
    const before = listRoutes([newer, older], 0, formatDate).routes;
    const latest = activity("2026-09-09T12:00:00Z", 51.7);
    const after = listRoutes([latest, newer, older], 0, formatDate).routes;
    const idOf = (routes: typeof before, date: string) =>
      routes.find((route) => route.date === date)?.id;
    expect(idOf(after, "2026-09-01")).toBe(idOf(before, "2026-09-01"));
    expect(idOf(after, "2026-09-05")).toBe(idOf(before, "2026-09-05"));
    expect(new Set(after.map(({ id }) => id)).size).toBe(3);
  });

  it("numbers routes from the same day so they can be told apart", () => {
    const sameDay = [
      activity("2026-09-05T08:00:00Z", 51.6),
      activity("2026-09-05T18:00:00Z", 51.7),
    ];
    const { routes } = listRoutes([...sameDay, older], 0, formatDate);
    expect(routes.map(({ sameDay }) => sameDay)).toEqual([
      { position: 1, count: 2 },
      { position: 2, count: 2 },
      { position: 1, count: 1 },
    ]);
  });

  it("counts activities without a usable map as skipped", () => {
    const noMap = { startDate: "2026-09-03T12:00:00Z", polyline: "" };
    const { routes, skipped } = listRoutes([older, noMap], 0, formatDate);
    expect(routes).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
