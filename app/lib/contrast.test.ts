import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("matches WCAG's figures", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#777777")).toBe(1);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
});
