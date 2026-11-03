import { sha256 as portableSha256 } from "@noble/hashes/sha2.js";
import type { AudioAsset, AudioMime } from "./media-model";
import { audioSignature, MAX_AUDIO_BYTES } from "./media-model";
import { db } from "./storage";
import { uid, validateProject } from "./model";
import type { Project } from "./model";
export interface AudioFile {
  key: string;
  blob: Blob;
  sha256: string;
  size: number;
  mime: AudioMime;
}
export const MAX_EPISODE_AUDIO_BYTES = 256 * 1024 * 1024;
export const MAX_EPISODE_AUDIO_SECONDS = 1800;
export const MAX_EPISODE_AUDIO_SOURCES = 256;
export const MAX_EPISODE_AUDIO_CLIPS = 480;
export function sourceBytes(a: AudioAsset) {
  if (a.file) return a.file.size;
  const s = a.dataUrl.split(",")[1] ?? "";
  return (s.length * 3) / 4 - (s.endsWith("==") ? 2 : s.endsWith("=") ? 1 : 0);
}
export async function sha256(bytes: ArrayBuffer) {
  return [
    ...(globalThis.crypto?.subtle
      ? new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
      : portableSha256(new Uint8Array(bytes))),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export async function checkStorage(bytes: number) {
  const estimate = await globalThis.navigator?.storage
    ?.estimate?.()
    .catch(() => undefined);
  if (
    estimate?.quota &&
    estimate.quota - (estimate.usage ?? 0) < bytes + 8 * 1024 * 1024
  )
    throw new DOMException(
      "There is not enough available browser storage. Download an episode backup and free space before adding this recording.",
      "QuotaExceededError",
    );
  return estimate;
}
export async function fileRecord(
  blob: Blob,
  mime: AudioMime,
): Promise<AudioFile> {
  if (!blob.size || blob.size > MAX_AUDIO_BYTES)
    throw new Error("Keep each audio section under 12 MB.");
  const bytes = await blob.arrayBuffer();
  if (!audioSignature(new Uint8Array(bytes), mime))
    throw new Error("The audio file signature is invalid.");
  return {
    key: uid(),
    blob,
    sha256: await sha256(bytes),
    size: blob.size,
    mime,
  };
}
export function fileAsset(source: AudioAsset, record: AudioFile): AudioAsset {
  return {
    ...source,
    dataUrl: "",
    file: { key: record.key, sha256: record.sha256, size: record.size },
  };
}
export async function storeAudio(
  source: AudioAsset,
  blob?: Blob,
): Promise<AudioAsset> {
  if (source.file) return source;
  const data =
    blob ??
    new Blob(
      [
        Uint8Array.from(atob(source.dataUrl.split(",")[1]), (c) =>
          c.charCodeAt(0),
        ),
      ],
      { type: source.mime },
    );
  await checkStorage(data.size);
  const record = await fileRecord(data, source.mime),
    database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("media", "readwrite");
    tx.objectStore("media").add(record);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
  return fileAsset(source, record);
}
export async function audioBlob(source: AudioAsset): Promise<Blob> {
  if (!source.file)
    return new Blob(
      [
        Uint8Array.from(atob(source.dataUrl.split(",")[1]), (c) =>
          c.charCodeAt(0),
        ),
      ],
      { type: source.mime },
    );
  const database = await db();
  const record = await new Promise<AudioFile | undefined>((resolve, reject) => {
    const tx = database.transaction("media", "readonly"),
      req = tx.objectStore("media").get(source.file!.key);
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
  if (
    !record ||
    record.sha256 !== source.file.sha256 ||
    record.size !== source.file.size ||
    record.blob?.size !== source.file.size ||
    record.mime !== source.mime
  )
    throw new Error(
      `${source.name}: the local original is missing or damaged. Restore its complete episode backup.`,
    );
  return record.blob;
}
export async function audioBytes(source: AudioAsset) {
  const blob = await audioBlob(source),
    buffer = await blob.arrayBuffer();
  if (source.file && (await sha256(buffer)) !== source.file.sha256)
    throw new Error(
      `${source.name}: the original audio failed its integrity check. Restore a complete episode backup.`,
    );
  return new Uint8Array(buffer);
}
export async function missingAudio(project: Project) {
  const database = await db();
  return new Promise<string[]>((resolve, reject) => {
    const missing: string[] = [],
      tx = database.transaction("media", "readonly");
    for (const a of project.audioAssets)
      if (a.file) {
        const request = tx.objectStore("media").getKey(a.file.key);
        request.onsuccess = () => {
          if (!request.result) missing.push(a.id);
        };
      }
    tx.oncomplete = () => resolve(missing);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
export async function commitEpisode(
  project: Project,
  files: AudioFile[],
  signal?: AbortSignal,
) {
  validateProject(project);
  if (signal?.aborted)
    throw new DOMException(
      "Restore cancelled; existing projects are unchanged.",
      "AbortError",
    );
  const database = await db();
  if (signal?.aborted)
    throw new DOMException(
      "Restore cancelled; existing projects are unchanged.",
      "AbortError",
    );
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["projects", "media"], "readwrite");
    const abort = () => tx.abort();
    signal?.addEventListener("abort", abort, { once: true });
    tx.oncomplete = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => {
      signal?.removeEventListener("abort", abort);
      reject(
        tx.error ??
          new DOMException(
            "Restore cancelled; existing projects are unchanged.",
            "AbortError",
          ),
      );
    };
    try {
      for (const f of files) tx.objectStore("media").add(f);
      for (const a of project.audioAssets)
        if (a.file) {
          const request = tx.objectStore("media").get(a.file.key);
          request.onsuccess = () => {
            const r = request.result;
            if (
              !r ||
              r.sha256 !== a.file!.sha256 ||
              r.size !== a.file!.size ||
              r.blob?.size !== a.file!.size ||
              r.mime !== a.mime
            )
              tx.abort();
          };
        }
      tx.objectStore("projects").add(project);
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
export async function enableEpisodeAudio(project: Project) {
  const bytes = project.audioAssets.reduce((n, a) => n + sourceBytes(a), 0);
  await checkStorage(bytes);
  const records: AudioFile[] = [],
    assets: AudioAsset[] = [];
  for (const asset of project.audioAssets) {
    if (asset.file) {
      assets.push(asset);
      continue;
    }
    const record = await fileRecord(await audioBlob(asset), asset.mime);
    records.push(record);
    assets.push(fileAsset(asset, record));
  }
  const next: Project = { ...project, mediaVersion: 1, audioAssets: assets };
  validateProject(next);
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["projects", "media"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    try {
      for (const r of records) tx.objectStore("media").add(r);
      tx.objectStore("projects").put(next);
    } catch (e) {
      tx.abort();
      reject(e);
    }
  });
  return next;
}
