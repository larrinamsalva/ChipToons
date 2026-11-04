import type { Project } from "./model";
import type { ExportSegment } from "./segments";
import { safeFilename } from "./files";
import { readWebmTracks, WEBM_METADATA_LIMIT } from "./webm";
import type { WebmTracks } from "./webm";
import { checkDeliveryAbort, deliveryDigest } from "./delivery-bytes";
import { readStoredZip, storedZip } from "./delivery-zip";
import type { StoredEntry } from "./delivery-zip";

export const MAX_VIDEO_PART_BYTES = 81 * 1024 * 1024;
export const MAX_PART_DURATION_DRIFT = 1;
const MAX_PARTS = 120, MAX_TEXT_BYTES = 512 * 1024, MAX_SUBTITLE_BYTES = 1024 * 1024;
const ORDER_FILE = "part-order.json", README_FILE = "README.txt";
const hex = /^[a-f0-9]{64}$/;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const integer = (value: unknown, min: number, max: number): value is number =>
  finite(value, min, max) && Number.isInteger(value);
const close = (left: number, right: number) => Math.abs(left - right) < 0.001;

export interface ExportReceipt {
  first: number;
  last: number;
  start: number;
  end: number;
  size: number;
  sha256: string;
  fps: number;
  width: number;
  height: number;
  audio: boolean;
  captions: boolean;
}
const receiptKey = (project: Project) => `chiptoons-delivery-receipts:${project.id}`;
function isReceipt(value: unknown): value is ExportReceipt {
  return record(value) && integer(value.first, 0, 119) && integer(value.last, value.first, 119) &&
    finite(value.start, 0, 14400) && finite(value.end, value.start + 1, 14401) &&
    integer(value.size, 1000, MAX_VIDEO_PART_BYTES) && typeof value.sha256 === "string" && hex.test(value.sha256) &&
    finite(value.fps, 1, 240) && integer(value.width, 1, 4096) && integer(value.height, 1, 4096) &&
    typeof value.audio === "boolean" && typeof value.captions === "boolean";
}
export function exportReceipts(project: Project): ExportReceipt[] {
  try {
    const raw = localStorage.getItem(receiptKey(project));
    if (!raw || raw.length > 65536) return [];
    const data: unknown = JSON.parse(raw);
    return record(data) && data.revision === project.updatedAt && Array.isArray(data.receipts)
      ? data.receipts.slice(-MAX_PARTS).filter(isReceipt) : [];
  } catch {
    return [];
  }
}
export function rememberExportReceipt(project: Project, receipt: ExportReceipt) {
  if (!isReceipt(receipt)) return;
  try {
    const receipts = [...exportReceipts(project).filter(item => item.sha256 !== receipt.sha256), receipt].slice(-MAX_PARTS);
    localStorage.setItem(receiptKey(project), JSON.stringify({ revision: project.updatedAt, receipts }));
  } catch {
    // Download works even when the browser does not allow receipt storage.
  }
}
function receiptFits(receipt: ExportReceipt, range: ExportSegment) {
  return receipt.first === range.firstScene && receipt.last === range.lastScene &&
    close(receipt.start, range.start) && close(receipt.end, range.end);
}

export interface DeliveryMedia extends WebmTracks {
  duration: number;
  fpsSource?: "track" | "export-setting";
}
export interface DeliveryFile {
  file: File;
  sha256: string;
  crc32: number;
  media: DeliveryMedia;
  receipt?: ExportReceipt;
}
export async function inspectDeliveryFile(file: File, receipts: ExportReceipt[],
  probe: (blob: Blob, signal: AbortSignal) => Promise<{ width: number; height: number; duration: number }>,
  signal: AbortSignal): Promise<DeliveryFile> {
  if (file.size > MAX_VIDEO_PART_BYTES || file.size < 1000)
    throw new Error("Choose a complete WebM part under 81 MiB.");
  checkDeliveryAbort(signal);
  const tracks = readWebmTracks(new Uint8Array(await file.slice(0, WEBM_METADATA_LIMIT).arrayBuffer()), file.size);
  checkDeliveryAbort(signal);
  const video = file.slice(0, file.size, "video/webm");
  const decoded = await probe(video, signal);
  if (!finite(decoded.duration, 0.01, 121) || decoded.width !== tracks.width || decoded.height !== tracks.height)
    throw new Error("The playable WebM duration or dimensions do not match its track information.");
  const digest = await deliveryDigest(file, signal);
  const receipt = receipts.find(item => item.sha256 === digest.sha256 && item.size === file.size);
  return { file, ...digest, receipt, media: { ...tracks, duration: decoded.duration,
    ...(tracks.fps ? { fpsSource: "track" as const } :
      receipt ? { fps: receipt.fps, fpsSource: "export-setting" as const } : {}),
  } };
}
export function partTag(index: number, segment: ExportSegment) {
  return `part-${String(index + 1).padStart(2, "0")}-scenes-${segment.firstScene + 1}-${segment.lastScene + 1}`;
}

