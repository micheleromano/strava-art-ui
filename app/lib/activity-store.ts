import { clear, get, set } from "idb-keyval";

import type { Activity } from "./activity";

// The one place activities are stored in the browser, so storage can move (e.g. to Cloudflare KV) later.
const KEY = "activities";

export function getActivities(): Promise<Activity[] | undefined> {
  return get<Activity[]>(KEY);
}

export function saveActivities(activities: Activity[]): Promise<void> {
  return set(KEY, activities);
}

export function clearActivities(): Promise<void> {
  return clear();
}
