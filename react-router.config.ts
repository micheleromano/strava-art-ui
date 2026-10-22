import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // Off because, in production builds, split route chunks made the studio render with the
  // server's data instead of waiting for its clientLoader (HydrateFallback was skipped).
  // Covered by the e2e tests, which run against a production build.
  splitRouteModules: false,
} satisfies Config;
