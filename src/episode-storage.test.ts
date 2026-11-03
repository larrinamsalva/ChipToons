import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { starterProject } from "./demo-starter";
import { clone, makeScene, uid, validateProject } from "./model";
import { emptyProduction } from "./media-model";
import { builtInSound } from "./sounds";
import {
  audioBlob,
  audioBytes,
  commitEpisode,
  enableEpisodeAudio,
  fileAsset,
  fileRecord,
  sha256,
  storeAudio,
} from "./audio-vault";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { db, listProjects, saveProject } from "./storage";
import { AudioDecodeCache, prepareAudio } from "./audio-engine";
import * as audioFiles from "./audio-files";

beforeEach(() =>
  vi.stubGlobal("navigator", {
    storage: { estimate: async () => ({ quota: 2 ** 32, usage: 0 }) },
  }),
);
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(["projects", "media"], "readwrite");
    tx.objectStore("projects").clear();
    tx.objectStore("media").clear();
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
});
const plain = () => ({ ...starterProject(), ...emptyProduction() });
async function fileProject() {
  const p = plain(),
    source = builtInSound("notice");
  p.audioAssets = [source];
  const next = await enableEpisodeAudio(p);
  return next;
}
const file = (blob: Blob, name = "story.ctepisode") =>
  new File([blob], name, { type: "application/octet-stream" });

