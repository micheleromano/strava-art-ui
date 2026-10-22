// WCAG 2.2 asks for at least 3:1 between graphics and what's next to them (success criterion 1.4.11).
export const MIN_GRAPHIC_CONTRAST = 3;

/** WCAG contrast ratio between two `#rrggbb` colours, from 1 (same) to 21 (black on white). */
export function contrastRatio(hexA: string, hexB: string): number {
  const [lighter, darker] = [luminance(hexA), luminance(hexB)].sort(
    (a, b) => b - a,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