export function suggestPart(file: DeliveryFile, plan: ExportSegment[]) {
  if (file.receipt) {
    const index = plan.findIndex(segment => receiptFits(file.receipt!, segment));
    return index < 0 ? undefined : index;
  }
  const name = file.file.name.match(/(?:^|-)part-(\d+)-scenes-(\d+)-(\d+)(?: ?\(\d+\))?\.webm$/i);
  const ranges = file.file.name.match(/(?:^|-)scenes-(\d+)-(\d+)(?: ?\(\d+\))?\.webm$/i);
  if (!ranges) return;
  const matching = plan.findIndex(segment => segment.firstScene + 1 === Number(ranges[1]) &&
    segment.lastScene + 1 === Number(ranges[2]));
  if (matching >= 0 && (!name || Number(name[1]) === matching + 1)) return matching;
}

export function partProblem(file: DeliveryFile, range: ExportSegment, expectAudio: boolean) {
  if (file.receipt && !receiptFits(file.receipt, range)) return "This exact export belongs to a different scene range.";
  if (Math.abs(file.media.duration - range.duration) > MAX_PART_DURATION_DRIFT)
    return `Duration mismatch. File: ${file.media.duration.toFixed(2)}s. Plan: ${range.duration.toFixed(2)}s.`;
  if ((file.receipt?.audio ?? expectAudio) && !file.media.audio) return "An expected audio track is missing.";
  if (file.receipt && (file.media.width !== file.receipt.width || file.media.height !== file.receipt.height))
    return "The dimensions do not match the recorded export.";
  return "";
}

function incompatibleMedia(tracks: DeliveryMedia[]) {
  const baseline = tracks[0];
  const frameRate = tracks.find(media => media.fps !== undefined)?.fps;
  const audio = tracks.find(media => media.audio)?.audio;
  return tracks.some(media => baseline && (media.codec !== baseline.codec ||
    media.width !== baseline.width || media.height !== baseline.height ||
    (audio && media.audio && audio !== media.audio) ||
    (media.fps && frameRate && Math.abs(media.fps - frameRate) > 0.5)));
}

export function reviewDelivery(plan: ExportSegment[], files: DeliveryFile[], assignments: Record<number, string>, expectAudio: boolean) {
  const rows = plan.map((segment, index) => {
    const file = files.find(item => item.sha256 === assignments[index]);
    return { segment, index, file, issue: file ? partProblem(file, segment, expectAudio) : "Missing video part" };
  });
  const assigned = rows.flatMap(row => row.file ? [row.file] : []);
  const sameFile = new Set(assigned.map(file => file.sha256));
  const extras = files.filter(file => !sameFile.has(file.sha256));
  const compatibility = incompatibleMedia(assigned.map(file => file.media));
  const ready = !!rows.length && rows.every(row => !row.issue) && !extras.length &&
    sameFile.size === assigned.length && !compatibility;
  return { rows, extras, compatibility, ready, duplicate: sameFile.size !== assigned.length };
}

interface DeliveryEntry { name: string; size: number; sha256: string }
export interface DeliveryManifest {
  format: "chiptoons-delivery";
  version: 1;
  title: string;
  seconds: number;
  sceneCount: number;
  readme: DeliveryEntry;
  parts: {
    order: number; firstScene: number; lastScene: number; start: number; end: number;
    video: DeliveryEntry; subtitle?: DeliveryEntry; media: DeliveryMedia;
    identity: "recorded-export" | "creator-assigned";
    burnedCaptions?: boolean;
  }[];
}
export interface DeliveryPlayerPart { label: string; start: number; end: number; video: Blob; subtitle?: Blob; baked?: boolean }

