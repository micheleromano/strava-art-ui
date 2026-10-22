import { redirect } from "react-router";

import { commitSession, sessionFrom, stravaConfig } from "~/lib/session.server";
import { canReadActivities, exchangeCode, StravaError } from "~/lib/strava";

import type { Route } from "./+types/auth.callback";

export async function loader({ request }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams;
  const session = await sessionFrom(request);
  const expectedState = session.get("oauthState");
  session.unset("oauthState");

  const backHome = async (error: "denied" | "scope" | "failed") =>
    redirect(`/?error=${error}`, {
      headers: { "Set-Cookie": await commitSession(session) },
    });

  if (params.get("error")) return backHome("denied");
  const code = params.get("code");
  if (!code || !expectedState || params.get("state") !== expectedState) {
    return backHome("failed");
  }
  if (!canReadActivities(params.get("scope"))) return backHome("scope");

  try {
    session.set("tokens", await exchangeCode(stravaConfig, code));
  } catch (error) {
    if (error instanceof StravaError) return backHome("failed");
    throw error;
  }
  return redirect("/studio", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}
