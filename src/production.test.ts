import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { starterProject } from "./planner";
import { clone, parseBackup, uid, validateProject } from "./model";
import { legacyFixture } from "../tests/legacy-fixture";
import { audioDataValid, emptyProduction } from "./media-model";
import { builtInSound, wavBytes } from "./sounds";
import {
  audioPlan,
  captionText,
  captionsFromText,
  categoryBus,
  clipGain,
  clipStart,
  duplicateSceneMedia,
  newAudioClip,
  reconcileProduction,
  srt,
} from "./production";
import {
  deleteProject,
  friendlyStorageError,
  listProjects,
  saveProject,
} from "./storage";

function project() {
  const p = { ...starterProject("kindness"), ...emptyProduction() };
  const source = builtInSound("melody");
  p.audioAssets.push(source);
  p.audioClips.push(newAudioClip(p, source, "narration", 1, 1));
  return p;
}
afterEach(() => vi.restoreAllMocks());

describe("portable production data and historical migration", () => {
  it("adds reused dialogue and a new effect to the complete demonstration", () => {
    const p = starterProject("kindness"),
      source = p.audioAssets.find((a) => a.name === "Kindness melody")!;
    const c = newAudioClip(p, source, "dialogue", 0);
    c.characterId = p.characters[0].id;
    p.audioClips.push(c);
    expect(validateProject(p)).toEqual(p);
    const fx = builtInSound("notice");
    p.audioAssets.push(fx);
    p.audioClips.push(newAudioClip(p, fx, "effects", 0));
    expect(validateProject(p)).toEqual(p);
  });
  for (const version of [1, 2, 3])
    it(`migrates version ${version} without modifying its original art, motion or timing`, () => {
      const old = legacyFixture(starterProject("kindness"), version),
        before = JSON.stringify(old);
      const p = validateProject(old);
      expect(p.schemaVersion).toBe(4);
      expect(JSON.stringify(old)).toBe(before);
      expect(p.assets).toEqual(old.assets);
      expect(
        p.scenes.map((s) => [
          s.id,
          s.duration,
          s.elements.map((e) => [e.id, e.x, e.y, e.motion]),
        ]),
      ).toEqual(
        (old.scenes as typeof p.scenes).map((s) => [
          s.id,
          s.duration,
          s.elements.map((e) => [e.id, e.x, e.y, e.motion]),
        ]),
      );
      if (version === 3) expect(p.scenes).toEqual(old.scenes);
      expect(p.audioClips).toEqual([]);
      expect(p.mixer.master).toBe(1);
    });
  it("retains source bytes, trims, mixer, captions and animation in saves and portable restores", async () => {
    const p = project(),
      original = p.audioAssets[0].dataUrl;
    Object.assign(p.audioClips[0], {
      trimStart: 0.5,
      trimEnd: 4,
      duration: 3,
      fadeIn: 0.2,
      fadeOut: 0.5,
    });
    p.mixer.music = 0.2;
    p.captions = captionsFromText(p.scenes[1]);
    await saveProject(p);
    expect((await listProjects()).find((item) => item.id === p.id)).toEqual(p);
    const restored = parseBackup(JSON.stringify(p));
    expect(restored).toEqual(p);
    expect(restored.audioAssets[0].dataUrl).toBe(original);
    await deleteProject(p.id);
  });
  it("recovers after quota rejection while retaining the previously saved media", async () => {
    const p = project();
    await saveProject(p);
    const put = vi
      .spyOn(IDBObjectStore.prototype, "put")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    const changed = { ...p, title: "Still on screen" };
    await expect(saveProject(changed)).rejects.toMatchObject({
      name: "QuotaExceededError",
    });
    expect(
      friendlyStorageError(new DOMException("Full", "QuotaExceededError")),
    ).toContain("Download a project backup");
    put.mockRestore();
    expect((await listProjects()).find((item) => item.id === p.id)).toEqual(p);
    await saveProject(changed);
    expect((await listProjects()).find((item) => item.id === p.id)?.title).toBe(
      changed.title,
    );
    await deleteProject(p.id);
  });
  it("rejects bad signatures, missing sources/references, duplicate IDs and unsafe numeric values", () => {
    const p = project();
    for (const mutate of [
      (v: typeof p) => {
        v.audioAssets[0].dataUrl = `data:audio/wav;base64,${btoa('<svg onload="alert(1)"/>')}`;
      },
      (v: typeof p) => {
        v.audioClips[0].assetId = "missing";
      },
      (v: typeof p) => {
        v.audioClips[0].sceneId = "missing";
      },
      (v: typeof p) => {
        v.audioClips[0].characterId = "missing";
      },
      (v: typeof p) => {
        v.audioClips[0].start = NaN;
      },
      (v: typeof p) => {
        v.audioClips[0].trimEnd = 999;
      },
      (v: typeof p) => {
        v.audioClips[0].volume = 4;
      },
      (v: typeof p) => {
        v.audioClips[0].id = v.scenes[0].id;
      },
      (v: typeof p) => {
        v.audioAssets[0].duration = 121;
      },
      (v: typeof p) => {
        v.mixer.master = Infinity;
      },
      (v: typeof p) => {
        v.captions = [
          {
            id: uid(),
            sceneId: v.scenes[0].id,
            start: 5,
            end: 4,
            text: "Backwards",
          },
        ];
      },
    ]) {
      const bad = clone(p);
      mutate(bad);
      expect(() => validateProject(bad)).toThrow();
    }
    const old = legacyFixture(p, 3);
    old.audioAssets = p.audioAssets;
    expect(() => validateProject(old)).toThrow();
  });
  it("bounds total decoded sources, clip counts and simultaneous voices", () => {
    const p = project();
    p.audioAssets = Array.from({ length: 3 }, () => ({
      ...p.audioAssets[0],
      id: uid(),
      duration: 120,
    }));
    p.audioClips = [];
    expect(() => validateProject(p)).toThrow();
    const q = project();
    q.audioClips = Array.from({ length: 25 }, () => ({
      ...q.audioClips[0],
      id: uid(),
    }));
    expect(() => validateProject(q)).toThrow();
    q.audioClips = Array.from({ length: 241 }, (_, i) => ({
      ...q.audioClips[0],
      id: uid(),
      start: (i % 10) / 10,
      duration: 0.01,
    }));
    expect(() => validateProject(q)).toThrow();
  });
});

