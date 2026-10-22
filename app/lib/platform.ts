export type Platform = "mac" | "windows" | "ios" | "android" | "other";

/** The kind of device, so wallpaper instructions can name the right steps. */
export function platformFrom(
  userAgent: string,
  maxTouchPoints: number,
): Platform {
  // iPads ask for desktop sites and report themselves as Macs, but have touch screens.
  if (/iPhone|iPad|iPod/.test(userAgent)) return "ios";
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Macintosh/.test(userAgent)) return "mac";
  return "other";
}