it("keeps twenty minutes of distinct narration metadata under bounded file budgets while retaining legacy limits", () => {
  const p = plain();
  p.mediaVersion = 1;
  p.scenes = Array.from({ length: 60 }, () => ({
    ...makeScene(p.characters),
    duration: 20,
  }));
  p.audioAssets = Array.from({ length: 60 }, (_, i) => ({
    id: uid(),
    name: `Original narration ${i + 1}`,
    mime: "audio/wav",
    dataUrl: "",
    duration: 20,
    channels: 1,
    sampleRate: 24000,
    file: {
      key: uid(),
      size: 960044,
      sha256: i.toString(16).padStart(64, "0"),
    },
  }));
  expect(
    validateProject(p).audioAssets.reduce((n, a) => n + a.duration, 0),
  ).toBe(1200);
  const legacy = clone(p);
  delete legacy.mediaVersion;
  expect(() => validateProject(legacy)).toThrow();
  const over = clone(p);
  over.audioAssets[0].file!.size = 13 * 1024 * 1024;
  expect(() => validateProject(over)).toThrow();
  over.audioAssets = Array.from({ length: 16 }, (_, i) => ({
    ...p.audioAssets[0],
    id: uid(),
    duration: 120,
    file: { ...p.audioAssets[0].file!, key: `take-${i}` },
  }));
  expect(() => validateProject(over)).toThrow();
});
it("enables file storage without rewriting the original caller or existing artwork/acting/captions", async () => {
  const p = starterProject(),
    before = clone(p);
  await saveProject(p);
  const next = await enableEpisodeAudio(p);
  expect(p).toEqual(before);
  expect(next.scenes).toEqual(p.scenes);
  expect(next.captions).toEqual(p.captions);
  expect(next.audioAssets.every((a) => a.file && !a.dataUrl)).toBe(true);
  for (let i = 0; i < p.audioAssets.length; i++)
    expect(
      Buffer.from(await audioBytes(next.audioAssets[i])).toString("base64"),
    ).toBe(p.audioAssets[i].dataUrl.split(",")[1]);
  expect((await listProjects()).find((v) => v.id === p.id)).toEqual(next);
});
it("saves and reopens metadata separately and refuses dangling original references", async () => {
  const p = await fileProject();
  await saveProject(p);
  expect((await listProjects()).find((v) => v.id === p.id)).toEqual(p);
  const missing = clone(p);
  missing.audioAssets[0].file!.key = "missing";
  await expect(saveProject(missing)).rejects.toThrow();
  expect((await listProjects()).find((v) => v.id === p.id)).toEqual(p);
});
it("preserves every byte and storyboard field in a complete portable package restored as a separate project", async () => {
  const p = await fileProject(),
    before = clone(p),
    backup = await episodePackage(p),
    restored = await restoreProjectFile(file(backup));
  expect(p).toEqual(before);
  expect(restored.id).not.toBe(p.id);
  expect(restored.scenes).toEqual(p.scenes);
  expect(restored.audioAssets[0].file!.key).not.toBe(
    p.audioAssets[0].file!.key,
  );
  expect(await audioBytes(restored.audioAssets[0])).toEqual(
    await audioBytes(p.audioAssets[0]),
  );
  expect(await listProjects()).toHaveLength(2);
});
it("rejects payload corruption, missing/trailing bytes and malformed manifests without creating a project", async () => {
  const p = await fileProject(),
    backup = await episodePackage(p),
    bytes = new Uint8Array(await backup.arrayBuffer()),
    count = (await listProjects()).length;
  for (const mutate of [
    (b: Uint8Array) => {
      b[b.length - 1] ^= 255;
      return b;
    },
    (b: Uint8Array) => b.slice(0, b.length - 1),
    (b: Uint8Array) => new Uint8Array([...b, 0]),
    (b: Uint8Array) => {
      new DataView(b.buffer).setUint32(8, 0xffffffff, true);
      return b;
    },
  ])
    await expect(
      restoreProjectFile(
        file(new Blob([mutate(bytes.slice()) as Uint8Array<ArrayBuffer>])),
      ),
    ).rejects.toThrow();
  expect(await listProjects()).toHaveLength(count);
});
it("detects tampered storyboard metadata and refuses reference-only JSON backups", async () => {
  const p = await fileProject(),
    backup = new Uint8Array(await (await episodePackage(p)).arrayBuffer()),
    length = new DataView(backup.buffer).getUint32(8, true),
    manifest = JSON.parse(
      new TextDecoder().decode(backup.slice(16, 16 + length)),
    );
  manifest.project.title = "Tampered";
  const text = new TextEncoder().encode(JSON.stringify(manifest)),
    header = backup.slice(0, 16);
  new DataView(header.buffer).setUint32(8, text.length, true);
  await expect(
    restoreProjectFile(
      file(new Blob([header, text, backup.slice(16 + length)])),
    ),
  ).rejects.toThrow(/integrity/);
  await expect(
    restoreProjectFile(file(new Blob([JSON.stringify(p)]), "references.json")),
  ).rejects.toThrow(/references/);
});
it("cancels before committing a restore and rolls back interrupted transactions", async () => {
  const p = await fileProject(),
    backup = await episodePackage(p),
    controller = new AbortController();
  controller.abort();
  await expect(
    restoreProjectFile(file(backup), { signal: controller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(await listProjects()).toHaveLength(1);
  const add = IDBObjectStore.prototype.add;
  let written = 0;
  vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
    this: IDBObjectStore,
    value: unknown,
    key?: IDBValidKey,
  ) {
    if (++written === 2) throw new DOMException("Full", "QuotaExceededError");
    return add.call(this, value, key);
  });
  await expect(restoreProjectFile(file(backup))).rejects.toThrow();
  vi.restoreAllMocks();
  expect(await listProjects()).toHaveLength(1);
});
it("warns before exceeding storage and leaves the old inline project intact", async () => {
  const p = starterProject();
  await saveProject(p);
  vi.stubGlobal("navigator", {
    storage: { estimate: async () => ({ quota: 1000, usage: 999 }) },
  });
  await expect(enableEpisodeAudio(p)).rejects.toMatchObject({
    name: "QuotaExceededError",
  });
  expect((await listProjects()).find((v) => v.id === p.id)).toEqual(p);
});
it("checks immutable file hashes before decoding or producing a complete backup", async () => {
  const p = await fileProject(),
    a = p.audioAssets[0],
    database = await db(),
    original = await audioBlob(a);
  const data = new Uint8Array(await original.arrayBuffer());
  data[data.length - 1] ^= 255;
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction("media", "readwrite");
    tx.objectStore("media").put({
      key: a.file!.key,
      sha256: a.file!.sha256,
      size: a.file!.size,
      mime: a.mime,
      blob: new Blob([data]),
    });
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  await expect(audioBytes(a)).rejects.toThrow(/integrity/);
  await expect(episodePackage(p)).rejects.toThrow(/restore/);
});
it("keeps source creation immutable and bounds decoded ranges rather than loading all episode sources", async () => {
  const source = builtInSound("notice"),
    before = clone(source),
    stored = await storeAudio(source);
  expect(source).toEqual(before);
  expect(await sha256((await audioBytes(stored)).buffer as ArrayBuffer)).toBe(
    stored.file!.sha256,
  );
  const p = plain();
  p.audioAssets = [{ ...source, duration: 120, channels: 2 }];
  p.audioClips = [
    {
      id: uid(),
      assetId: source.id,
      name: "Long stereo",
      category: "music",
      start: 0,
      trimStart: 0,
      trimEnd: 120,
      duration: 60,
      volume: 1,
      muted: false,
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
    },
  ];
  p.audioAssets.push({ ...p.audioAssets[0], id: uid() });
  p.audioClips.push({
    ...p.audioClips[0],
    id: uid(),
    assetId: p.audioAssets[1].id,
  });
  const decode = vi.spyOn(audioFiles, "decodeAsset");
  await expect(
    prepareAudio({ sampleRate: 48000 } as AudioContext, p),
  ).rejects.toThrow(/64 MB/);
  expect(decode).not.toHaveBeenCalled();
  const record = await fileRecord(await audioBlob(stored), stored.mime);
  expect(fileAsset(source, record).file?.sha256).toBe(stored.file!.sha256);
  const cache = new AudioDecodeCache();
  cache.clear();
  expect(cache.stats().bytes).toBe(0);
});
it("never installs a manifest that references an absent local file", async () => {
  const p = plain();
  p.id = uid();
  p.mediaVersion = 1;
  p.audioAssets = [
    {
      ...builtInSound("notice"),
      dataUrl: "",
      file: { key: "absent", sha256: "0".repeat(64), size: 44 },
    },
  ];
  await expect(commitEpisode(p, [])).rejects.toThrow();
  expect(await listProjects()).toHaveLength(0);
});

it("uses the same SHA-256 integrity format without native Web Crypto", async () => {
  const { createHash } = await import("node:crypto");
  const bytes = new TextEncoder().encode("A kind original story.");
  const expected = createHash("sha256").update(bytes).digest("hex");
  expect(await sha256(bytes.buffer)).toBe(expected);
  vi.stubGlobal("crypto", {});
  expect(await sha256(bytes.buffer)).toBe(expected);
});

it("enforces the actual decoded budget even when declared durations underestimate memory", async () => {
  const p = plain(),
    source = builtInSound("notice");
  p.audioAssets = [source];
  p.audioClips = [
    {
      id: uid(),
      assetId: source.id,
      name: "Notice",
      category: "effects",
      sceneId: p.scenes[0].id,
      start: 0,
      trimStart: 0,
      trimEnd: source.duration,
      duration: source.duration,
      volume: 1,
      muted: false,
      loop: false,
      fadeIn: 0,
      fadeOut: 0,
    },
  ];
  vi.spyOn(audioFiles, "decodeAsset").mockResolvedValue({
    length: 17 * 1024 * 1024,
    numberOfChannels: 1,
  } as AudioBuffer);
  await expect(
    prepareAudio({ sampleRate: 48000 } as AudioContext, p),
  ).rejects.toThrow(/decoded sources.*64 MB/);
});

it("rejects changed file types at save without replacing the last committed project", async () => {
  const p = await enableEpisodeAudio(starterProject());
  const wrong = clone(p);
  wrong.audioAssets[0].mime = "audio/mpeg";
  await expect(saveProject(wrong)).rejects.toThrow();
  expect((await listProjects())[0].audioAssets[0].mime).toBe(
    p.audioAssets[0].mime,
  );
});

it("honors restore cancellation while waiting for the database to open", async () => {
  const storage = await import("./storage"),
    database = await db(),
    controller = new AbortController();
  let finish!: (database: IDBDatabase) => void;
  vi.spyOn(storage, "db").mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = commitEpisode(plain(), [], controller.signal);
  controller.abort();
  finish(database);
  await expect(pending).rejects.toThrow(/cancelled/);
  expect(await listProjects()).toHaveLength(0);
});

it("reuses known immutable original bytes without storing duplicate files or needing extra free space", async () => {
  const original = builtInSound("notice"),
    stored = await storeAudio(original);
  vi.stubGlobal("navigator", {
    storage: { estimate: async () => ({ quota: 1, usage: 1 }) },
  });
  const copy = await storeAudio(
    { ...original, id: uid(), name: "Another scene's name" },
    undefined,
    [stored],
  );
  expect(copy.id).not.toBe(stored.id);
  expect(copy.file).toEqual(stored.file);
  expect(copy.name).toBe("Another scene's name");
  const database = await db();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = database.transaction("media", "readonly"),
      r = tx.objectStore("media").count();
    tx.oncomplete = () => resolve(r.result);
    tx.onabort = () => reject(tx.error);
  });
  expect(count).toBe(1);
  expect(original.dataUrl).not.toBe("");
});