const entry = (name: string, blob: Blob, sha256: string): DeliveryEntry => ({ name, size: blob.size, sha256 });
function captionFile(captions: string) {
  return new Blob([captions], { type: "application/x-subrip;charset=utf-8" });
}
export function deliveryFilename(title: string) {
  return `${safeFilename(title)}-episode-delivery.zip`;
}
export async function prepareDelivery(project: Project, plan: ExportSegment[], files: DeliveryFile[], assignments: Record<number, string>,
  expectAudio: boolean, subtitles: string[], signal: AbortSignal, onBytes?: (count: number) => void) {
  const review = reviewDelivery(plan, files, assignments, expectAudio);
  if (!review.ready) throw new Error("Check and assign every planned part before preparing delivery.");
  const readme = new Blob([`${project.title}\n\nPlay the numbered WebM files in ascending order. Open the matching SRT in your player if needed.\nThe JSON manifest lists the original scene ranges, planned story times, and SHA-256 checksums.\nThis delivery contains finished viewing files. Use a separate ChipToons project backup to keep editing.\n`], { type: "text/plain" });
  const digest = await deliveryDigest(readme, signal);
  const entries: StoredEntry[] = [{ name: README_FILE, blob: readme, crc32: digest.crc32 }];
  const parts: DeliveryManifest["parts"] = [];
  for (const { segment, index, file: row } of review.rows) {
    checkDeliveryAbort(signal);
    const file = row!;
    const tag = partTag(index, segment);
    const verified = await deliveryDigest(file.file, signal, onBytes);
    if (verified.sha256 !== file.sha256 || verified.crc32 !== file.crc32)
      throw new Error(`Part ${index + 1} changed after review. Choose the file again.`);
    const video = entry(`${tag}.webm`, file.file, verified.sha256);
    entries.push({ name: video.name, blob: file.file, crc32: verified.crc32 });
    let subtitle: DeliveryEntry | undefined;
    if (subtitles[index]?.trim()) {
      const blob = captionFile(subtitles[index]);
      const digest = await deliveryDigest(blob, signal);
      subtitle = entry(`${tag}.srt`, blob, digest.sha256);
      entries.push({ name: subtitle.name, blob, crc32: digest.crc32 });
    }
    parts.push({ order: index + 1, firstScene: segment.firstScene + 1, lastScene: segment.lastScene + 1,
      start: segment.start, end: segment.end, video, ...(subtitle ? { subtitle } : {}), media: file.media,
      identity: file.receipt ? "recorded-export" : "creator-assigned",
      ...(file.receipt ? { burnedCaptions: file.receipt.captions } : {}) });
  }
  const manifest: DeliveryManifest = {
    format: "chiptoons-delivery", version: 1, title: project.title, seconds: plan.at(-1)!.end,
    sceneCount: project.scenes.length, readme: entry(README_FILE, readme, digest.sha256), parts,
  };
  const text = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
  entries.push({ name: ORDER_FILE, blob: text, crc32: (await deliveryDigest(text, signal)).crc32 });
  return { manifest, text, entries };
}

function parseManifest(raw: unknown): DeliveryManifest {
  const invalid = () => { throw new Error("The delivery manifest is incomplete, invalid, or out of order."); };
  function descriptor(value: unknown, name: string, max: number): value is DeliveryEntry {
    return record(value) && value.name === name && integer(value.size, 1, max) &&
      typeof value.sha256 === "string" && hex.test(value.sha256);
  }
  if (!record(raw) || raw.format !== "chiptoons-delivery" || raw.version !== 1 ||
      typeof raw.title !== "string" || !raw.title.trim() || raw.title.length > 200 ||
      !finite(raw.seconds, 2, 14400) || !integer(raw.sceneCount, 1, 120) ||
      !descriptor(raw.readme, README_FILE, MAX_TEXT_BYTES) ||
      !Array.isArray(raw.parts) || !raw.parts.length || raw.parts.length > MAX_PARTS)
    return invalid();
  let scene = 1, start = 0;
  const hashes = new Set<string>();
  for (const [index, part] of raw.parts.entries()) {
    if (!record(part) || part.order !== index + 1 || part.firstScene !== scene ||
        !integer(part.lastScene, scene, raw.sceneCount) || !finite(part.start, 0, raw.seconds) ||
        !close(part.start, start) || !finite(part.end, start + 1.99, Math.min(start + 120.001, raw.seconds + 0.001)) ||
        (part.burnedCaptions !== undefined && typeof part.burnedCaptions !== "boolean") ||
        (part.identity !== "recorded-export" && part.identity !== "creator-assigned"))
      return invalid();
    const tag = `part-${String(index + 1).padStart(2, "0")}-scenes-${scene}-${part.lastScene}`;
    const media = part.media;
    if (!descriptor(part.video, `${tag}.webm`, MAX_VIDEO_PART_BYTES) ||
        (part.subtitle !== undefined && !descriptor(part.subtitle, `${tag}.srt`, MAX_SUBTITLE_BYTES)) ||
        !record(media) || (media.codec !== "VP8" && media.codec !== "VP9") ||
        !integer(media.width, 1, 4096) || !integer(media.height, 1, 4096) ||
        !finite(media.duration, 0.01, 121) || Math.abs(media.duration - (part.end - start)) > MAX_PART_DURATION_DRIFT ||
        (media.audio !== undefined && media.audio !== "Opus" && media.audio !== "Vorbis") ||
        (media.fps !== undefined && (!finite(media.fps, 0.001, 240) ||
          (media.fpsSource !== "track" && media.fpsSource !== "export-setting"))) ||
        (media.fps === undefined && media.fpsSource !== undefined)) return invalid();
    if (hashes.has(part.video.sha256)) return invalid();
    hashes.add(part.video.sha256);
    start = part.end;
    scene = part.lastScene + 1;
  }
  if (scene !== raw.sceneCount + 1 || !close(start, raw.seconds)) return invalid();
  const manifest = raw as unknown as DeliveryManifest;
  if (incompatibleMedia(manifest.parts.map(part => part.media))) return invalid();
  return manifest;
}

