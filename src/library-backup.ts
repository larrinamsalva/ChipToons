import { clone, uid } from "./model";
import { listLibrary, readPalette, validateLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { db } from "./storage";
import { record } from "./art-model";
export interface LibraryBackup {
  format: "chiptoons-art-library";
  version: 1;
  items: LibraryItem[];
  palette: string[];
}
const LIMIT = 64 * 1024 * 1024;
export function validateLibraryBackup(value: unknown): LibraryBackup {
  if (
    !record(value) ||
    value.format !== "chiptoons-art-library" ||
    value.version !== 1 ||
    !Array.isArray(value.items) ||
    value.items.length > 120 ||
    !Array.isArray(value.palette) ||
    value.palette.length > 16 ||
    !value.palette.every(
      (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
    )
  )
    throw new Error(
      "Choose a valid ChipToons art-library backup (up to 120 entries and 16 palette colors).",
    );
  if (JSON.stringify(value).length > LIMIT)
    throw new Error("This art-library backup exceeds the 64 MB limit.");
  const items = value.items.map(validateLibraryItem);
  if (new Set(items.map((i) => i.id)).size !== items.length)
    throw new Error(
      "This backup repeats an artwork ID. No artwork was imported.",
    );
  return {
    format: "chiptoons-art-library",
    version: 1,
    items,
    palette: value.palette as string[],
  };
}
export async function libraryBackup(): Promise<LibraryBackup> {
  const [items, palette] = await Promise.all([listLibrary(), readPalette()]);
  return validateLibraryBackup({
    format: "chiptoons-art-library",
    version: 1,
    items,
    palette,
  });
}
export async function readLibraryBackup(file: File) {
  if (file.size > LIMIT)
    throw new Error("Choose an art-library backup smaller than 64 MB.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error("This file is not a readable JSON art-library backup.");
  }
  return validateLibraryBackup(parsed);
}
export async function restoreLibraryBackup(value: unknown): Promise<number> {
  const backup = validateLibraryBackup(value);
  // Validate the complete file before a single atomic transaction. Restore copies,
  // never overwrite an existing library entry or touch any project store.
  const items = backup.items.map((original) => {
    const item = clone(original);
    item.id = uid();
    item.updatedAt = new Date().toISOString();
    if (item.character) item.character.id = uid();
    return item;
  });
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["library", "settings"], "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ??
          new Error(
            "Library restore was interrupted. No entries were imported.",
          ),
      );
    const fail = (error: unknown) => {
      try {
        tx.abort();
      } catch {
        /* Already aborted. */
      }
      reject(error);
    };
    try {
      for (const item of items) tx.objectStore("library").add(item);
      const palette = tx.objectStore("settings").get("palette");
      palette.onsuccess = () => {
        try {
          const existing = Array.isArray(palette.result)
            ? palette.result.filter(
                (c: unknown) =>
                  typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c),
              )
            : [];
          tx.objectStore("settings").put(
            [...new Set([...existing, ...backup.palette])].slice(0, 16),
            "palette",
          );
        } catch (error) {
          fail(error);
        }
      };
    } catch (error) {
      fail(error);
    }
  });
  return items.length;
}
