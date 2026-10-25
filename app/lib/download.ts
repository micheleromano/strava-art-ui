function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

function svgBlob(svg: SVGSVGElement): Blob {
  return new Blob([new XMLSerializer().serializeToString(svg)], {
    type: "image/svg+xml",
  });
}

export function downloadSvg(svg: SVGSVGElement, filename: string) {
  saveBlob(svgBlob(svg), filename);
}

// Phones (Safari especially) can't make canvases bigger than about 16.7 million pixels.
const MAX_PNG_PIXELS = 16_777_216;
const MAX_PNG_SIDE = 8192;
// Browser zoom raises devicePixelRatio; beyond 3× it only makes files bigger.
const MAX_PIXEL_RATIO = 3;

/** The PNG size for a screen-shaped picture: the screen's real pixels, within what phones can draw. */
export function screenPngSize(
  screenWidth: number,
  screenHeight: number,
  pixelRatio: number,
): { width: number; height: number } {
  const ratio = Math.min(pixelRatio, MAX_PIXEL_RATIO);
  const [width, height] = [screenWidth * ratio, screenHeight * ratio];
  const shrink = Math.min(
    1,
    MAX_PNG_SIDE / Math.max(width, height),
    Math.sqrt(MAX_PNG_PIXELS / (width * height)),
  );
  return {
    width: Math.floor(width * shrink),
    height: Math.floor(height * shrink),
  };
}

/** Draws the SVG onto a `width` × `height` canvas and returns it as a PNG. */
export async function makePng(
  svg: SVGSVGElement,
  width: number,
  height: number,
): Promise<Blob> {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    // Without this, a canvas the browser couldn't create would give a blank picture.
    if (!context) throw new Error("Couldn't create a canvas this size");
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG export failed")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A PNG of the globe's canvas, as drawn: as sharp as it is on screen. With a `background` colour it's filled in behind
 * the globe; without one the PNG keeps a transparent background, ready to put on a website.
 */
export async function globePng(
  canvas: HTMLCanvasElement,
  background: string | null,
): Promise<Blob> {
  const output = document.createElement("canvas");
  output.width = canvas.width;
  output.height = canvas.height;
  const context = output.getContext("2d");
  if (!context) throw new Error("Couldn't create a canvas this size");
  if (background) {
    context.fillStyle = background;
    context.fillRect(0, 0, output.width, output.height);
  }
  context.drawImage(canvas, 0, 0);
  return new Promise<Blob>((resolve, reject) =>
    output.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed"))),
      "image/png",
    ),
  );
}

export function downloadPng(png: Blob, filename: string) {
  saveBlob(png, filename);
}

/** Whether this browser can hand image files to the device's share menu (mostly phones). */
export function canSharePng(): boolean {
  const probe = new File([], "probe.png", { type: "image/png" });
  return navigator.canShare?.({ files: [probe] }) ?? false;
}

/**
 * Opens the device's share menu with the PNG, where people can save it to Photos.
 * Returns false if they closed the menu without sharing.
 */
export async function sharePng(png: Blob, filename: string): Promise<boolean> {
  try {
    await navigator.share({
      files: [new File([png], filename, { type: "image/png" })],
    });
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return false;
    }
    throw error;
  }
}
