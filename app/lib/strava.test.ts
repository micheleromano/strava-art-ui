import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authorizeUrl,
  canReadActivities,
  fetchAllActivities,
  refreshIfExpired,
  StravaError,
} from "./strava";

const config = {
  baseUrl: "https://strava.test",
  clientId: "client-id",
  clientSecret: "client-secret",
};

afterEach(() => vi.unstubAllGlobals());

describe("authorizeUrl", () => {
  it("asks for activity access and carries the state back to our callback", () => {
    const url = new URL(
      authorizeUrl(config, "https://app.test/auth/callback", "state-123"),
    );
    expect(url.origin + url.pathname).toBe(
      "https://strava.test/oauth/authorize",
    );
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.test/auth/callback",
    );
    expect(url.searchParams.get("scope")).toBe(
      "activity:read,activity:read_all",
    );
  });
});

describe("canReadActivities", () => {
  it.each([
    ["read,activity:read_all", true],
    ["read,activity:read", true],
    ["read", false],
    [null, false],
  ])("scope %s → %s", (scope, expected) => {
    expect(canReadActivities(scope)).toBe(expected);
  });
});

describe("refreshIfExpired", () => {
  const tokens = { accessToken: "a", refreshToken: "r", expiresAt: 2_000 };

  it("keeps tokens that are still valid without calling Strava", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await refreshIfExpired(config, tokens, 1_000_000)).toBe(tokens);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refreshes tokens that are about to expire", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "a2",
          refresh_token: "r2",
          expires_at: 9_000,
        }),
      ),
    );
    expect(await refreshIfExpired(config, tokens, 1_990_000)).toEqual({
      accessToken: "a2",
      refreshToken: "r2",
      expiresAt: 9_000,
    });
  });
});

describe("fetchAllActivities", () => {
  const stravaActivity = () => ({
    start_date: "2026-09-01T06:00:00Z",
    start_date_local: "2026-09-01T08:00:00Z",
    visibility: "everyone",
    map: { summary_polyline: "abc" },
  });

  it("reads every page until a page comes back short", async () => {
    const pages = [
      Array.from({ length: 200 }, stravaActivity),
      [stravaActivity()],
    ];
    const fetch = vi.fn(async (url: URL) =>
      Response.json(pages[Number(url.searchParams.get("page")) - 1]),
    );
    vi.stubGlobal("fetch", fetch);

    const activities = await fetchAllActivities(config, "token");
    expect(activities).toHaveLength(201);
    expect(fetch).toHaveBeenCalledTimes(2);
    // Only the date and route are kept.
    expect(activities[200]).toEqual({
      startDate: "2026-09-01T06:00:00Z",
      polyline: "abc",
    });
  });

  it("reports Strava's status when a request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 429 })),
    );
    await expect(fetchAllActivities(config, "token")).rejects.toEqual(
      new StravaError(429),
    );
  });
});