it("streams binary writes one source at a time in one transaction and cancels pending reads without a partial project", async () => {
  const source = builtInSound("notice"),
    data = await audioBlob(source);
  let active = 0,
    maximum = 0;
  function slowBlob() {
    const blob = new Blob([data]);
    Object.defineProperty(blob, "arrayBuffer", {
      value: async () => {
        active++;
        maximum = Math.max(maximum, active);
        try {
          await new Promise((resolve) => setTimeout(resolve, 8));
          return await data.arrayBuffer();
        } finally {
          active--;
        }
      },
    });
    return blob;
  }
  const files = await Promise.all([
    fileRecord(slowBlob(), source.mime),
    fileRecord(slowBlob(), source.mime),
  ]);
  maximum = 0;
  const p = plain();
  p.mediaVersion = 1;
  p.audioAssets = files.map((f) => fileAsset({ ...source, id: uid() }, f));
  await commitEpisode(p, files);
  expect(maximum).toBe(1);
  expect(active).toBe(0);
  const get = vi.spyOn(IDBObjectStore.prototype, "get");
  await saveProject(p);
  expect(get.mock.contexts.some((store) => (store as IDBObjectStore).name === "media")).toBe(false);
  get.mockRestore();
  const other = plain(),
    file = await fileRecord(slowBlob(), source.mime),
    controller = new AbortController();
  other.mediaVersion = 1;
  other.audioAssets = [fileAsset({ ...source, id: uid() }, file)];
  const pending = commitEpisode(other, [file], controller.signal);
  setTimeout(() => controller.abort(), 2);
  await expect(pending).rejects.toThrow(/cancelled/);
  expect(await listProjects()).toHaveLength(1);
  const database = await db();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = database.transaction("media", "readonly"),
      r = tx.objectStore("media").count();
    tx.oncomplete = () => resolve(r.result);
    tx.onabort = () => reject(tx.error);
  });
  expect(count).toBe(2);
});

it("rolls back binary originals if the final conversion metadata save is interrupted", async () => {
  const p = starterProject();
  await saveProject(p);
  const put = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === "projects") throw new DOMException("Full", "QuotaExceededError");
    return put.call(this, value, key);
  });
  await expect(enableEpisodeAudio(p)).rejects.toThrow();
  vi.restoreAllMocks();
  expect((await listProjects())[0]).toEqual(p);
  const database = await db();
  const count = await new Promise<number>((resolve, reject) => {
    const tx = database.transaction("media", "readonly"),
      r = tx.objectStore("media").count();
    tx.oncomplete = () => resolve(r.result);
    tx.onabort = () => reject(tx.error);
  });
  expect(count).toBe(0);
});
