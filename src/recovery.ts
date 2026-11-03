import { readAudio } from "./audio-files";
import { audioBlob, checkStorage, fileAsset, fileRecord, sha256, sourceBytes, writeEpisode } from "./audio-vault";
import { browserLocks, holdLock, MEDIA_ACTIVITY_LOCK, projectLock } from "./edit-locks";
import { AUDIO_MIMES, audioSignature, MAX_AUDIO_BYTES } from "./media-model";
import type { AudioAsset, AudioMime } from "./media-model";
import { validateProject } from "./model";
import type { Project } from "./model";
import { db, projectStores, readProjectSnapshot, savedAtKey } from "./storage";

type Source = Pick<AudioAsset, "name" | "file" | "mime" | "dataUrl">;
type Identity = NonNullable<AudioAsset["file"]> & { mime: AudioMime };

interface Reference {
  projectId: string;
  projectTitle: string;
  asset: AudioAsset;
}

export interface Recording {
  id: string;
  source: Source;
  bytes: number;
  references: Reference[];
  storedAt?: string;
  candidate: boolean;
}

interface ProjectStatus {
  project: Project;
  bytes: number;
  lastSave?: string;
}

export interface RecoveryInventory {
  projects: ProjectStatus[];
  recordings: Recording[];
  missing: Reference[];
  invalid: number;
  fingerprint: string;
}

const identity = (file: NonNullable<AudioAsset["file"]>, mime: AudioMime): Identity => ({ ...file, mime });

function matches(a: Identity | undefined, b: Identity) {
  return !!a && a.key === b.key && a.sha256 === b.sha256 && a.size === b.size && a.mime === b.mime;
}

// Read index keys and project graphs only. The encoded originals stay in
// storage until the creator explicitly checks or opens one.
function readInventory(tx: IDBTransaction, ready: (inventory: RecoveryInventory) => void, fail: (e: unknown) => void) {
  const projects = tx.objectStore("projects").getAll();
  const media = tx.objectStore("media");
  const keys = media.getAllKeys();
  const info = tx.objectStore("media-info").getAll();
  const settings = tx.objectStore("settings").openCursor(IDBKeyRange.bound("project-saved-at:", "project-saved-at;"));
  const cursor = media.index("identity").openKeyCursor();
  const dates = new Map<string, string>();
  const identities = new Map<string, Identity>();
  let datesDone = false;
  let mediaDone = false;
  function finish() {
    if (!datesDone || !mediaDone) return;
    try {
      const metadata = new Map((info.result as { key: string; name?: string; storedAt?: string; committed?: boolean }[])
        .map(entry => [entry.key, entry]));
      const references = new Map<string, Reference[]>();
      const recordings: Recording[] = [];
      const saved = (projects.result as unknown[]).map(validateProject);
      const status = saved.map(project => {
        const originalSizes = new Map<string, number>();
        for (const asset of project.audioAssets) {
          const reference = { projectId: project.id, projectTitle: project.title, asset };
          if (asset.file) {
            const refs = references.get(asset.file.key) ?? [];
            refs.push(reference);
            references.set(asset.file.key, refs);
            originalSizes.set(asset.file.key, asset.file.size);
          } else {
            recordings.push({ id: `inline:${project.id}:${asset.id}`, source: asset, bytes: sourceBytes(asset), references: [reference], candidate: false });
          }
        }
        const bytes = new Blob([JSON.stringify(project)]).size + [...originalSizes.values()].reduce((sum, size) => sum + size, 0);
        return { project, bytes, lastSave: dates.get(savedAtKey(project.id)) };
      });
      const missing: Reference[] = [];
      for (const [key, refs] of references)
        for (const ref of refs)
          if (!matches(identities.get(key), identity(ref.asset.file!, ref.asset.mime))) missing.push(ref);
      for (const [key, original] of identities) {
        const refs = references.get(key) ?? [];
        const meta = metadata.get(key);
        const name = meta?.name ?? refs[0]?.asset.name ?? "Unnamed original";
        recordings.push({
          id: key, source: { name, mime: original.mime, file: original, dataUrl: "" }, bytes: original.size,
          references: refs, storedAt: meta?.storedAt,
          candidate: refs.length === 0 && meta?.committed === true,
        });
      }
      const fingerprint = JSON.stringify([...references].flatMap(([key, refs]) => refs.map(({ projectId, asset }) =>
        JSON.stringify([projectId, asset.id, key, asset.file!.sha256, asset.file!.size, asset.mime]))).sort());
      ready({ projects: status, recordings, missing, invalid: keys.result.length - identities.size, fingerprint });
    } catch (e) {
      fail(e);
      tx.abort();
    }
  }
  settings.onsuccess = () => {
    const entry = settings.result;
    if (entry) {
      if (typeof entry.key === "string" && typeof entry.value === "string") dates.set(entry.key, entry.value);
      entry.continue();
    } else {
      datesDone = true;
      finish();
    }
  };
  cursor.onsuccess = () => {
    const entry = cursor.result;
    if (entry) {
      const [key, sha256, size, mime] = entry.key as [string, string, number, AudioMime];
      if (typeof key === "string" && key === entry.primaryKey && typeof sha256 === "string" &&
          /^[0-9a-f]{64}$/.test(sha256) && Number.isInteger(size) && size > 0 &&
          size <= MAX_AUDIO_BYTES && AUDIO_MIMES.includes(mime)) {
        identities.set(key, { key, sha256, size, mime });
      }
      entry.continue();
    } else {
      mediaDone = true;
      finish();
    }
  };
}

