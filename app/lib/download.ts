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

export async function downloadPng(
  svg: SVGSVGElement,
  filename: string,
  size: number,
) {
  const url = URL.createObjectURL(svgBlob(svg));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d")?.drawImage(image, 0, 0, size, size);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG export failed")),
        "image/png",
      ),
    );
    saveBlob(png, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
