import { describe, expect, it } from "vitest";

import { trimEnds } from "./trim-ends";

// Points ~111 m apart, heading north along a meridian: 0.001° of latitude ≈ 111 m.
const straight = (count: number) =>
  Array.from({ length: count }, (_, i): [number, number] => [
    51 + i * 0.001,
    0,
  ]);

describe("trimEnds", () => {
  it("removes points within the trim distance of either end", () => {
    // 21 points ≈ 2.2 km. Points 0–4 (< 500 m from the start) and 16–20 go.
    const trimmed = trimEnds(straight(21), 500);
    expect(trimmed[0][0]).toBeCloseTo(51.005);
    expect(trimmed.at(-1)?.[0]).toBeCloseTo(51.015);
  });

  it("drops routes too short to keep anything after trimming", () => {
    expect(trimEnds(straight(9), 500)).toEqual([]);
  });

  it("keeps empty routes empty", () => {
    expect(trimEnds([], 500)).toEqual([]);
  });
});
