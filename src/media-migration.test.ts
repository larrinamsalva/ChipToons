import { IDBFactory } from "fake-indexeddb";
import { expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { starterProject } from "./demo-starter";
import { uid } from "./model";
it("upgrades existing version-three Blob originals to indexed metadata without changing their bytes or other stores", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  const p = starterProject();
  p.mediaVersion = 1;
  const records = p.audioAssets.map((a) => {
    const bytes = Buffer.from(a.dataUrl.split(",")[1], "base64");
    return {
      key: uid(),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      mime: a.mime,
      blob: new Blob([bytes]),
    };
  });
  p.audioAssets = p.audioAssets.map((a, i) => ({
    ...a,
    dataUrl: "",
    file: {
      key: records[i].key,
      sha256: records[i].sha256,
      size: records[i].size,
    },
  }));
  const old = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("chiptoons-studio", 3);
    r.onupgradeneeded = () => {
      r.result.createObjectStore("projects", { keyPath: "id" });
      r.result.createObjectStore("media", { keyPath: "key" });
      r.result.createObjectStore("library", { keyPath: "id" });
      r.result.createObjectStore("settings");
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = old.transaction(
      ["projects", "media", "library", "settings"],
      "readwrite",
    );
    tx.objectStore("projects").add(p);
    records.forEach((r) => tx.objectStore("media").add(r));
    tx.objectStore("library").add({
      id: "kept-reference",
      name: "My reference",
    });
    tx.objectStore("settings").put(["#ff0000"], "palette");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  old.close();
  const storage = await import("./storage"),
    vault = await import("./audio-vault"),
    database = await storage.db();
  expect(database.version).toBe(4);
  expect((await storage.listProjects())[0]).toEqual(p);
  for (let i = 0; i < records.length; i++)
    expect(Buffer.from(await vault.audioBytes(p.audioAssets[i]))).toEqual(
      Buffer.from(await records[i].blob.arrayBuffer()),
    );
  await storage.saveProject(p);
  const preserved = await new Promise<unknown[]>((resolve, reject) => {
    const tx = database.transaction(["library", "settings"], "readonly"),
      a = tx.objectStore("library").get("kept-reference"),
      b = tx.objectStore("settings").get("palette");
    tx.oncomplete = () => resolve([a.result, b.result]);
    tx.onabort = () => reject(tx.error);
  });
  expect(preserved).toEqual([
    { id: "kept-reference", name: "My reference" },
    ["#ff0000"],
  ]);
  database.close();
  vi.unstubAllGlobals();
});
