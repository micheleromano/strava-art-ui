import { afterEach, describe, expect, it, vi } from "vitest";

import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/api.activities";
import { loader } from "./api.activities";

afterEach(() => vi.unstubAllGlobals());

const expired = { accessToken: "old", refreshToken: "r1", expiresAt: 0 };

async function requestWith(cookie: string) {
  const request = new Request("https://app.test/api/activities", {
    headers: { Cookie: cookie },
  });
  return (await loader({ request } as Route.LoaderArgs)) as Response;
}

async function connectedCookie(lastFetchedAt?: number) {
  const session = await getSession();
  session.set("tokens", expired);
  if (lastFetchedAt) session.set("lastFetchedAt", lastFetchedAt);
  return commitSession(session);
}

describe("activities", () => {
  it("lets each person fetch from Strava at most once a minute", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await requestWith(
      await connectedCookie(Date.now() - 10_000),
    );
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps refreshed tokens even when fetching activities then fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: URL) =>
        url.pathname === "/oauth/token"
          ? Response.json({
              access_token: "new",
              refresh_token: "r2",
              expires_at: 9_999_999_999,
            })
          : new Response(null, { status: 429 }),
      ),
    );
    const response = await requestWith(await connectedCookie());
    expect(response.status).toBe(429);
    const session = await getSession(response.headers.get("Set-Cookie"));
    expect(session.get("tokens")?.refreshToken).toBe("r2");
  });
});
