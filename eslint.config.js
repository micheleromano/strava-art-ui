import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "build/",
      ".react-router/",
      ".wrangler/",
      "worker-configuration.d.ts",
      "test-results/",
      "playwright-report/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs.flat["recommended-latest"],
);
