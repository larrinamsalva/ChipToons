// Remove only the connected plain-color region selected by the creator.
// The original image and outline are never changed.
export function clearConnectedBackground(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  tolerance: number,
): Uint8ClampedArray {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      source.length !== width * height * 4 || !Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || x >= width || y < 0 || y >= height ||
      !Number.isFinite(tolerance) || tolerance < 0 || tolerance > 100)
    throw new Error("Choose a valid background spot and cleanup strength.");
  const result = new Uint8ClampedArray(source);
  const start = (y * width + x) * 4;
  if (!source[start + 3])
    throw new Error("Tap a visible background spot inside the cutout outline.");
  const queue = new Int32Array(width * height);
  const visited = new Uint8Array(width * height);
  const color = [source[start], source[start + 1], source[start + 2]];
  const maximum = tolerance * tolerance;
  let head = 0, tail = 0;
  function visit(index: number) {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (!source[offset + 3]) return;
    const difference = (source[offset] - color[0]) ** 2 +
      (source[offset + 1] - color[1]) ** 2 +
      (source[offset + 2] - color[2]) ** 2;
    if (difference > maximum) return;
    result[offset + 3] = 0;
    queue[tail++] = index;
  }
  visit(y * width + x);
  while (head < tail) {
    const index = queue[head++], column = index % width;
    if (column > 0) visit(index - 1);
    if (column < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index < width * (height - 1)) visit(index + width);
  }
  if (tail === width * height || !result.some((alpha, index) => index % 4 === 3 && alpha > 0))
    throw new Error("Cleanup removed all visible artwork. Choose a different spot or lower the strength.");
  return result;
}
