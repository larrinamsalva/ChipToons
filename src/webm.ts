// MediaRecorder writes streaming WebM without a duration on Chromium. Add only
// container metadata; the encoded VP8/VP9 frames and Opus packets stay intact.
type Element = {
  id: number;
  start: number;
  data: number;
  end: number;
  sizeWidth: number;
  unknown: boolean;
};
function element(bytes: Uint8Array, start: number): Element {
  let n = 1;
  while (n <= 4 && !(bytes[start] & (1 << (8 - n)))) n++;
  if (n > 4) throw new Error("Invalid WebM element");
  let id = 0;
  for (let i = 0; i < n; i++) id = id * 256 + bytes[start + i];
  const sizeStart = start + n;
  let width = 1;
  while (width <= 8 && !(bytes[sizeStart] & (1 << (8 - width)))) width++;
  if (width > 8 || sizeStart + width > bytes.length)
    throw new Error("Invalid WebM size");
  let size = bytes[sizeStart] & ((1 << (8 - width)) - 1);
  let unknown = size === (1 << (8 - width)) - 1;
  for (let i = 1; i < width; i++) {
    size = size * 256 + bytes[sizeStart + i];
    unknown &&= bytes[sizeStart + i] === 255;
  }
  const data = sizeStart + width;
  return {
    id,
    start,
    data,
    end: unknown ? bytes.length : data + size,
    sizeWidth: width,
    unknown,
  };
}
function sizeBytes(size: number, width: number) {
  if (size >= 2 ** (7 * width) - 1)
    throw new Error("WebM metadata is too large");
  const out = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) {
    out[i] = size % 256;
    size = Math.floor(size / 256);
  }
  out[0] |= 1 << (8 - width);
  return out;
}
export function webmDuration(bytes: Uint8Array, seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0)
    throw new Error("Invalid movie duration");
  const header = element(bytes, 0),
    segment = element(bytes, header.end);
  if (header.id !== 0x1a45dfa3 || segment.id !== 0x18538067)
    throw new Error("Invalid WebM container");
  let info: Element | undefined,
    scale = 1000000,
    duration: Element | undefined;
  // Streaming recorders have no absolute seek offsets. Preserve containers with
  // a SeekHead rather than invalidating their existing offsets by inserting data.
  for (let at = segment.data; at < segment.end;) {
    const e = element(bytes, at);
    if (e.id === 0x114d9b74) return bytes;
    if (e.id === 0x1549a966) info = e;
    if (e.id === 0x1f43b675) break;
    if (e.end <= at || e.end > bytes.length)
      throw new Error("Invalid WebM metadata");
    at = e.end;
  }
  if (!info) throw new Error("WebM movie information is missing");
  for (let at = info.data; at < info.end;) {
    const e = element(bytes, at);
    if (e.end <= at || e.end > info.end)
      throw new Error("Invalid WebM information");
    if (e.id === 0x2ad7b1) {
      scale = 0;
      for (let i = e.data; i < e.end; i++) scale = scale * 256 + bytes[i];
    }
    if (e.id === 0x4489) duration = e;
    at = e.end;
  }
  const value = new Uint8Array(8);
  new DataView(value.buffer).setFloat64(0, (seconds * 1e9) / scale);
  if (duration) {
    const copy = bytes.slice(),
      view = new DataView(copy.buffer);
    if (duration.end - duration.data === 8)
      view.setFloat64(duration.data, (seconds * 1e9) / scale);
    else if (duration.end - duration.data === 4)
      view.setFloat32(duration.data, (seconds * 1e9) / scale);
    else throw new Error("Invalid WebM duration field");
    return copy;
  }
  const field = new Uint8Array([0x44, 0x89, 0x88, ...value]),
    result = new Uint8Array(bytes.length + field.length);
  result.set(bytes.subarray(0, info.end));
  result.set(field, info.end);
  result.set(bytes.subarray(info.end), info.end + field.length);
  result.set(
    sizeBytes(info.end - info.data + field.length, info.sizeWidth),
    info.data - info.sizeWidth,
  );
  if (!segment.unknown)
    result.set(
      sizeBytes(segment.end - segment.data + field.length, segment.sizeWidth),
      segment.data - segment.sizeWidth,
    );
  return result;
}
