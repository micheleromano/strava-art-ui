---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**/*.ts"
---
# Testing

- Every bug fix gets a test that fails without the fix.
- Test behavior through public interfaces, not implementation details.
- Never weaken or delete an assertion to make a test pass; report the failure instead.
- Run unit tests with `pnpm test` and end-to-end tests with `pnpm test:e2e`.
