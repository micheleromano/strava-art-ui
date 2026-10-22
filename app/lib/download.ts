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
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
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