export async function recoveryInventory(): Promise<RecoveryInventory> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(projectStores, "readonly");
    let inventory: RecoveryInventory;
    let failure: unknown;
    readInventory(tx, result => { inventory = result; }, error => { failure = error; });
    tx.oncomplete = () => resolve(inventory);
    tx.onabort = () => reject(failure ?? tx.error);
  });
}

export async function verifiedRecording(recording: Recording): Promise<Blob> {
  const blob = await audioBlob(recording.source);
  const bytes = await blob.arrayBuffer();
  if (!audioSignature(new Uint8Array(bytes), recording.source.mime) ||
      (recording.source.file && await sha256(bytes) !== recording.source.file.sha256))
    throw new Error("This original failed its integrity check. Use an identical original or restore a complete backup.");
  return blob;
}

export async function cleanOriginals(review: RecoveryInventory, selected: Recording[]) {
  if (!browserLocks()) throw new Error("This browser cannot check for open editors. Use a current browser for cleanup.");
  if (!selected.length) throw new Error("Choose which originals to remove.");
  const release = await holdLock(MEDIA_ACTIVITY_LOCK, { ifAvailable: true });
  if (!release) throw new Error("Close open cartoon editors in all tabs before trying cleanup again.");
  try {
    for (const item of selected) await verifiedRecording(item);
    const database = await db();
    return await new Promise<{ count: number; bytes: number }>((resolve, reject) => {
      const tx = database.transaction(projectStores, "readwrite");
      let failure: unknown;
      let bytes = 0;
      let count = 0;
      readInventory(tx, current => {
        const candidates = new Map(current.recordings.filter(item => item.candidate).map(item => [item.id, item]));
        const keys = new Set<string>();
        if (review.fingerprint !== current.fingerprint) throw new Error("Saved project references changed. Review storage again before removing originals.");
        for (const item of selected) {
          const candidate = candidates.get(item.id);
          const reviewed = review.recordings.find(original => original.id === item.id);
          if (!candidate || !reviewed?.candidate || !item.source.file ||
              !matches(candidate.source.file && identity(candidate.source.file, candidate.source.mime), identity(item.source.file, item.source.mime)) ||
              !matches(reviewed.source.file && identity(reviewed.source.file, reviewed.source.mime), identity(item.source.file, item.source.mime)))
            throw new Error("An original changed or is protected. Review storage again before removing originals.");
          if (keys.has(item.id)) continue;
          keys.add(item.id);
          count++;
          bytes += candidate.bytes;
          tx.objectStore("media").delete(item.id);
          tx.objectStore("media-info").delete(item.id);
        }
      }, error => { failure = error; });
      tx.oncomplete = () => resolve({ count, bytes });
      tx.onabort = () => reject(failure ?? tx.error ?? new Error("Cleanup was interrupted. No files were removed."));
    });
  } finally {
    release();
  }
}

export async function recoverOriginal(projectId: string, input: Recording | File, target?: AudioAsset) {
  const activity = await holdLock(MEDIA_ACTIVITY_LOCK, { mode: "shared", ifAvailable: true });
  if (!activity) throw new Error("Cleanup is running in another tab. Wait for it to finish before recovering audio.");
  let editing: (() => void) | null = null;
  try {
    editing = await holdLock(projectLock(projectId), { ifAvailable: true });
    if (!editing) throw new Error("Close this cartoon in the other tab before recovering its audio.");
    const { project, revision } = await readProjectSnapshot(projectId);
    if (!project) throw new Error("This cartoon is no longer saved here.");
    const retained = "source" in input ? input : undefined;
    const blob = retained ? await verifiedRecording(retained) : input as File;
    const mime = target?.mime ?? retained?.source.mime;
    if (!mime) throw new Error("Choose an original recording from the list.");
    const name = retained?.source.name ?? (input as File).name;
    const original = retained?.source.file
      ? { ...retained.source.file, mime: retained.source.mime, blob, name }
      : { ...await fileRecord(blob, mime), name, storedAt: new Date().toISOString() };
    if (target) {
      const current = project.audioAssets.find(asset => asset.id === target.id);
      if (!current?.file || !target.file || !matches(identity(current.file, current.mime), identity(target.file, target.mime)))
        throw new Error("The missing source changed. Check your projects again.");
      if (original.sha256 !== current.file.sha256 || original.size !== current.file.size || original.mime !== current.mime)
        throw new Error("This recording is different from the original. Choose the exact original file.");
      project.audioAssets = project.audioAssets.map(asset => asset.id === current.id ? fileAsset(asset, original) : asset);
    } else {
      const asset = await readAudio(new File([blob], name, { type: mime }));
      project.audioAssets = [...project.audioAssets, fileAsset({ ...asset, name }, original)];
      project.mediaVersion = 1;
    }
    if (!retained?.source.file) await checkStorage(blob.size);
    await writeEpisode(
      { ...project, updatedAt: new Date().toISOString() },
      retained?.source.file ? [] : [original],
      { revision },
      undefined,
      true,
    );
  } finally {
    editing?.();
    activity();
  }
}
