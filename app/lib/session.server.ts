import { env } from "cloudflare:workers";
import { createCookieSessionStorage } from "react-router";

import type { StravaConfig, StravaTokens } from "./strava";

export const stravaConfig: StravaConfig = {
  baseUrl: env.STRAVA_BASE_URL,
  clientId: env.STRAVA_CLIENT_ID,
  clientSecret: env.STRAVA_CLIENT_SECRET,
};

type SessionData = {
  tokens: StravaTokens;
  oauthState: string;
  /** Milliseconds since the epoch of the last full fetch from Strava. */
  lastFetchedAt: number;
};

// httpOnly keeps the Strava tokens out of reach of the page's JavaScript.
// No maxAge: the cookie, and with it the Strava connection, ends when the browser closes.
export const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [env.SESSION_SECRET],
      secure: import.meta.env.PROD,
    },
  });

export function sessionFrom(request: Request) {
  return getSession(request.headers.get("Cookie"));
}

/**
 * True when a form post came from this app. Browsers send Origin on cross-site posts,
 * so another site can't sign people out or start a sign-in on their behalf.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  return origin === null || origin === new URL(request.url).origin;
}
