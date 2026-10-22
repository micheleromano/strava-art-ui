// Fetches the app owner's public Strava activities once, keeps only the day each one
// happened, trims the ends of every route and keeps only its shape (no real
// coordinates), and saves them as the sample data visitors can use without connecting Strava.
// Run with `pnpm demo:fetch`. Needs STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in .dev.vars.
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import polyline from "@mapbox/polyline";

import type { Activity } from "../app/lib/activity";
import {
  authorizeUrl,
  canReadActivities,
  exchangeCode,
  fetchStravaActivities,
  type StravaConfig,
} from "../app/lib/strava";
import { toShape } from "../app/lib/shape";
import { trimEnds } from "../app/lib/trim-ends";

const PORT = 8789;
const TRIM_METRES = 500;
const OUTPUT = fileURLToPath(
  new URL("../app/data/demo-activities.json", import.meta.url),
);

const vars = Object.fromEntries(
  readFileSync(new URL("../.dev.vars", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const [key, ...value] = line.split("=");
      return [key.trim(), value.join("=").trim()];
    }),
);
const config: StravaConfig = {
  baseUrl: "https://www.strava.com",
  clientId: vars.STRAVA_CLIENT_ID,
  clientSecret: vars.STRAVA_CLIENT_SECRET,
};
if (!config.clientId || !config.clientSecret) {
  throw new Error(
    "Add STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to .dev.vars first.",
  );
}

const state = crypto.randomUUID();
const redirectUri = `http://localhost:${PORT}/callback`;

const code = await new Promise<string>((resolve, reject) => {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", redirectUri);
    // Ignore anything else the browser asks for, such as /favicon.ico.
    if (url.pathname !== "/callback") {
      response.writeHead(404).end();
      return;
    }
    const params = url.searchParams;
    const code = params.get("code");
    const ok =
      code &&
      params.get("state") === state &&
      canReadActivities(params.get("scope"));
    response.end(
      ok
        ? "Signed in. You can close this tab and go back to the terminal."
        : "Sign-in didn't complete. Check the terminal.",
    );
    server.close();
    if (ok) resolve(code);
    else
      reject(
        new Error(
          "Strava sign-in was cancelled or didn't allow reading activities.",
        ),
      );
  }).listen(PORT, "127.0.0.1", () => {
    const url = authorizeUrl(config, redirectUri, state);
    console.log(
      `Opening Strava to sign in. If nothing opens, visit:\n${url}\n`,
    );
    execFile("open", [url]);
  });
});

const tokens = await exchangeCode(config, code);
const activities = await fetchStravaActivities(config, tokens.accessToken);
const sample: Activity[] = activities
  // Only what the owner already shows to everyone on Strava.
  .filter((activity) => activity.visibility === "everyone")
  .map((activity) => ({
    // Midday UTC on the owner's local date: keeps the day but not the time they were out.
    startDate: `${activity.start_date_local.slice(0, 10)}T12:00:00Z`,
    // Trimmed, then stored as a shape only: no real coordinates leave this machine.
    polyline: polyline.encode(
      toShape(
        trimEnds(
          polyline.decode(activity.map?.summary_polyline ?? ""),
          TRIM_METRES,
        ),
      ),
    ),
  }));

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(sample));
const withRoute = sample.filter((activity) => activity.polyline).length;
console.log(
  `Saved ${sample.length} of ${activities.length} activities (the public ones; ${withRoute} with a route) to app/data/demo-activities.json.`,
);
