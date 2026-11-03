import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterProject, planStory, DEFAULT_IDEA, STARTERS } from "./planner";
import { clone, makeScene, uid, parseBackup, validateProject } from "./model";
import { emptyProduction } from "./media-model";
import {
  chapterDrafts,
  insertDrafts,
  chapterSummary,
  artworkStory,
  applyCharacterAppearance,
  planningProgress,
} from "./story";
import { exportRange, planSegments, rangeArtwork } from "./segments";
import {
  audioPlan,
  captionText,
  duckingAt,
  duckingWindows,
  newAudioClip,
  srt,
} from "./production";
import { builtInSound } from "./sounds";
import { productionReadiness } from "./readiness";
import {
  imageLibraryItem,
  listLibrary,
  newLibraryItem,
  readPalette,
  removeLibraryItem,
  saveLibraryItem,
  savePalette,
} from "./library";
import {
  libraryBackup,
  restoreLibraryBackup,
  validateLibraryBackup,
} from "./library-backup";
import { saveProject, listProjects, deleteProject } from "./storage";
import { AudioDecodeCache, prepareAudio } from "./audio-engine";
import * as audioFiles from "./audio-files";

afterEach(() => vi.restoreAllMocks());
const original = {
  id: "source-art",
  type: "image" as const,
  name: "my original.png",
  mime: "image/png" as const,
  dataUrl: "data:image/png;base64,iVBORw0KGgo=",
};
function plain() {
  return { ...starterProject(), ...emptyProduction() };
}

describe("guided story plans and consistent episode characters", () => {
  it("keeps a twenty-minute goal honest and supplies chapters, dialogue and learning questions", () => {
    const p = planStory({
      ...DEFAULT_IDEA,
      idea: "A friend learns to ask for help",
      plannedMinutes: 20,
    });
    expect(p.scenes).toHaveLength(6);
    expect(planningProgress(p)).toMatchObject({
      seconds: 60,
      target: 1200,
      remaining: 1140,
    });
    expect(chapterSummary(p).map((c) => c.scenes.length)).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
    expect(p.scenes.every((s) => s.question && s.dialogue)).toBe(true);
    for (const starter of STARTERS)
      expect(validateProject(starterProject(starter.id)).templateId).toBe(
        starter.id,
      );
    expect(STARTERS.map((s) => s.id)).toEqual(
      expect.arrayContaining(["differences", "privacy", "nature", "chores"]),
    );
  });
  it("applies manually identified artwork roles while retaining the original source", () => {
    const p = plain(),
      before = clone(p);
    for (const role of ["character", "background", "prop"] as const) {
      const next = artworkStory(p, original, "Patch", "image", role);
      expect(next.assets).toHaveLength(1);
      expect(next.assets[0].dataUrl).toBe(original.dataUrl);
      if (role === "character") {
        expect(next.characters[0].name).toBe("Patch");
        expect(
          next.scenes.every(
            (s) => !s.elements[0].animation && s.elements[0].motion === "still",
          ),
        ).toBe(true);
      } else
        expect(
          next.scenes.every((s) =>
            s.elements.some(
              (e) =>
                e.name === "Patch" && !!e.backdrop === (role === "background"),
            ),
          ),
        ).toBe(true);
      expect(parseBackup(JSON.stringify(next))).toEqual(next);
    }
    expect(p).toEqual(before);
  });
  it("inserts reviewed scene batches without rewriting old scene media, positions or animation", () => {
    const p = starterProject(),
      before = clone(p),
      drafts = chapterDrafts(p, "exploration", 3, 30);
    drafts[0].narration = "The creator’s own small experiment.";
    const next = insertDrafts(p, drafts, 2);
    expect(next.scenes.slice(3, 6).map((s) => s.id)).toEqual(
      drafts.map((s) => s.id),
    );
    expect(
      next.scenes.filter((s) => !drafts.some((d) => d.id === s.id)),
    ).toEqual(before.scenes);
    expect(next.audioClips).toEqual(before.audioClips);
    expect(next.captions).toEqual(before.captions);
    expect(p).toEqual(before);
    expect(new Set(drafts.map((s) => s.narration)).size).toBe(3);
    expect(() => chapterDrafts(p, "opening", 13, 20)).toThrow();
    const full = {
      ...p,
      scenes: Array.from({ length: 120 }, () => makeScene(p.characters)),
    };
    expect(() => insertDrafts(full, drafts, 0)).toThrow(/120/);
  });
  it("copies only appearance across selected instances and preserves acting, layer order and source", () => {
    const p = starterProject(),
      source = p.scenes[0].elements[0];
    source.appearance = { shirt: "#123456" };
    source.name = "Pip in blue";
    const before = clone(p),
      next = applyCharacterAppearance(
        p,
        source,
        new Set(p.scenes.map((s) => s.id)),
      );
    for (let i = 0; i < p.scenes.length; i++) {
      expect(next.scenes[i].elements[0].appearance?.shirt).toBe("#123456");
      for (const key of [
        "x",
        "y",
        "scale",
        "pose",
        "emotion",
        "animation",
      ] as const)
        expect(next.scenes[i].elements[0][key]).toEqual(
          before.scenes[i].elements[0][key],
        );
      expect(next.scenes[i].elements.map((e) => e.id)).toEqual(
        before.scenes[i].elements.map((e) => e.id),
      );
    }
    expect(next.characters).toEqual(before.characters);
    expect(p).toEqual(before);
  });
  it("persists additive schema-4 chapter and source data without a destructive migration", async () => {
    const p = artworkStory(plain(), original, "Patch", "sketch");
    p.scenes[0].question = "How could Patch help?";
    await saveProject(p);
    expect((await listProjects()).find((v) => v.id === p.id)).toEqual(p);
    expect(parseBackup(JSON.stringify(p))).toEqual(p);
    await deleteProject(p.id);
    const bad = clone(p);
    bad.scenes[0].chapter = "unrecognized" as never;
    expect(() => validateProject(bad)).toThrow();
  });
});

