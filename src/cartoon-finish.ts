// A small, deterministic color treatment for creator-supplied cutouts. It
// changes only the derived PNG: the uploaded source and mask remain intact.
export type CartoonFinish = "original" | "storybook" | "ink";

export function finishCutoutPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  finish: CartoonFinish,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(pixels);
  if (finish === "original") return result;
  const count = width * height;
  if (pixels.length !== count * 4) throw new Error("This cutout has invalid picture dimensions.");
  const smooth = new Float32Array(count * 3);
  const neighbor = (x: number, y: number, fallback: number) =>
    x >= 0 && y >= 0 && x < width && y < height && pixels[(y * width + x) * 4 + 3] > 0
      ? y * width + x : fallback;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!pixels[i * 4 + 3]) continue;
    const sides = [neighbor(x - 1, y, i), neighbor(x + 1, y, i),
      neighbor(x, y - 1, i), neighbor(x, y + 1, i)];
    for (let channel = 0; channel < 3; channel++)
      smooth[i * 3 + channel] = (pixels[i * 4 + channel] * 4 +
        sides.reduce((sum, side) => sum + pixels[side * 4 + channel], 0)) / 8;
  }
  const brightness = (index: number) =>
    smooth[index * 3] * 0.299 + smooth[index * 3 + 1] * 0.587 + smooth[index * 3 + 2] * 0.114;
  const step = finish === "ink" ? 85 : 42.5;
  const blend = finish === "ink" ? 0.9 : 0.72;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!pixels[i * 4 + 3]) continue;
    const left = neighbor(x - 1, y, i), right = neighbor(x + 1, y, i);
    const above = neighbor(x, y - 1, i), below = neighbor(x, y + 1, i);
    const silhouette = x === 0 || y === 0 || x === width - 1 || y === height - 1 ||
      pixels[(y * width + x - 1) * 4 + 3] === 0 ||
      pixels[(y * width + x + 1) * 4 + 3] === 0 ||
      pixels[((y - 1) * width + x) * 4 + 3] === 0 ||
      pixels[((y + 1) * width + x) * 4 + 3] === 0;
    const outline = finish === "ink" && pixels[i * 4 + 3] > 128 && (
      silhouette ||
      Math.abs(brightness(right) - brightness(left)) + Math.abs(brightness(below) - brightness(above)) > 75);
    for (let channel = 0; channel < 3; channel++) {
      const color = smooth[i * 3 + channel];
      const posterized = Math.round(color / step) * step;
      result[i * 4 + channel] = outline ? Math.round(color * 0.22) :
        Math.round(color * (1 - blend) + posterized * blend);
    }
  }
  return result;
}
