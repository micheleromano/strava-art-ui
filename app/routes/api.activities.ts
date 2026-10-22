import {
  commitSession,
  destroySession,
  sessionFrom,
  stravaConfig,
} from "~/lib/session.server";
import {
  fetchAllActivities,
  refreshIfExpired,
  StravaError,
} from "~/lib/strava";

import type { Route } from "./+types/api.activities";

// Strava's rate limit is shared by everyone using the app, so each person can fetch once a minute.
const MIN_FETCH_INTERVAL_S = 60;
// Strava's short-term limit resets every 15 minutes.
const STRAVA_RETRY_AFTER_S = 15 * 60;

// Fetches activities on the server, so the Strava token never reaches the browser.
export async function loader({ request }: Route.LoaderArgs) {
  const session = await sessionFrom(request);
  const tokens = session.get("tokens");
  if (!tokens) return Response.json(null, { status: 401 });

  const now = Date.now();
  const waitS = Math.ceil(
    ((session.get("lastFetchedAt") ?? 0) + MIN_FETCH_INTERVAL_S * 1000 - now) /
      1000,
  );
  if (waitS > 0) {
    return Response.json(null, {
      status: 429,
      headers: { "Retry-After": String(waitS) },
    });
  }
  session.set("lastFetchedAt", now);

  let status = 200;
  let activities = null;
  const headers = new Headers();
  try {
    // Saved even if the fetch below fails: Strava replaces the refresh token, so losing the new one signs the person out.
    const fresh = await refreshIfExpired(stravaConfig, tokens);
    session.set("tokens", fresh);
    activities = await fetchAllActivities(stravaConfig, fresh.accessToken);
  } catch (error) {
    if (!(error instanceof StravaError)) throw error;
    // 400 or 401 here means access was withdrawn on Strava or the refresh token is no longer valid.
    if (error.status === 400 || error.status === 401) {
      return Response.json(null, {
        status: 401,
        headers: { "Set-Cookie": await destroySession(session) },
      });
    }
    status = error.status === 429 ? 429 : 502;
    if (status === 429)
      headers.set("Retry-After", String(STRAVA_RETRY_AFTER_S));
  }
  headers.set("Set-Cookie", await commitSession(session));
  return Response.json(activities, { status, headers });
}