describe("one shared audio/caption timeline", () => {
  it("seeks into trimmed clips precisely and keeps music continuous across a scene cut", () => {
    const p = project(),
      voice = p.audioClips[0];
    Object.assign(voice, { trimStart: 1, trimEnd: 6, duration: 5 });
    const music = newAudioClip(p, p.audioAssets[0], "music", 0);
    Object.assign(music, {
      loop: true,
      trimStart: 2,
      trimEnd: 4,
      duration: 60,
    });
    p.audioClips.push(music);
    expect(clipStart(p, voice)).toBe(11);
    const plan = audioPlan(p, 13, 15);
    expect(plan.find((a) => a.clip === voice)).toMatchObject({
      from: 13,
      to: 15,
      elapsed: 2,
      offset: 3,
    });
    expect(audioPlan(p, 9.5, 10.5).find((a) => a.clip === music)).toMatchObject(
      { from: 9.5, to: 10.5, offset: 3.5 },
    );
    voice.muted = true;
    expect(audioPlan(p, 13, 15)).toHaveLength(1);
  });
  it("fades and category routing are deterministic, including intersecting fades", () => {
    const c = project().audioClips[0];
    Object.assign(c, { duration: 4, volume: 0.8, fadeIn: 3, fadeOut: 3 });
    expect(clipGain(c, -1)).toBe(0);
    expect(clipGain(c, 1)).toBeCloseTo(0.8 / 3);
    expect(clipGain(c, 2)).toBeCloseTo((0.8 * 2) / 3);
    expect(clipGain(c, 3)).toBeCloseTo(0.8 / 3);
    expect(clipGain(c, 4)).toBe(0);
    c.muted = true;
    expect(clipGain(c, 2)).toBe(0);
    expect(
      ["narration", "dialogue", "music", "effects"].map((c) =>
        categoryBus(c as "narration"),
      ),
    ).toEqual(["voice", "voice", "music", "effects"]);
  });
  it("scene duplication, retiming, reordering and deletion keep sources independent", () => {
    const p = project(),
      scene = p.scenes[1],
      copy = { ...clone(scene), id: uid() };
    p.captions = captionsFromText(scene);
    const duplicate = duplicateSceneMedia(p, scene, copy);
    expect(duplicate.audioClips[1].id).not.toBe(p.audioClips[0].id);
    expect(duplicate.audioClips[1].assetId).toBe(p.audioClips[0].assetId);
    expect(duplicate.captions.at(-1)?.sceneId).toBe(copy.id);
    const shorter = p.scenes.map((s) =>
      s === scene ? { ...s, duration: 5 } : s,
    );
    const retimed = reconcileProduction(p, shorter);
    expect(retimed.audioClips[0].start).toBe(0.5);
    expect(retimed.audioClips[0].duration).toBe(4.5);
    expect(retimed.captions.at(-1)?.end).toBe(5);
    const reordered = {
      ...p,
      scenes: [scene, ...p.scenes.filter((s) => s !== scene)],
    };
    expect(clipStart(reordered, p.audioClips[0])).toBe(1);
    expect(
      reconcileProduction(
        p,
        p.scenes.filter((s) => s !== scene),
      ),
    ).toEqual({ audioClips: [], captions: [] });
    expect(p.audioAssets).toHaveLength(1);
    expect(p.audioClips[0].start).toBe(1);
  });
  it("caption windows use exact scene boundaries and SRT carries global millisecond times", () => {
    const p = project(),
      id = p.scenes[1].id;
    p.captions = [
      {
        id: uid(),
        sceneId: id,
        start: 0.125,
        end: 2.5,
        text: "Would you like to play?",
      },
    ];
    expect(captionText(p, 10)).toBe("");
    expect(captionText(p, 10.125)).toBe("Would you like to play?");
    expect(captionText(p, 12.5)).toBe("");
    expect(srt(p)).toBe(
      "1\n00:00:10,125 --> 00:00:12,500\nWould you like to play?\n",
    );
  });
  it("the demonstration carries original decodable PCM with nonzero samples", () => {
    const p = starterProject("kindness");
    expect(validateProject(p)).toEqual(p);
    expect(
      p.audioClips.some((c) => c.category === "dialogue" && c.characterId),
    ).toBe(true);
    for (const asset of p.audioAssets) expect(audioDataValid(asset)).toBe(true);
    const bytes = wavBytes([Float32Array.from([0, 0.2, -0.4, 0.1])], 24000);
    expect(new DataView(bytes.buffer).getInt16(46, true)).toBeGreaterThan(1000);
    expect(p.captions.length).toBeGreaterThan(6);
  });
});
