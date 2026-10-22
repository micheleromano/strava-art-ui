import { afterEach, describe, expect, it, vi } from "vitest";

import { commitSession, getSession } from "~/lib/session.server";

import type { Route } from "./+types/auth.callback";
import { loader } from "./auth.callback";

afterEach(() => vi.unstubAllGlobals());

async function callback(query: string, oauthState?: string) {
  const session = await getSession();
  if (oauthState) session.set("oauthState", oauthState);
  const request = new Request(`https://app.test/auth/callback?${query}`, {
    headers: { Cookie: await commitSession(session) },
  });
  return (await loader({ request } as Route.LoaderArgs)) as Response;
}

function stubTokenExchange() {
  const fetch = vi.fn(async () =>
    Response.json({
      access_token: "a",
      refresh_token: "r",
      expires_at: 9_999_999_999,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("Strava callback", () => {
  it("rejects a sign-in this browser didn't start", async () => {
    const fetch = stubTokenExchange();
    const response = await callback(
      "code=c&state=attacker&scope=read,activity:read_all",
      "ours",
    );
    expect(response.headers.get("Location")).toBe("/?error=failed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects a callback when no sign-in was started", async () => {
    const fetch = stubTokenExchange();
    const response = await callback("code=c&state=any&scope=activity:read_all");
    expect(response.headers.get("Location")).toBe("/?error=failed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("explains when the person declined on Strava", async () => {
    const response = await callback("error=access_denied&state=ours", "ours");
    expect(response.headers.get("Location")).toBe("/?error=denied");
  });

  it("explains when activity access wasn't granted", async () => {
    const response = await callback("code=c&state=ours&scope=read", "ours");
    expect(response.headers.get("Location")).toBe("/?error=scope");
  });

  it("saves the tokens and opens the studio when everything checks out", async () => {
    stubTokenExchange();
    const response = await callback(
      "code=c&state=ours&scope=read,activity:read",
      "ours",
    );
    expect(response.headers.get("Location")).toBe("/studio");
    const session = await getSession(response.headers.get("Set-Cookie"));
    expect(session.get("tokens")?.accessToken).toBe("a");
    expect(session.has("oauthState")).toBe(false);
  });
});
