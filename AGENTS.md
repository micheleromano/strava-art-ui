# strava-art-ui

It is for a user to connect to their own Strava account to retrieve their activities and they can select the type of art to view and save based on their activity maps

<!-- agent-scaffold:system -->

> Part of **strava-art**. Goal: We want a user to be able to generate various types of images with their curated maps from

their Strava activities. For example, they might select only maps from the last month. They can choose to overlay all the maps on top of
each other, have them each in a grid, have them all lined up with the start positions being the same etc. They will be able to select back

ground/foreground colours, maybe each activities is a variant on a colour etc. They will be able to download the generated images. They ne

ed to be able to connect to their own Strava by signing in and giving permission to get all the activities.

> This service: Frontend (web or mobile UI) (the interface people use directly). The system overview, how services talk, and the rules every service follows are in `../AGENTS.md`.

<!-- /agent-scaffold:system -->

## Stack

- **Language and runtime:** TypeScript, React, React Router (framework mode), Vite with `@cloudflare/vite-plugin`, deployed to Cloudflare Workers with Wrangler.
- **UI:** HeroUI on Tailwind CSS v4; light and dark mode through HeroUI's theme.
- **i18n:** `react-i18next` with English JSON resources. Dates stay ISO 8601 UTC (as Strava's `start_date` is) and are formatted with `Intl.DateTimeFormat` in the user's locale and timezone.
- **Auth:** Strava OAuth 2.0, scope `activity:read,activity:read_all`, so people can untick private activities and still connect. Code exchange and token refresh run in server loaders and actions. Tokens live in `createCookieSessionStorage`, in a session cookie that ends when the browser closes. The Strava client secret and session secret are Worker secrets (`.dev.vars` locally, never committed).
- **Data:** no database. Each activity from `/athlete/activities` is cut down to its start date and route line (`summary_polyline`). Activities are cached in the browser's IndexedDB (`idb-keyval`) behind one module, `app/lib/activity-store.ts`, called from `clientLoader`s, so it can move to Cloudflare KV later. Disconnecting withdraws access on Strava and clears the cookie and IndexedDB.
- **Sample data:** visitors who don't connect use the owner's public activities, fetched once with `pnpm demo:fetch`. That script keeps only the day of each activity, trims 500 m off both ends of each route, and stores each route as a shape relative to its own start, with no real coordinates. The output, `app/data/demo-activities.json`, is gitignored and bundled at build time: never commit it.
- **Art:** polylines decoded with `@mapbox/polyline` and drawn as SVG in React; downloads as SVG, or PNG via a canvas on click.
- **Quality:** Vitest + Testing Library (unit), Playwright (end-to-end, Strava mocked), ESLint, Prettier, `react-router typegen && tsc`.
- **Package manager:** pnpm.

## Commands

| Purpose          | Command                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| Install          | `pnpm install`                                                                    |
| Dev server       | `pnpm dev`                                                                        |
| Unit tests       | `pnpm test` (`vitest run`)                                                        |
| End-to-end tests | `pnpm test:e2e` (`playwright test`)                                               |
| Lint             | `pnpm lint`                                                                       |
| Type check       | `pnpm typecheck`                                                                  |
| Format           | `pnpm format`                                                                     |
| Sample data      | `pnpm demo:fetch` (signs in to Strava as the owner, writes the gitignored sample) |
| Deploy           | `pnpm run deploy` (`wrangler deploy`). Ask the user first, every time.            |

## Architecture

We can use a react-router site which has a BFF functionality via its actions and loaders and fetchers. We can load a web application which will go through the third party idp to login to strava to get the activities for the given user. We dont need to save any keys or personal information but we do need to persist the activities somehow for the session so they can play around with various different types of art. When the user is happy it will output an image they can download to add to their desktop

## Conventions

- 1. Always try to use HeroUi for any component because they come with a11y features. 2. Always try to use react-router features like fetchers, actions, loaders rather than useEffect. The useEffect should only be used in the cases where it makes sense that they were actually built for and react-router features will not work. 3. All designs should be ready for i18n complete with translations (just English for now). 4. All dates and times should be stored in a way that they can be easily translated to the users timezone and preferences. 5. Always have designs with light and dark mode. 6. Try not to use any custom css unless asked explicitly to do so, we should use the styles built into HeroUI like the variants and tailwind colour options.

<!-- agent-scaffold:principles -->

## How to work

Adapted from Andrej Karpathy's notes on common LLM coding mistakes (https://x.com/karpathy/status/2015883857489522876, via github.com/multica-ai/andrej-karpathy-skills) and the Center for Humane Technology's principles (https://www.humanetech.com/humane-product-design). These favor care over speed; for trivial tasks, use judgment.

1. **Think before coding.** Say what you're assuming. If a request can be read more than one way, lay out the readings instead of picking one quietly. If something is unclear, stop and ask. If there's a simpler approach, propose it.
2. **Keep it simple.** Write the least code that solves the problem: no features, options or abstractions nobody asked for, and no handling for cases that can't happen. If a senior engineer would call it overbuilt, cut it down.
3. **Make surgical changes.** Every changed line should trace back to the request. Match the existing style, leave unrelated code alone, and mention problems you notice instead of fixing them unasked. Do clean up anything your own change made unused.
4. **Work toward a verifiable goal.** Turn the task into a check you can run, such as a failing test that should pass. For multi-step work, write a short plan with a check for each step, and keep going until the checks pass.
5. **Keep people in control.** Ask before anything irreversible or outward-facing: deleting data, migrations, deploys, publishing, sending messages. Explain trade-offs in plain words and recommend one option. Report what you verified and what you didn't; never claim a check passed that you didn't run.
6. **Use current, compatible dependencies.** When adding a dependency, setting up a stack or upgrading, look up the latest stable version of each package at that moment (e.g. `npm view <package> version`, `pip index versions <package>`); don't rely on versions you remember. Check that their peer and runtime requirements fit together before installing, and say so if they don't. The package file and its lockfile are the only record of versions: don't write version numbers into `AGENTS.md` or other docs.

<!-- /agent-scaffold:principles -->
