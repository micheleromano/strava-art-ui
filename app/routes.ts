import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("studio", "routes/studio.tsx"),
  route("auth/strava", "routes/auth.strava.ts"),
  route("auth/callback", "routes/auth.callback.ts"),
  route("disconnect", "routes/disconnect.ts"),
  route("api/activities", "routes/api.activities.ts"),
] satisfies RouteConfig;