export async function checkEpisodePackage(blob: Blob, maxBytes: number, signal: AbortSignal,
  onBytes?: (count: number) => void) {
  const entries = await readStoredZip(blob, maxBytes, signal);
  const order = entries.get(ORDER_FILE);
  if (!order || order.blob.size > MAX_TEXT_BYTES) throw new Error("The ZIP is missing a readable part-order manifest.");
  if ((await deliveryDigest(order.blob, signal)).crc32 !== order.crc32)
    throw new Error("The part-order manifest is damaged.");
  let raw: unknown;
  try { raw = JSON.parse(await order.blob.text()); }
  catch { throw new Error("The part-order manifest is not readable JSON."); }
  const manifest = parseManifest(raw);
  const expected = [manifest.readme, ...manifest.parts.flatMap(part => [part.video, ...(part.subtitle ? [part.subtitle] : [])])];
  if (entries.size !== expected.length + 1) throw new Error("The ZIP contains missing or unexpected files.");
  for (const listed of expected) {
    const stored = entries.get(listed.name);
    if (!stored || stored.blob.size !== listed.size)
      throw new Error(`Missing or incorrect file size: ${listed.name}.`);
    const digest = await deliveryDigest(stored.blob, signal, onBytes);
    if (digest.sha256 !== listed.sha256 || digest.crc32 !== stored.crc32)
      throw new Error(`Checksum failed for ${listed.name}. Replace the damaged package.`);
  }
  for (const part of manifest.parts) {
    checkDeliveryAbort(signal);
    const video = entries.get(part.video.name)!.blob;
    const tracks = readWebmTracks(new Uint8Array(await video.slice(0, WEBM_METADATA_LIMIT).arrayBuffer()), video.size);
    if (tracks.codec !== part.media.codec || tracks.width !== part.media.width ||
        tracks.height !== part.media.height || tracks.audio !== part.media.audio ||
        (part.media.fpsSource === "track" && tracks.fps !== part.media.fps))
      throw new Error(`WebM tracks do not match the manifest for ${part.video.name}.`);
  }
  checkDeliveryAbort(signal);
  const parts: DeliveryPlayerPart[] = manifest.parts.map(part => ({
    label: `Part ${part.order} · Scenes ${part.firstScene}–${part.lastScene}`,
    start: part.start, end: part.end, video: entries.get(part.video.name)!.blob,
    subtitle: part.subtitle ? entries.get(part.subtitle.name)!.blob : undefined, baked: part.burnedCaptions,
  }));
  return { manifest, parts };
}

export function makeEpisodeZip(delivery: Awaited<ReturnType<typeof prepareDelivery>>, maxBytes: number) {
  return storedZip(delivery.entries, maxBytes);
}

export function srtToVtt(text: string) {
  const cue = /^(\d\d:\d\d:\d\d),(\d\d\d) --> (\d\d:\d\d:\d\d),(\d\d\d)$/;
  return `WEBVTT\n\n${text.split(/\r?\n/).map(line => cue.test(line)
    ? line.replace(cue, "$1.$2 --> $3.$4")
    : line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")).join("\n")}`;
}
