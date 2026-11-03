import { MAX_PROJECT_BYTES, parseBackup, uid, validateProject } from "./model";
import type { Project } from "./model";
import type { AudioFile } from "./audio-vault";
import {
  audioBlob,
  checkStorage,
  commitEpisode,
  sha256,
  MAX_EPISODE_AUDIO_BYTES,
} from "./audio-vault";
import { AUDIO_MIMES, MAX_AUDIO_BYTES, audioSignature } from "./media-model";
import type { AudioMime } from "./media-model";
import { record } from "./art-model";
const MAGIC = "CTEPKG01";
const MAX_PACKAGE = MAX_PROJECT_BYTES + MAX_EPISODE_AUDIO_BYTES + 1024 * 1024;
export interface PackageProgress {
  phase: string;
  fraction: number;
}
export interface PackageOptions {
  signal?: AbortSignal;
  onProgress?: (p: PackageProgress) => void;
}
function check(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new DOMException(
      "Restoration cancelled. Existing projects are unchanged.",
      "AbortError",
    );
}
export async function episodePackage(
  project: Project,
  options: PackageOptions = {},
): Promise<Blob> {
  validateProject(project);
  const seen = new Set<string>(),
    parts: Blob[] = [],
    entries: { key: string; sha256: string; size: number; mime: AudioMime }[] =
      [];
  for (const [i, a] of project.audioAssets.entries())
    if (a.file && !seen.has(a.file.key)) {
      check(options.signal);
      options.onProgress?.({
        phase: `Checking original ${i + 1} of ${project.audioAssets.length}`,
        fraction: i / Math.max(1, project.audioAssets.length),
      });
      const blob = await audioBlob(a),
        buffer = await blob.arrayBuffer();
      if (
        (await sha256(buffer)) !== a.file.sha256 ||
        !audioSignature(new Uint8Array(buffer), a.mime)
      )
        throw new Error(
          `${a.name}: restore its original before making a complete backup.`,
        );
      seen.add(a.file.key);
      parts.push(blob);
      entries.push({ ...a.file, mime: a.mime });
    }
  const projectText = JSON.stringify(project),
    projectHash = await sha256(new TextEncoder().encode(projectText).buffer);
  const manifest = new TextEncoder().encode(
    JSON.stringify({
      format: "chiptoons-episode",
      version: 1,
      project,
      projectHash,
      files: entries,
    }),
  );
  if (
    manifest.length > MAX_PROJECT_BYTES ||
    manifest.length + 16 + parts.reduce((n, b) => n + b.size, 0) > MAX_PACKAGE
  )
    throw new Error(
      "This complete episode exceeds the bounded 320 MB package budget. Keep chapters in separate projects.",
    );
  const header = new Uint8Array(16);
  header.set(new TextEncoder().encode(MAGIC));
  new DataView(header.buffer).setUint32(8, manifest.length, true);
  check(options.signal);
  options.onProgress?.({ phase: "Complete episode backup ready", fraction: 1 });
  return new Blob([header, manifest, ...parts], {
    type: "application/octet-stream",
  });
}
export async function restoreProjectFile(
  file: File,
  options: PackageOptions = {},
): Promise<Project> {
  check(options.signal);
  if (file.size > MAX_PACKAGE)
    throw new Error("Choose an episode package smaller than 320 MB.");
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer()),
    magic = new TextDecoder().decode(header.slice(0, 8));
  if (magic !== MAGIC) {
    if (file.name.toLowerCase().endsWith(".ctepisode"))
      throw new Error("This is not a readable ChipToons episode package.");
    if (file.size > MAX_PROJECT_BYTES)
      throw new Error("Choose a JSON project backup smaller than 64 MB.");
    const p = parseBackup(await file.text());
    if (p.audioAssets.some((a) => a.file))
      throw new Error(
        "This JSON only contains audio references. Restore the complete .ctepisode backup instead.",
      );
    const next = {
      ...p,
      id: uid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await checkStorage(file.size);
    await commitEpisode(next, [], options.signal);
    return next;
  }
  if (header.length !== 16 || header.slice(12).some((n) => n !== 0))
    throw new Error("Unsupported episode package header.");
  const length = new DataView(header.buffer).getUint32(8, true);
  if (!length || length > MAX_PROJECT_BYTES || 16 + length > file.size)
    throw new Error("The episode manifest is missing or interrupted.");
  let value: unknown;
  try {
    value = JSON.parse(await file.slice(16, 16 + length).text());
  } catch {
    throw new Error("The episode manifest is not readable JSON.");
  }
  if (
    !record(value) ||
    value.format !== "chiptoons-episode" ||
    value.version !== 1 ||
    !Array.isArray(value.files) ||
    value.files.length > 256
  )
    throw new Error("Unsupported episode package version or file list.");
  const project = validateProject(value.project);
  if (
    (await sha256(
      new TextEncoder().encode(JSON.stringify(value.project)).buffer,
    )) !== value.projectHash
  )
    throw new Error(
      "The episode storyboard failed its integrity check. Nothing was restored.",
    );
  const expected = new Map(
    project.audioAssets.filter((a) => a.file).map((a) => [a.file!.key, a]),
  );
  const seen = new Set<string>(),
    files: AudioFile[] = [],
    keys = new Map<string, string>();
  let offset = 16 + length;
  const bytes = value.files.reduce(
    (n: number, f: unknown) =>
      n + (record(f) && typeof f.size === "number" ? f.size : 0),
    0,
  );
  if (!Number.isFinite(bytes) || bytes > MAX_EPISODE_AUDIO_BYTES)
    throw new Error("The episode audio exceeds its 256 MB storage budget.");
  await checkStorage(bytes + length);
  for (const [i, f] of value.files.entries()) {
    check(options.signal);
    if (
      !record(f) ||
      typeof f.key !== "string" ||
      seen.has(f.key) ||
      !Number.isInteger(f.size) ||
      Number(f.size) < 1 ||
      Number(f.size) > MAX_AUDIO_BYTES ||
      !AUDIO_MIMES.includes(f.mime as AudioMime)
    )
      throw new Error("Invalid or duplicate episode audio entry.");
    const a = expected.get(f.key);
    if (
      !a ||
      a.file!.sha256 !== f.sha256 ||
      a.file!.size !== f.size ||
      a.mime !== f.mime
    )
      throw new Error("The audio list does not match this storyboard.");
    const size = Number(f.size);
    if (offset + size > file.size)
      throw new Error("An audio file is interrupted. No project was restored.");
    options.onProgress?.({
      phase: `Validating original ${i + 1} of ${value.files.length}`,
      fraction: i / Math.max(1, value.files.length),
    });
    const blob = file.slice(offset, offset + size, a.mime),
      buffer = await blob.arrayBuffer();
    offset += size;
    if (
      (await sha256(buffer)) !== f.sha256 ||
      !audioSignature(new Uint8Array(buffer), a.mime)
    )
      throw new Error(
        `${a.name}: its original failed the package integrity check. Nothing was restored.`,
      );
    const key = uid();
    seen.add(f.key);
    keys.set(f.key, key);
    files.push({ key, blob, size, sha256: String(f.sha256), mime: a.mime });
  }
  if (seen.size !== expected.size || offset !== file.size)
    throw new Error(
      "The episode is missing originals or contains unexpected trailing data.",
    );
  const next: Project = {
    ...project,
    id: uid(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    audioAssets: project.audioAssets.map((a) =>
      a.file ? { ...a, file: { ...a.file, key: keys.get(a.file.key)! } } : a,
    ),
  };
  check(options.signal);
  options.onProgress?.({
    phase: "Saving the complete episode atomically…",
    fraction: 0.99,
  });
  await commitEpisode(next, files, options.signal);
  options.onProgress?.({ phase: "Complete episode restored", fraction: 1 });
  return next;
}
