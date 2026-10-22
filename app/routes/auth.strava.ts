import { redirect } from "react-router";

import {
  commitSession,
  isSameOrigin,
  sessionFrom,
  stravaConfig,
} from "~/lib/session.server";
import { authorizeUrl } from "~/lib/strava";

import type { Route } from "./+types/auth.strava";

export async function action({ request }: Route.ActionArgs) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await sessionFrom(request);
  // A one-time value Strava sends back, so the callback only accepts sign-ins this browser started.
  const state = crypto.randomUUID();
  session.set("oauthState", state);
  const redirectUri = new URL("/auth/callback", request.url).toString();
  return redirect(authorizeUrl(stravaConfig, redirectUri, state), {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
