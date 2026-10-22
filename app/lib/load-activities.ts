import { data, redirect } from "react-router";

import type { Activity } from "./activity";
import {
  clearActivities,
  getActivities,
  saveActivities,
} from "./activity-store";

type StudioServerData = {
  connected: boolean;
  sample: Activity[] | null;
};

export type LoadFailure = {
  status: number;
  /** From the Retry-After header, when there is one. */
  retryAfterMinutes: number | null;
};

/** The studio's activities: the sample, or the person's own from this browser's copy or Strava. */
export async function loadActivities(
  server: StudioServerData,
): Promise<Activity[]> {
  // Activities only stay in this browser while Strava is connected.
  if (!server.connected) await clearActivities();
  if (server.sample) return server.sample;
  const cached = await getActivities();
  if (cached) return cached;
  const result = await fetchFromStrava();
  if (!Array.isArray(result)) throw data(result, { status: result.status });
  return result;
}

/** Fetches the latest activities, keeping the browser's copy as it was if that fails. */
export async function refreshActivities(): Promise<LoadFailure | null> {
  const result = await fetchFromStrava();
  return Array.isArray(result) ? null : result;
}

async function fetchFromStrava(): Promise<Activity[] | LoadFailure> {
  const response = await fetch("/api/activities");
  if (response.status === 401) {
    await clearActivities();
    throw redirect("/?error=expired");
  }
  if (!response.ok) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    return {
      status: response.status,
      retryAfterMinutes: retryAfter > 0 ? Math.ceil(retryAfter / 60) : null,
    };
  }
  const activities = (await response.json()) as Activity[];
  await saveActivities(activities);
  return activities;
}
