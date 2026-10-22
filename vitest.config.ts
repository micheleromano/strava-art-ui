import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The Workers runtime module isn't available under Node; tests get fake env values.
      "cloudflare:workers": fileURLToPath(
        new URL("./test/cloudflare-workers.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["app/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
