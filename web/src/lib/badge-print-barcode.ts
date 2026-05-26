/** Simple Code 39–style bars for visual barcode on thermal labels (not for production scanners). */
export function barcodeSvgDataUrl(value: string, width = 180, height = 36): string {
  const text = value.trim() || "0";
  const barWidth = 2;
  const gap = 1;
  let x = 4;
  const bars: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const wide = code % 3 === 0;
    bars.push(`<rect x="${x}" y="2" width="${wide ? barWidth + 1 : barWidth}" height="${height - 4}" fill="#0f172a"/>`);
    x += (wide ? barWidth + 1 : barWidth) + gap;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${Math.max(width, x + 4)} ${height}">${bars.join("")}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
