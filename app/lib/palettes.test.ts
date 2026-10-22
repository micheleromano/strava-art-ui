import { describe, expect, it } from "vitest";

import { contrastRatio, MIN_GRAPHIC_CONTRAST } from "./contrast";
import { PALETTES } from "./palettes";
import { shadeRamp } from "./shades";

describe("palettes", () => {
  it.each(PALETTES)(
    "$id has enough contrast, even for its lightest and darkest shades",
    ({ background, line }) => {
      for (const colour of [line, ...shadeRamp(line, 2)]) {
        expect(contrastRatio(background, colour)).toBeGreaterThanOrEqual(
          MIN_GRAPHIC_CONTRAST,
        );
      }
    },
  );
});
