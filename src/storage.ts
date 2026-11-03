import { uid, validateProject } from "./model";
import type { Project } from "./model";

const DB_NAME = "chiptoons-studio";
const STORE = "projects";
export const DATABASE_VERSION = 5;
export const projectStores = [STORE, "media", "settings", "media-info"];
let connection: Promise<IDBDatabase> | undefined;
export function db(): Promise<IDBDatabase> {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB)
      return reject(
        new Error(
          "This browser cannot save locally. Download a project backup to keep your work.",
        ),
      );
    const req = indexedDB.open(DB_NAME, DATABASE_VERSION);
    let blocked = false;
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("media"))
        req.result.createObjectStore("media", { keyPath: "key" });
      if (!req.result.objectStoreNames.contains("media-info"))
        req.result.createObjectStore("media-info", { keyPath: "key" });
      const media = req.transaction!.objectStore("media");
      if (!media.indexNames.contains("identity"))
        media.createIndex("identity", ["key", "sha256", "size", "mime"], {
          unique: true,
        });
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("library"))
        req.result.createObjectStore("library", { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("settings"))
        req.result.createObjectStore("settings");
    };
    req.onsuccess = () => {
      const result = req.result;
      if (blocked) {
        result.close();
        return;
      }
      result.onversionchange = () => {
        result.close();
        connection = undefined;
      };
      resolve(result);
    };
    req.onerror = () => {
      connection = undefined;
      reject(req.error);
    };
    req.onblocked = () => {
      blocked = true;
      connection = undefined;
      reject(
        new Error(
          "Close another ChipToons tab to finish opening local storage.",
        ),
      );
    };
  });
  return connection;
}
export function friendlyStorageError(error: unknown): string {
  if ((error instanceof Error || error instanceof DOMException) && error.name === "QuotaExceededError")
    return "Your browser storage is full. Download a project backup before freeing up space.";
  return "Your changes are still on this screen, but local saving failed. Download a project backup to keep them safe.";
}
export async function listProjects(): Promise<Project[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onerror = () => reject(request.error);
    tx.onabort = () => reject(tx.error);
    tx.oncomplete = () => {
      try {
        resolve(
          (request.result as unknown[])
            .map(validateProject)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      } catch {
        reject(
          new Error(
            "A saved project could not be read. Your stored files have not been changed. You can restore a project backup.",
          ),
        );
      }
    };
  });
}
export class ProjectConflict extends Error {
  constructor() {
    super("Another tab changed this cartoon. Your work is still open. Save it as a separate copy or download a backup.");
    this.name = "ProjectConflict";
  }
}

export interface SaveGuard {
  revision: string | null;
  create?: boolean;
}

export interface ProjectSnapshot {
  project: Project | undefined;
  revision: string | null;
}

export const savedAtKey = (id: string) => `project-saved-at:${id}`;
const revisionKey = (id: string) => `project-revision:${id}`;

export async function readProjectSnapshot(id: string, fence = false): Promise<ProjectSnapshot> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE, "settings"], fence ? "readwrite" : "readonly");
    const saved = tx.objectStore(STORE).get(id);
    const settings = tx.objectStore("settings");
    const key = revisionKey(id);
    const read = settings.get(key);
    let revision: string | null = null;
    let project: Project | undefined;
    let failure: unknown;
    read.onsuccess = () => {
      try {
        project = saved.result === undefined ? undefined : validateProject(saved.result);
        revision = typeof read.result === "string" ? read.result : null;
        if (fence && project) {
          revision = uid();
          settings.put(revision, key);
        }
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve({ project, revision });
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("The saved cartoon could not be opened."));
  });
}

// Requests on the project and revision share the write transaction. The guard
// is checked before scheduling any writes, including a long-audio conversion.
export function guardedProjectWrite(
  tx: IDBTransaction,
  id: string,
  guard: SaveGuard | undefined,
  next: (previous: Project | undefined, revision: string) => void,
  fail: (error: unknown) => void,
) {
  const previous = tx.objectStore(STORE).get(id);
  const settings = tx.objectStore("settings");
  const key = revisionKey(id);
  const read = settings.get(key);
  read.onsuccess = () => {
    try {
      const existing = previous.result as Project | undefined;
      if (guard && (
        (read.result ?? null) !== guard.revision ||
        (guard.create ? !!existing : !existing)
      )) throw new ProjectConflict();
      const revision = uid();
      settings.put(revision, key);
      settings.put(new Date().toISOString(), savedAtKey(id));
      next(existing, revision);
    } catch (error) {
      fail(error);
      tx.abort();
    }
  };
}

// A formerly saved reference proves that the file was committed, even after
// it is removed from the current project. New staged takes remain protected.
export function markCommittedOriginals(tx: IDBTransaction, ...projects: (Project | undefined)[]) {
  const info = tx.objectStore("media-info");
  const seen = new Set<string>();
  for (const asset of projects.flatMap(project => project?.audioAssets ?? [])) {
    const file = asset.file;
    if (!file || seen.has(file.key)) continue;
    seen.add(file.key);
    const found = info.get(file.key);
    found.onsuccess = () => {
      const previous = found.result;
      if (previous?.committed === true) return;
      info.put({
        ...previous,
        key: file.key,
        name: previous?.name ?? asset.name,
        committed: true,
      });
    };
  }
}

export async function saveProject(project: Project, guard?: SaveGuard): Promise<string> {
  validateProject(project);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(projectStores, "readwrite");
    let revision: string;
    let failure: unknown;
    guardedProjectWrite(tx, project.id, guard, (previous, nextRevision) => {
      revision = nextRevision;
      checkAudioReferences(tx, project);
      markCommittedOriginals(tx, previous, project);
      tx.objectStore(STORE).put(project);
    }, error => { failure = error; });
    tx.oncomplete = () => resolve(revision);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Saving was interrupted. Check your original recordings."));
  });
}
// Index keys verify immutable identities without reading any encoded payload.
export function checkAudioReferences(tx: IDBTransaction, project: Project, unchanged?: Project) {
  const previous = new Map(unchanged?.audioAssets.map(asset => [asset.id, asset]));
  for (const a of project.audioAssets)
    if (a.file) {
      const old = previous.get(a.id);
      if (old?.file?.key === a.file.key && old.file.sha256 === a.file.sha256 &&
          old.file.size === a.file.size && old.mime === a.mime) continue;
      const request = tx
        .objectStore("media")
        .index("identity")
        .getKey([a.file.key, a.file.sha256, a.file.size, a.mime]);
      request.onsuccess = () => {
        if (request.result !== a.file!.key) tx.abort();
      };
    }
}
export async function deleteProject(id: string, guard?: SaveGuard): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(projectStores, "readwrite");
    let failure: unknown;
    guardedProjectWrite(tx, id, guard, previous => {
      markCommittedOriginals(tx, previous);
      tx.objectStore(STORE).delete(id);
      tx.objectStore("settings").delete(revisionKey(id));
      tx.objectStore("settings").delete(savedAtKey(id));
    }, error => { failure = error; });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Deletion was interrupted."));
  });
}
