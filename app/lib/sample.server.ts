import type { Activity } from "./activity";

// The owner's trimmed activities, written by `pnpm demo:fetch`. The file is gitignored,
// so it may be missing; then there is simply no sample. End-to-end tests use a fixture instead.
const files =
  import.meta.env.MODE === "e2e"
    ? import.meta.glob<Activity[]>(
        "../../e2e/fixtures/sample-activities.json",
        {
          eager: true,
          import: "default",
        },
      )
    : import.meta.glob<Activity[]>("../data/demo-activities.json", {
        eager: true,
        import: "default",
      });

export const sampleActivities: Activity[] = Object.values(files)[0] ?? [];
