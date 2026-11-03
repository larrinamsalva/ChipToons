import { validateProject } from "./model";
import type { Project } from "./model";

const DB_NAME = "chiptoons-studio";
const STORE = "projects";
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
    const req = indexedDB.open(DB_NAME, 3);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("media"))
        req.result.createObjectStore("media", { keyPath: "key" });
      if (!req.result.objectStoreNames.contains(STORE))
        req.result.createObjectStore(STORE, { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("library"))
        req.result.createObjectStore("library", { keyPath: "id" });
      if (!req.result.objectStoreNames.contains("settings"))
        req.result.createObjectStore("settings");
    };
    req.onsuccess = () => {
      const result = req.result;
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
  if (error instanceof Error && error.name === "QuotaExceededError")
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
export async function saveProject(project: Project): Promise<void> {
  validateProject(project);
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE, "media"], "readwrite");
    try {
      for (const a of project.audioAssets)
        if (a.file) {
          const request = tx.objectStore("media").get(a.file.key);
          request.onsuccess = () => {
            const r = request.result;
            if (
              !r ||
              r.sha256 !== a.file!.sha256 ||
              r.size !== a.file!.size ||
              r.blob?.size !== a.file!.size
            )
              tx.abort();
          };
        }
      tx.objectStore(STORE).put(project);
    } catch (error) {
      tx.abort();
      reject(error);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save project."));
    tx.onabort = () => reject(tx.error ?? new Error("Saving was interrupted."));
  });
}
export async function deleteProject(id: string): Promise<void> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
