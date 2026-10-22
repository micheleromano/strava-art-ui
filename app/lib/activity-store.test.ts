import { describe, expect, it } from "vitest";

import {
  clearActivities,
  getActivities,
  saveActivities,
} from "./activity-store";

const activity = { startDate: "2026-09-01T06:00:00Z", polyline: "abc" };

describe("activity store", () => {
  it("keeps activities until they are cleared", async () => {
    await saveActivities([activity]);
    expect(await getActivities()).toEqual([activity]);
    await clearActivities();
    expect(await getActivities()).toBeUndefined();
  });
});
