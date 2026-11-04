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
function element(bytes: Uint8Array, start: number, unknownEnd = bytes.length): Element {
  if (start < 0 || start >= bytes.length) throw new Error("Invalid WebM element");
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
    end: unknown ? unknownEnd : data + size,
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

export const WEBM_METADATA_LIMIT = 1024 * 1024;
export interface WebmTracks {
  codec: "VP8" | "VP9";
  width: number;
  height: number;
  audio?: "Opus" | "Vorbis";
  fps?: number;
}

function webmChildren(bytes: Uint8Array, parent: Element) {
  if (parent.unknown || parent.end > bytes.length || parent.end < parent.data)
    throw new Error("Incomplete WebM track information.");
  const children: Element[] = [];
  for (let at = parent.data; at < parent.end;) {
    const child = element(bytes, at);
    if (child.unknown || child.end > parent.end || child.end <= at || children.length >= 256)
      throw new Error("Invalid WebM track information.");
    children.push(child);
    at = child.end;
  }
  return children;
}

function webmNumber(bytes: Uint8Array, item?: Element) {
  if (!item || item.end - item.data > 6) return 0;
  let number = 0;
  for (let i = item.data; i < item.end; i++) number = number * 256 + bytes[i];
  return number;
}

export function readWebmTracks(bytes: Uint8Array, fileSize: number): WebmTracks {
  const header = element(bytes, 0);
  if (header.id !== 0x1a45dfa3) throw new Error("This file is not a WebM container.");
  const docType = webmChildren(bytes, header).find(child => child.id === 0x4282);
  const decode = (item?: Element) => item && new TextDecoder().decode(bytes.subarray(item.data, item.end));
  if (decode(docType) !== "webm") throw new Error("This file is not a WebM container.");
  const segment = element(bytes, header.end, fileSize);
  if (segment.id !== 0x18538067 || segment.end > fileSize)
    throw new Error("The WebM segment is damaged or incomplete.");
  let video: WebmTracks | undefined;
  let audio: WebmTracks["audio"];
  for (let at = segment.data; at < Math.min(segment.end, bytes.length);) {
    const child = element(bytes, at);
    if (child.id === 0x1f43b675) break;
    if (child.unknown || child.end <= at || child.end > segment.end || child.end > bytes.length)
      throw new Error("WebM track information is missing or outside the metadata limit.");
    if (child.id === 0x1654ae6b) {
      for (const entry of webmChildren(bytes, child)) {
        if (entry.id !== 0xae) continue;
        const fields = webmChildren(bytes, entry);
        const get = (id: number) => fields.find(field => field.id === id);
        const type = webmNumber(bytes, get(0x83));
        const codec = decode(get(0x86));
        if (type === 1) {
          if (video || (codec !== "V_VP8" && codec !== "V_VP9"))
            throw new Error("Choose a WebM with one VP8 or VP9 video track.");
          const picture = get(0xe0);
          if (!picture) throw new Error("WebM dimensions are missing.");
          const dimensions = webmChildren(bytes, picture);
          const width = webmNumber(bytes, dimensions.find(field => field.id === 0xb0));
          const height = webmNumber(bytes, dimensions.find(field => field.id === 0xba));
          if (!width || !height || width > 4096 || height > 4096)
            throw new Error("This WebM has missing or unsupported video dimensions.");
          const frameDuration = webmNumber(bytes, get(0x23e383));
          const fps = frameDuration ? 1e9 / frameDuration : undefined;
          video = { codec: codec === "V_VP8" ? "VP8" : "VP9", width, height,
            ...(fps && fps >= 1 && fps <= 240 ? { fps } : {}) };
        } else if (type === 2) {
          if (audio || (codec !== "A_OPUS" && codec !== "A_VORBIS"))
            throw new Error("Choose a WebM with one Opus or Vorbis audio track.");
          audio = codec === "A_OPUS" ? "Opus" : "Vorbis";
        }
      }
      break;
    }
    at = child.end;
  }
  if (!video) throw new Error("No readable WebM video track was found.");
  return { ...video, ...(audio ? { audio } : {}) };
}

export function isChromiumWebmRecording(bytes: Uint8Array, fileSize: number) {
  const header = element(bytes, 0);
  const segment = element(bytes, header.end, fileSize);
  if (header.id !== 0x1a45dfa3 || segment.id !== 0x18538067 || segment.end > fileSize) return false;
  for (let at = segment.data; at < Math.min(segment.end, bytes.length);) {
    const field = element(bytes, at);
    if (field.unknown || field.end > bytes.length || field.end > segment.end) return false;
    if (field.id === 0x1549a966) {
      const metadata = webmChildren(bytes, field);
      return [0x4d80, 0x5741].every(id => {
        const app = metadata.find(item => item.id === id);
        return app && new TextDecoder().decode(bytes.subarray(app.data, app.end)) === "Chrome";
      });
    }
    if (field.id === 0x1f43b675) return false;
    at = field.end;
  }
  return false;
}
