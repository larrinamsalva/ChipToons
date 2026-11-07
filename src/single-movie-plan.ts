import type { DeliveryMedia } from "./episode-delivery";

const MIB = 1024 * 1024;
// 20 minutes at our normal 2 Mbps video + 128 kbps audio target is
// roughly 319 MB of source, so 256 MiB can reject an otherwise verified
// complete episode. Bound assembly to the same 512 MiB as desktop ZIPs;
// the staging estimate below still checks for ample *additional* disk.
export const MOVIE_BYTES = 512 * MIB;
export const MOVIE_STAGING_DIRECTORY = "chiptoons-movie-staging";
export const MOVIE_MAX_SECONDS = 1200;
export const MOVIE_PACKET_TAIL_LIMIT = 0.4;
export const MOVIE_TIMELINE_TOLERANCE = 0.6;
// MediaRecorder includes the intentional 0.15s recording lead-in and can
// finish with a short encoder tail. Permit only the SAME bounded margin
// that the movie worker will enforce while inspecting real packet timestamps.
// The delivery review permits up to 1s, but movie assembly remains stricter.
export const MOVIE_PART_TOLERANCE = MOVIE_TIMELINE_TOLERANCE;
export const OPUS_SAMPLE_RATE = 48_000;
export const MOVIE_OPUS_BITRATE = 192_000;

export interface MoviePart {
  file: File;
  sha256: string;
  media: DeliveryMedia;
  start: number;
  end: number;
}

export interface MovieRange {
  start: number;
  end: number;
}

export type MovieProgress = { label: string; fraction: number };
export type MovieWorkerMessage =
  | { type: "progress"; progress: MovieProgress }
  | { type: "done"; ranges: MovieRange[] }
  | { type: "error"; message: string };

export interface MovieWorkerRequest {
  parts: MoviePart[];
  directory: FileSystemDirectoryHandle;
  name: string;
}

export function moviePlanProblem(parts: MoviePart[]) {
  if (parts.length < 2 || parts.length > 120) return "Choose and check at least two numbered video parts.";
  const first = parts[0].media;
  if (first.codec !== "VP8" ||
      !((first.width === 800 && first.height === 450) || (first.width === 1280 && first.height === 720)))
    return "Make one movie from matching VP8 ChipToons exports at 800 × 450 or 1280 × 720.";
  const fps = parts.find(part => part.media.fps !== undefined)?.media.fps;
  let end = 0;
  let size = 0;
  const hashes = new Set<string>();
  for (const [index, part] of parts.entries()) {
    const { media } = part;
    if (!Number.isFinite(part.start) || Math.abs(part.start - end) > 0.001 || !(part.end > part.start) || part.end - part.start > 120.001)
      return "Check the story order and scene range of each video part.";
    if (!/^[a-f0-9]{64}$/.test(part.sha256) || !part.file.size)
      return "Check the selected file and its checksum before making one movie.";
    if (hashes.has(part.sha256)) return "Each video part must appear once.";
    if (media.codec !== first.codec || media.width !== first.width || media.height !== first.height ||
        (media.fps !== undefined && fps !== undefined && Math.abs(media.fps - fps) > 0.5))
      return "Choose video parts exported at the same size, codec and frame rate.";
    if (media.audio !== first.audio || (media.audio && media.audio !== "Opus"))
      return "Choose parts with matching Opus sound or export every part without sound.";
    if (!Number.isFinite(media.duration) ||
        Math.abs(media.duration - (part.end - part.start)) > MOVIE_PART_TOLERANCE)
      return `Part ${index + 1} has unusual timing (${Number.isFinite(media.duration)
        ? media.duration.toFixed(3) + "s" : "invalid duration"} for a ${(part.end - part.start).toFixed(3)}s scene range). Re-export that part before making one movie.`;
    end = part.end;
    size += part.file.size;
    hashes.add(part.sha256);
  }
  if (end > MOVIE_MAX_SECONDS + 0.001 || size > MOVIE_BYTES)
    return "One movie supports up to 20 planned minutes and 512 MiB of source video. Keep the checked episode ZIP for larger projects.";
  return "";
}

export function movieSpaceNeeded(parts: MoviePart[]) {
  const sourceBytes = parts.reduce((size, part) => size + part.file.size, 0);
  const audioBytes = parts[0]?.media.audio
    ? (parts.at(-1)!.end + parts.length * MOVIE_TIMELINE_TOLERANCE) * (MOVIE_OPUS_BITRATE / 8)
    : 0;
  // A browser can keep both the in-progress write and its finished snapshot.
  return 2 * Math.min(MOVIE_BYTES, sourceBytes + audioBytes) + 32 * MIB;
}

export function movieDeviceProblem(narrow: boolean, memory?: number) {
  if (narrow || (memory !== undefined && memory < 4))
    return "Make one movie on a larger screen with more memory. You can still watch and package the individual parts here.";
  if (!globalThis.isSecureContext || typeof Worker === "undefined" || typeof VideoDecoder === "undefined" || typeof FileSystemFileHandle === "undefined" ||
      typeof FileSystemFileHandle.prototype.createWritable !== "function" || !navigator.storage?.getDirectory ||
      !navigator.storage.estimate || !navigator.locks)
    return "This browser cannot assemble and check one movie locally. Try a current desktop Chromium browser or keep the episode ZIP.";
  return "";
}
