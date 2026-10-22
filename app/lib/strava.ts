import type { Activity } from "./activity";

export type StravaConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

export type StravaTokens = {
  accessToken: string;
  refreshToken: string;
  /** Seconds since the epoch, as Strava sends it. */
  expiresAt: number;
};

// Asking for both lets people untick private activities on Strava's consent screen and still connect.
export const STRAVA_SCOPE = "activity:read,activity:read_all";
const PAGE_SIZE = 200;
// Each page is one request; Workers on the free plan allow 50 outgoing requests per incoming one.
const MAX_PAGES = 40;
const EXPIRY_MARGIN_MS = 60_000;

export class StravaError extends Error {
  constructor(readonly status: number) {
    super(`Strava request failed with status ${status}`);
  }
}

export type StravaActivity = {
  start_date: string;
  /** The athlete's local time, written as if it were UTC. */
  start_date_local: string;
  /** Who can see the activity on Strava: "everyone", "followers_only" or "only_me". */
  visibility: string;
  map?: { summary_polyline?: string | null };
};

export function authorizeUrl(
  config: StravaConfig,
  redirectUri: string,
  state: string,
): string {
  const url = new URL("/oauth/authorize", config.baseUrl);
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: STRAVA_SCOPE,
    state,
  }).toString();
  return url.toString();
}

export function canReadActivities(grantedScope: string | null): boolean {
  const scopes = grantedScope?.split(",") ?? [];
  return (
    scopes.includes("activity:read") || scopes.includes("activity:read_all")
  );
}

async function requestTokens(
  config: StravaConfig,
  params: Record<string, string>,
): Promise<StravaTokens> {
  const response = await fetch(new URL("/oauth/token", config.baseUrl), {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      ...params,
    }),
  });
  if (!response.ok) throw new StravaError(response.status);
  const body = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: body.expires_at,
  };
}

export function exchangeCode(
  config: StravaConfig,
  code: string,
): Promise<StravaTokens> {
  return requestTokens(config, { code, grant_type: "authorization_code" });
}

/** Returns the same tokens object when it is still valid, so callers can tell whether to save new ones. */
export async function refreshIfExpired(
  config: StravaConfig,
  tokens: StravaTokens,
  now = Date.now(),
): Promise<StravaTokens> {
  if (tokens.expiresAt * 1000 - EXPIRY_MARGIN_MS > now) return tokens;
  return requestTokens(config, {
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });
}

export function toActivity(activity: StravaActivity): Activity {
  return {
    startDate: activity.start_date,
    polyline: activity.map?.summary_polyline ?? "",
  };
}

export async function fetchAllActivities(
  config: StravaConfig,
  accessToken: string,
): Promise<Activity[]> {
  return (await fetchStravaActivities(config, accessToken)).map(toActivity);
}

/** The athlete's most recent activities as Strava sends them, up to MAX_PAGES pages. */
export async function fetchStravaActivities(
  config: StravaConfig,
  accessToken: string,
): Promise<StravaActivity[]> {
  const activities: StravaActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL("/api/v3/athlete/activities", config.baseUrl);
    url.search = new URLSearchParams({
      page: String(page),
      per_page: String(PAGE_SIZE),
    }).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new StravaError(response.status);
    const batch = (await response.json()) as StravaActivity[];
    activities.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return activities;
}

/** Withdraws this app's access on Strava, so it no longer appears under the athlete's connected apps. */
export async function deauthorize(
  config: StravaConfig,
  accessToken: string,
): Promise<void> {
  const response = await fetch(new URL("/oauth/deauthorize", config.baseUrl), {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new StravaError(response.status);
}
