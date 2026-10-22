// How far, in HSL lightness, the lightest and darkest shades sit from each other.
const SHADE_SPREAD = 0.3;

/** `count` shades of the `#rrggbb` colour: same hue, from lighter (first) to darker (last). */
export function shadeRamp(hex: string, count: number): string[] {
  const [hue, saturation, lightness] = toHsl(hex);
  const lightest = Math.min(lightness + SHADE_SPREAD / 2, 0.95);
  const darkest = Math.max(lightness - SHADE_SPREAD / 2, 0.05);
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return toHex(hue, saturation, lightest + (darkest - lightest) * t);
  });
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(
    (start) => parseInt(hex.slice(start, start + 2), 16) / 255,
  );
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  const hue =
    max === r
      ? ((g - b) / delta + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / delta + 2) * 60
        : ((r - g) / delta + 4) * 60;
  return [hue, saturation, lightness];
}

function toHex(hue: number, saturation: number, lightness: number): string {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    const value =
      lightness - (chroma / 2) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
