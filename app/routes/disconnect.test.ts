import { afterEach, describe, expect, it, vi } from "vitest";

import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/disconnect";
import { action } from "./disconnect";

afterEach(() => vi.unstubAllGlobals());

async function disconnect(origin?: string) {
  const session = await getSession();
  session.set("tokens", {
    accessToken: "a",
    refreshToken: "r",
    expiresAt: 9_999_999_999,
  });
  const headers = new Headers({ Cookie: await commitSession(session) });
  if (origin) headers.set("Origin", origin);
  const request = new Request("https://app.test/disconnect", {
    method: "POST",
    headers,
  });
  return (await action({ request } as Route.ActionArgs)) as Response;
}

async function signedOut(response: Response) {
  const session = await getSession(response.headers.get("Set-Cookie"));
  return !session.has("tokens");
}

describe("disconnect", () => {
  it("withdraws access on Strava and signs out", async () => {
    const fetch = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetch);
    const response = await disconnect("https://app.test");
    expect(fetch).toHaveBeenCalledOnce();
    expect(response.headers.get("Location")).toBe("/");
    expect(await signedOut(response)).toBe(true);
  });

  it("still signs out when Strava can't be reached, and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    const response = await disconnect();
    expect(response.headers.get("Location")).toBe("/?error=revoke");
    expect(await signedOut(response)).toBe(true);
  });

  it("refuses a post from another site", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const response = await disconnect("https://evil.test");
    expect(response.status).toBe(403);
    expect(response.headers.has("Set-Cookie")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
