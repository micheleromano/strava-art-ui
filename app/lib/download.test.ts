import { describe, expect, it } from "vitest";

import { screenPngSize } from "./download";

describe("screenPngSize", () => {
  it("uses the screen's real pixels", () => {
    expect(screenPngSize(1440, 900, 2)).toEqual({ width: 2880, height: 1800 });
    expect(screenPngSize(390, 844, 3)).toEqual({ width: 1170, height: 2532 });
  });

  it("ignores browser zoom past 3×, which only makes files bigger", () => {
    expect(screenPngSize(1440, 900, 5)).toEqual(screenPngSize(1440, 900, 3));
  });

  it("stays within what phones can draw, keeping the screen's shape", () => {
    const { width, height } = screenPngSize(3840, 2160, 3);
    expect(width * height).toBeLessThanOrEqual(16_777_216);
    expect(Math.max(width, height)).toBeLessThanOrEqual(8192);
    expect(width / height).toBeCloseTo(3840 / 2160, 2);
  });
});