describe("whole-scene segment timing", () => {
  it("covers a twenty-minute project exactly once under both device limits", () => {
    const p = plain();
    p.scenes = Array.from({ length: 60 }, (_, i) => ({
      ...makeScene(p.characters, i),
      duration: 20,
    }));
    for (const max of [60, 120]) {
      const plan = planSegments(p, max);
      expect(plan.oversized).toEqual([]);
      expect(plan.segments.every((s) => s.duration <= max)).toBe(true);
      expect(
        plan.segments.flatMap((s) =>
          p.scenes.slice(s.firstScene, s.lastScene + 1).map((s) => s.id),
        ),
      ).toEqual(p.scenes.map((s) => s.id));
      expect(plan.segments.at(-1)?.end).toBe(1200);
      for (let i = 1; i < plan.segments.length; i++)
        expect(plan.segments[i].start).toBe(plan.segments[i - 1].end);
    }
  });
  it("never drops an oversized scene and rejects invalid ranges or limits", () => {
    const p = plain();
    p.scenes[1].duration = 61;
    expect(planSegments(p, 60)).toEqual({ segments: [], oversized: [1] });
    expect(planSegments(p, 120).segments.length).toBeGreaterThan(0);
    for (const value of [NaN, 1, 121])
      expect(() => planSegments(p, value)).toThrow();
    for (const r of [
      { firstScene: 1, lastScene: 0 },
      { firstScene: -1, lastScene: 2 },
      { firstScene: 0, lastScene: 99 },
      { firstScene: 0.5, lastScene: 1 },
    ])
      expect(() => exportRange(p, r)).toThrow();
  });
  it("rebases segment subtitles and starts a trimmed loop at its original audio offset", () => {
    const p = plain(),
      music = builtInSound("melody");
    p.audioAssets = [music];
    const clip = newAudioClip(p, music, "music", 0);
    Object.assign(clip, {
      start: 0,
      trimStart: 1,
      trimEnd: 7,
      duration: 60,
      loop: true,
    });
    p.audioClips = [clip];
    p.captions = [
      {
        id: uid(),
        sceneId: p.scenes[1].id,
        start: 0,
        end: 3,
        text: "SECOND SCENE",
      },
      {
        id: uid(),
        sceneId: p.scenes[0].id,
        start: 8,
        end: 10,
        text: "FIRST SCENE",
      },
    ];
    const range = exportRange(p, { firstScene: 1, lastScene: 2 });
    expect(range.start).toBe(10);
    expect(audioPlan(p, range.start, range.end)[0]).toMatchObject({
      from: 10,
      elapsed: 10,
      offset: 5,
    });
    expect(srt(p, range)).toBe(
      "1\n00:00:00,000 --> 00:00:03,000\nSECOND SCENE\n",
    );
    expect(captionText(p, range.start)).toBe("SECOND SCENE");
    expect(captionText(p, range.start - 0.01)).toBe("FIRST SCENE");
    expect(p.audioClips[0]).toBe(clip);
  });
  it("loads only artwork referenced in the selected scenes", () => {
    const p = artworkStory(plain(), original, "Patch", "image");
    p.assets.push({ ...original, id: "unused-art" });
    expect(
      rangeArtwork(p, { firstScene: 0, lastScene: 1 }).map((a) => a.id),
    ).toEqual([original.id]);
  });
});

