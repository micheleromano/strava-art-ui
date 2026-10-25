import { describe, expect, it } from "vitest";

import type { Route } from "./layouts";
import { countPlaces, PLACE_GRID_DEGREES, placeOf, placesFrom } from "./places";

// A short run: starts at "home", passes through the middle, ends back near home.
const run = (startLat: number, startLng: number): Route => [
  [startLat, startLng],
  [startLat + 0.004, startLng + 0.003],
  [startLat + 0.009, startLng + 0.011],
  [startLat + 0.004, startLng + 0.006],
  [startLat, startLng],
];

describe("placesFrom", () => {
  it("never gives an exact point: every place is on the 25 km grid", () => {
    for (const { location } of placesFrom([
      run(51.5074, -0.1278),
      run(48.8566, 2.3522),
    ])) {
      for (const degrees of location) {
        expect(
          Math.abs(
            degrees / PLACE_GRID_DEGREES -
              Math.round(degrees / PLACE_GRID_DEGREES),
          ),
        ).toBeLessThan(1e-9);
      }
    }
  });

  it("uses the middle of each route, not its start", () => {
    // The start sits just below a grid line; the middle is just above it.
    const route: Route = [
      [51.62, -0.1],
      [51.63, -0.1],
      [51.64, -0.1],
    ];
    const [place] = placesFrom([route]);
    expect(place.location).toEqual([51.75, 0]);
  });

  it("merges routes in the same area into one place, busiest first", () => {
    const places = placesFrom([
      run(48.8566, 2.3522),
      run(51.5074, -0.1278),
      run(51.51, -0.12),
      run(51.505, -0.13),
    ]);
    expect(places.map(({ count }) => count)).toEqual([3, 1]);
    expect(places[0].location).toEqual([51.5, 0]);
  });

  it("gives no places for no routes", () => {
    expect(placesFrom([])).toEqual([]);
  });

  it("counts places that were already rounded, as stored in the sample", () => {
    const stored = [
      placeOf(run(51.5074, -0.1278))!,
      placeOf(run(51.51, -0.12))!,
    ];
    expect(countPlaces(stored)).toEqual([{ location: [51.5, 0], count: 2 }]);
  });
});
