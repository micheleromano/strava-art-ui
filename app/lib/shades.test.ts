import { describe, expect, it } from "vitest";

import { shadeRamp } from "./shades";

describe("shadeRamp", () => {
  it("goes from lighter to darker", () => {
    const [lightest, , darkest] = shadeRamp("#3b82f6", 3);
    expect(lightest > darkest).toBe(true);
  });

  it("keeps the hue", () => {
    // Shades of pure red keep green and blue equal, with red strongest.
    for (const shade of shadeRamp("#ff0000", 4)) {
      const [, red, green, blue] = shade.match(/^#(..)(..)(..)$/) ?? [];
      expect(green).toBe(blue);
      expect(parseInt(red, 16)).toBeGreaterThan(parseInt(green, 16));
    }
  });

  it("uses the colour itself for a single route", () => {
    expect(shadeRamp("#808080", 1)).toEqual(["#808080"]);
  });
});