describe("readiness and reliable, gentle audio", () => {
  it("distinguishes optional creative choices from blocking resource and capability errors", () => {
    const p = plain();
    expect(productionReadiness(p, 60, true).filter((i) => i.blocking)).toEqual(
      [],
    );
    expect(
      productionReadiness(p, 60, true).some((i) => i.id.startsWith("voice:")),
    ).toBe(true);
    p.scenes[0].duration = 70;
    p.scenes[1].elements[0].assetId = "missing";
    p.captions = [
      {
        id: uid(),
        sceneId: p.scenes[0].id,
        start: 60,
        end: 80,
        text: "Too late",
      },
    ];
    const issues = productionReadiness(p, 60, false);
    expect(
      issues.filter((i) => i.blocking).map((i) => i.id.split(":")[0]),
    ).toEqual(expect.arrayContaining(["browser", "limit", "art", "caption"]));
  });
  it("ducks music deterministically, merging close voices with gentle attack and release", () => {
    const p = plain(),
      source = builtInSound("melody");
    p.audioAssets = [source];
    const a = newAudioClip(p, source, "narration", 0);
    Object.assign(a, { start: 1, duration: 2 });
    const b = { ...a, id: uid(), start: 3.2, duration: 1 };
    p.audioClips = [a, b];
    expect(duckingWindows(p)).toEqual([]);
    p.mixer.duckMusic = true;
    const windows = duckingWindows(p);
    expect(windows).toEqual([{ start: 1, end: 4.2 }]);
    expect(duckingAt(windows, 0.88)).toBeCloseTo(1);
    expect(duckingAt(windows, 0.94)).toBeCloseTo(0.65);
    expect(duckingAt(windows, 2)).toBeCloseTo(0.3);
    expect(duckingAt(windows, 4.48)).toBeCloseTo(1);
    b.muted = true;
    expect(duckingWindows(p)).toEqual([{ start: 1, end: 3 }]);
    p.mixer.voice = 0;
    expect(duckingWindows(p)).toEqual([]);
    expect(validateProject(p)).toEqual(p);
  });
  it("reuses decoded sources across parts, respects a memory budget and decodes only audible range sources", async () => {
    const buffer = {
      length: 1024,
      numberOfChannels: 1,
      duration: 8,
    } as AudioBuffer;
    const decode = vi
      .spyOn(audioFiles, "decodeAsset")
      .mockResolvedValue(buffer);
    const context = { sampleRate: 48000 } as AudioContext,
      cache = new AudioDecodeCache(4096),
      a = builtInSound("melody"),
      b = { ...a, id: uid() };
    await cache.get(context, a);
    await cache.get(context, a);
    expect(decode).toHaveBeenCalledTimes(1);
    expect(cache.stats().bytes).toBe(4096);
    await cache.get(context, b);
    expect(cache.stats().sources).toBe(1);
    await cache.get(context, a);
    expect(decode).toHaveBeenCalledTimes(3);
    const p = plain();
    p.audioAssets = [a, b];
    p.audioClips = [
      newAudioClip(p, a, "narration", 0),
      newAudioClip(p, b, "narration", 1),
    ];
    const buffers = await prepareAudio(
      context,
      p,
      undefined,
      { start: 0, end: 5 },
      cache,
    );
    expect([...buffers.keys()]).toEqual([a.id]);
    expect(decode).toHaveBeenCalledTimes(3);
    cache.clear();
    expect(cache.stats().bytes).toBe(0);
    expect(cache.stats().sources).toBe(0);
  });
});

