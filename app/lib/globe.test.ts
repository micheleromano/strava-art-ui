import { describe, expect, it } from "vitest";

import {
  defaultTilt,
  globeColours,
  markersFor,
  spinFacing,
  spinFor,
  tiltAngle,
  toRgb,
} from "./globe";

describe("toRgb", () => {
  it("converts hex to 0–1 channels", () => {
    expect(toRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
  });
});

describe("markersFor", () => {
  it("makes the busiest place biggest and keeps quiet places visible", () => {
    const [busy, quiet] = markersFor([
      { location: [51.5, 0], count: 100 },
      { location: [48.75, 2.25], count: 1 },
    ]);
    expect(busy.size).toBeCloseTo(0.1);
    expect(quiet.size).toBeGreaterThanOrEqual(0.03);
    expect(quiet.size).toBeLessThan(busy.size);
    expect(busy.location).toEqual([51.5, 0]);
  });
});

describe("spinFacing", () => {
  it("turns further east as longitude increases", () => {
    expect(spinFacing([51.5, 0]) - spinFacing([35.75, 139.75])).toBeCloseTo(
      (139.75 * Math.PI) / 180,
    );
  });
});

describe("spinFor", () => {
  const oneSecond = (framesPerSecond: number) =>
    Array.from({ length: framesPerSecond }, () =>
      spinFor(1000 / framesPerSecond),
    ).reduce((total, step) => total + step, 0);

  it("turns the same amount each second, whatever the frame rate", () => {
    expect(oneSecond(30)).toBeCloseTo(oneSecond(60));
    expect(oneSecond(120)).toBeCloseTo(oneSecond(60));
  });

  it("makes one full turn every 35 seconds", () => {
    expect(oneSecond(60) * 35).toBeCloseTo(2 * Math.PI);
  });

  it("doesn't jump after a long pause between frames", () => {
    expect(spinFor(5000)).toBe(spinFor(100));
  });
});

describe("defaultTilt", () => {
  it("tilts half way toward the busiest place, north or south", () => {
    expect(defaultTilt([{ location: [51.5, 0], count: 3 }])).toBe(26);
    expect(defaultTilt([{ location: [-33.75, 151.25], count: 1 }])).toBe(-17);
  });

  it("tilts slightly north when there are no places yet", () => {
    expect(defaultTilt([])).toBe(15);
  });
});

describe("tiltAngle", () => {
  it("turns degrees into cobe's radians, south negative", () => {
    expect(tiltAngle(90)).toBeCloseTo(Math.PI / 2);
    expect(tiltAngle(-45)).toBeCloseTo(-Math.PI / 4);
  });
});

describe("globeColours", () => {
  it("draws a dark globe on a dark background and a light one on a light background", () => {
    expect(globeColours("#0f172a").dark).toBe(1);
    expect(globeColours("#f5f0e6").dark).toBe(0);
  });
});
