// A stand-in for Strava's OAuth and activities API, used only by the end-to-end tests.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const PORT = 8790;
const activities = readFileSync(
  new URL("./fixtures/strava-activities.json", import.meta.url),
  "utf8",
);

createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${PORT}`);
  const route = `${request.method} ${url.pathname}`;

  if (route === "GET /health") {
    response.end("ok");
  } else if (route === "GET /oauth/authorize") {
    // Acts as if the athlete agreed to everything on Strava's consent screen.
    const callback = new URL(url.searchParams.get("redirect_uri") ?? "");
    callback.searchParams.set("state", url.searchParams.get("state") ?? "");
    callback.searchParams.set("code", "e2e-code");
    callback.searchParams.set("scope", "read,activity:read,activity:read_all");
    response.writeHead(302, { Location: callback.toString() }).end();
  } else if (route === "POST /oauth/token") {
    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        access_token: "e2e-access-token",
        refresh_token: "e2e-refresh-token",
        expires_at: Math.floor(Date.now() / 1000) + 6 * 60 * 60,
      }),
    );
  } else if (route === "GET /api/v3/athlete/activities") {
    const firstPage = url.searchParams.get("page") === "1";
    response
      .writeHead(200, { "Content-Type": "application/json" })
      .end(firstPage ? activities : "[]");
  } else if (route === "POST /oauth/deauthorize") {
    response.writeHead(200, { "Content-Type": "application/json" }).end("{}");
  } else {
    response.writeHead(404).end();
  }
}).listen(PORT);
