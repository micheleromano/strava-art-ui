import { redirect } from "react-router";

import {
  destroySession,
  isSameOrigin,
  sessionFrom,
  stravaConfig,
} from "~/lib/session.server";
import { deauthorize, refreshIfExpired } from "~/lib/strava";

import type { Route } from "./+types/disconnect";

// The browser's copy of the activities is cleared by the home page's clientLoader once the session is gone.
export async function action({ request }: Route.ActionArgs) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const session = await sessionFrom(request);
  const tokens = session.get("tokens");
  let revoked = true;
  if (tokens) {
    try {
      const fresh = await refreshIfExpired(stravaConfig, tokens);
      await deauthorize(stravaConfig, fresh.accessToken);
    } catch {
      // Signing out here must never depend on reaching Strava; the home page explains what's left to do.
      revoked = false;
    }
  }
  return redirect(revoked ? "/" : "/?error=revoke", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}