describe("portable reusable artwork recovery", () => {
  it("restores new copies atomically with artwork bytes and palette, without touching projects", async () => {
    const item = imageLibraryItem(original, "Patch", "character"),
      p = plain();
    await saveLibraryItem(item, true);
    await savePalette(["#123456"]);
    await saveProject(p);
    const backup = await libraryBackup();
    expect(backup.items.some((i) => i.id === item.id)).toBe(true);
    const count = await restoreLibraryBackup(backup);
    expect(count).toBe(backup.items.length);
    const all = await listLibrary(),
      copies = all.filter((i) => i.name === "Patch");
    expect(copies).toHaveLength(2);
    expect(new Set(copies.map((i) => i.id)).size).toBe(2);
    expect(copies[1].assets[0].dataUrl).toBe(original.dataUrl);
    expect(await readPalette()).toContain("#123456");
    expect((await listProjects()).find((v) => v.id === p.id)).toEqual(p);
    for (const item of all) await removeLibraryItem(item.id);
    await deleteProject(p.id);
  });
  it("rejects malformed, duplicated and unsafe artwork before importing anything", async () => {
    const item = newLibraryItem("Keep me"),
      backup = {
        format: "chiptoons-art-library",
        version: 1,
        items: [item],
        palette: [],
      };
    await saveLibraryItem(item, true);
    const before = await listLibrary();
    expect(() =>
      validateLibraryBackup({ ...backup, items: [item, item] }),
    ).toThrow(/repeats/);
    const unsafe = imageLibraryItem(original, "Unsafe", "character");
    unsafe.assets[0].dataUrl = "data:image/svg+xml,<svg onload='alert(1)'/>";
    await expect(
      restoreLibraryBackup({ ...backup, items: [item, unsafe] }),
    ).rejects.toThrow();
    expect(await listLibrary()).toEqual(before);
    await removeLibraryItem(item.id);
  });
  it("rolls back all art copies on a transaction error and preserves the existing collection", async () => {
    const existing = newLibraryItem("Original"),
      a = newLibraryItem("New A"),
      b = newLibraryItem("New B");
    await saveLibraryItem(existing, true);
    const add = IDBObjectStore.prototype.add;
    let count = 0;
    vi.spyOn(IDBObjectStore.prototype, "add").mockImplementation(function (
      this: IDBObjectStore,
      value: unknown,
      key?: IDBValidKey,
    ) {
      if (this.name === "library" && ++count === 2) {
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return add.call(this, value, key);
    });
    await expect(
      restoreLibraryBackup({
        format: "chiptoons-art-library",
        version: 1,
        items: [a, b],
        palette: [],
      }),
    ).rejects.toThrow();
    vi.restoreAllMocks();
    expect((await listLibrary()).map((i) => i.id)).toEqual([existing.id]);
    await removeLibraryItem(existing.id);
  });
});
