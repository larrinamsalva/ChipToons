import { emptyProduction } from "./media-model";
import { legacyFixture } from "../tests/legacy-fixture";
import { describe, it, expect, vi, afterEach } from "vitest";
import { starterProject } from "./planner";
import { clone, validateProject, parseBackup } from "./model";
import type { Project } from "./model";
import { ACTIONS, presetAnimation, actionsFor } from "./presets";
import {
  sceneAt,
  elementAt,
  elementBase,
  putElementKey,
  cameraAt,
  cameraValuesAt,
  backgroundAt,
  easeAt,
  snapTime,
  duplicateAnimatedScene,
  duplicateElement,
  cleanSceneReferences,
  retimeScene,
  frameAt,
  sceneStart,
} from "./timeline";
import { PlaybackClock, advancePlayback } from "./playback";
import { saveProject, listProjects, deleteProject } from "./storage";
import "fake-indexeddb/auto";

const project = () => starterProject("friendship");
function animated() {
  const p = project(),
    s = p.scenes[0],
    e = s.elements[0];
  e.motion = "still";
  e.x = 100;
  e.y = 340;
  e.animation = putElementKey(e, 0, s.duration, { x: 100, y: 340 });
  e.animation = putElementKey(e, 4, s.duration, {
    x: 500,
    y: 180,
    scale: 2,
    rotation: 180,
    opacity: 0.2,
    emotion: "sad",
    pose: "sitting",
  });
  e.animation.keyframes[1].easing = "linear";
  return p;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("shared deterministic animation renderer", () => {
  it("interpolates transforms while holding discrete acting until the authored time", () => {
    const p = animated(),
      e = p.scenes[0].elements[0];
    expect(elementAt(e, 2, 10, true)).toMatchObject({
      x: 300,
      y: 260,
      scale: 1.5,
      rotation: 90,
      opacity: 0.6,
      emotion: "happy",
      pose: "standing",
    });
    expect(elementAt(e, 4, 10, true)).toMatchObject({
      x: 500,
      y: 180,
      emotion: "sad",
      pose: "sitting",
    });
    expect(elementAt(e, 10, 10, true).x).toBe(500);
    expect(elementAt(e, -2, 10, true).x).toBe(100);
  });
  it("reproduces arbitrary samples and out-of-order seeks without mutating data", () => {
    const p = starterProject(),
      before = JSON.stringify(p),
      s = p.scenes[1];
    const sample = sceneAt(s, 5.731);
    [9, 0, 2.5, 10, 1].forEach((t) => sceneAt(s, t));
    expect(sceneAt(s, 5.731)).toEqual(sample);
    expect(JSON.stringify(p)).toBe(before);
    expect(sceneAt(s, NaN)).toEqual(sceneAt(s, 0));
    expect(frameAt(p, NaN).index).toBe(0);
  });
  it("supports all easing curves, exact endpoints and bounded non-flashing bounce", () => {
    for (const easing of [
      "linear",
      "ease-in",
      "ease-out",
      "ease-in-out",
      "bounce",
    ] as const) {
      expect(easeAt(0, easing)).toBe(0);
      expect(easeAt(1, easing)).toBe(1);
      for (let i = 0; i <= 100; i++)
        expect(easeAt(i / 100, easing)).toBeGreaterThanOrEqual(0);
      for (let i = 0; i <= 100; i++)
        expect(easeAt(i / 100, easing)).toBeLessThanOrEqual(1);
    }
    expect(easeAt(0.5, "ease-in")).toBe(0.25);
    expect(easeAt(0.5, "ease-out")).toBe(0.75);
    expect(easeAt(0.5, "ease-in-out")).toBe(0.5);
  });
  it("retains legacy motion and base opacity when explicit tracks are absent", () => {
    const p = project(),
      e = p.scenes[0].elements[0];
    e.motion = "enter-left";
    e.opacity = 0.4;
    expect(elementAt(e, 0, 10, true).x).toBe(e.x - 800);
    expect(elementAt(e, 10, 10, true)).toMatchObject({ x: e.x, opacity: 0.4 });
    e.motion = "fade";
    expect(elementAt(e, 0, 10, true).opacity).toBe(0);
    expect(elementAt(e, 10, 10, true).opacity).toBe(0.4);
  });
  it("stores manually timed talking modes and samples mouth frames without audio", () => {
    const p = animated(),
      e = p.scenes[0].elements[0];
    e.animation = putElementKey(e, 0, 10, { mouth: "talking" });
    e.animation = putElementKey(e, 1, 10, { mouth: "closed" });
    expect(elementAt(e, 0.05, 10).mouth).toBe("closed");
    expect(elementAt(e, 0.25, 10).mouth).toBe("open");
    expect(elementAt(e, 1, 10).mouth).toBe("closed");
    expect(
      putElementKey(e, 0.3, 10).keyframes.find((k) => k.time === 0.3)?.mouth,
    ).toBe("talking");
  });
  it("keeps preview accommodations out of saved keyframes", () => {
    const p = animated(),
      e = p.scenes[0].elements[0];
    e.animation!.idle = "float";
    e.animation!.keyframes[0].heart = "helping";
    const before = clone(e);
    expect(elementAt(e, 0.5, 10, true).y).not.toBe(
      elementAt(e, 0.5, 10, false).y,
    );
    expect(elementAt(e, 0.5, 10, true).blink).toBe(false);
    expect(elementAt(e, 0.5, 10, true).x).toBe(elementAt(e, 0.5, 10, false).x);
    expect(e).toEqual(before);
  });
  it("interpolates camera center/zoom and follows the same sampled character", () => {
    const p = animated(),
      s = p.scenes[0];
    s.cameraAnimation = {
      keyframes: [
        { id: "cam-a", time: 0, x: 400, y: 225, zoom: 1, easing: "linear" },
        { id: "cam-b", time: 4, x: 500, y: 265, zoom: 2, easing: "linear" },
      ],
    };
    expect(cameraAt(s, 2)).toEqual({ x: 450, y: 245, zoom: 1.5 });
    s.cameraAnimation.followId = s.elements[0].id;
    const f = cameraAt(s, 2);
    expect(f.x).toBe(350);
    expect(f.y).toBe(160);
    expect(sceneAt(s, 2).camera).toEqual(f);
  });
  it("adds follow-camera keys without applying target offsets twice", () => {
    const s = animated().scenes[0];
    s.cameraAnimation = { keyframes: [], followId: s.elements[0].id };
    const before = cameraAt(s, 2);
    const values = cameraValuesAt(s, 2);
    s.cameraAnimation.keyframes.push({
      ...values,
      id: "follow-moment",
      time: 2,
      easing: "linear",
    });
    expect(cameraAt(s, 2)).toEqual(before);
    s.elements[0].animation!.idle = "float";
    expect(cameraAt(s, 2, true).y).toBe(before.y);
  });
  it("keeps layer order, source position and library identity during sampling", () => {
    const p = animated(),
      s = p.scenes[0],
      before = clone(s);
    s.elements[0].sourceLibraryId = "saved-source";
    expect(sceneAt(s, 2).elements.map((e) => e.id)).toEqual(
      s.elements.map((e) => e.id),
    );
    expect(s.elements[0].x).toBe(before.elements[0].x);
    expect(s.elements[0].sourceLibraryId).toBe("saved-source");
  });
  it("can disable background motion without deleting its authored track", () => {
    const s = project().scenes[0];
    s.backgroundAnimation = {
      enabled: true,
      style: "drift",
      keyframes: [
        {
          id: "bg0",
          time: 0,
          x: -20,
          y: 0,
          scale: 1.1,
          opacity: 1,
          easing: "linear",
        },
        {
          id: "bg1",
          time: 10,
          x: 20,
          y: 10,
          scale: 1.2,
          opacity: 0.5,
          easing: "linear",
        },
      ],
    };
    expect(backgroundAt(s, 5)).toMatchObject({
      x: 0,
      y: 5,
      scale: 1.15,
      opacity: 0.75,
    });
    expect(backgroundAt(s, 5).drift).not.toBe(0);
    s.backgroundAnimation.enabled = false;
    expect(backgroundAt(s, 5)).toEqual({
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      drift: 0,
      sway: 0,
      twinkle: 1,
    });
    expect(s.backgroundAnimation.keyframes).toHaveLength(2);
  });
});
describe("editable actions and project graph safety", () => {
  it("generates valid editable data for every requested action", () => {
    for (const [action] of ACTIONS) {
      const p = project(),
        s = p.scenes[0],
        e = s.elements[0];
      e.animation = presetAnimation(e, s.duration, action, 1, 3);
      expect(e.animation.keyframes.length).toBeGreaterThanOrEqual(2);
      expect(validateProject(p)).toEqual(p);
      expect(elementAt(e, 2, s.duration)).toEqual(elementAt(e, 2, s.duration));
    }
    expect(actionsFor(false).map(([id]) => id)).not.toContain("wave");
    expect(actionsFor(false, true).map(([id]) => id)).toContain("door");
  });
  it("holds until a delayed action and clamps its end to the scene", () => {
    const e = project().scenes[0].elements[0];
    e.animation = presetAnimation(e, 10, "jump", 3, 40);
    expect(elementAt(e, 1, 10, true).y).toBe(e.y);
    expect(elementAt(e, 3, 10, true).y).toBe(e.y);
    expect(e.animation.keyframes.at(-1)?.time).toBe(10);
    expect(snapTime(1.24, 0.5, 10)).toBe(1);
    expect(snapTime(10.2, 0.1, 10)).toBe(10);
  });
  it("upserts an exact time without duplicating IDs or modifying library/base values", () => {
    const p = animated(),
      e = p.scenes[0].elements[0],
      before = clone(e);
    const id = e.animation!.keyframes[1].id;
    e.animation = putElementKey(e, 4, 10, { x: 630 });
    expect(e.animation.keyframes).toHaveLength(2);
    expect(e.animation.keyframes[1].id).toBe(id);
    expect(e.x).toBe(before.x);
    expect(elementAt(e, 4, 10, true).x).toBe(630);
  });
  it("duplicates scene tracks with fresh IDs and remaps camera follow", () => {
    const p = animated(),
      s = p.scenes[0];
    s.cameraAnimation = {
      followId: s.elements[0].id,
      keyframes: [
        { id: "camera0", time: 0, x: 400, y: 225, zoom: 1, easing: "linear" },
      ],
    };
    const copied = duplicateAnimatedScene(s);
    p.scenes.push(copied);
    expect(copied.cameraAnimation?.followId).toBe(copied.elements[0].id);
    expect(copied.elements[0].animation!.keyframes[0].id).not.toBe(
      s.elements[0].animation!.keyframes[0].id,
    );
    expect(validateProject(p)).toEqual(p);
    const e = duplicateElement(s.elements[0], 15);
    expect(e.animation!.keyframes[0].x).toBe(
      s.elements[0].animation!.keyframes[0].x + 15,
    );
  });
  it("removes dangling follows when an animated element is deleted", () => {
    const p = animated(),
      s = p.scenes[0],
      id = s.elements[0].id;
    s.cameraAnimation = { followId: id, keyframes: [] };
    s.elements = s.elements.filter((e) => e.id !== id);
    p.scenes[0] = cleanSceneReferences(s);
    expect(p.scenes[0].cameraAnimation?.followId).toBeUndefined();
    expect(validateProject(p)).toEqual(p);
  });
  it("retimes all tracks proportionally when scene duration changes", () => {
    const p = starterProject();
    Object.assign(p, emptyProduction());
    const s = p.scenes[1],
      next = retimeScene(s, 5);
    expect(next.cameraAnimation?.keyframes.at(-1)?.time).toBe(5);
    expect(elementAt(next.elements[0], 2.5, 5, true).x).toBe(
      elementAt(s.elements[0], 5, 10, true).x,
    );
    expect(s.duration).toBe(10);
    p.scenes[1] = next;
    expect(validateProject(p)).toEqual(p);
  });
  it.each([
    "negative time",
    "past end",
    "duplicate time",
    "duplicate id",
    "bad type",
    "missing follow",
    "invalid numeric",
    "excessive keys",
  ])("rejects %s before imported state can change", (kind) => {
    const p = animated(),
      s = p.scenes[0],
      keys = s.elements[0].animation!.keyframes;
    if (kind === "negative time") keys[0].time = -1;
    if (kind === "past end") keys[1].time = 11;
    if (kind === "duplicate time") keys[1].time = keys[0].time;
    if (kind === "duplicate id") keys[1].id = keys[0].id;
    if (kind === "bad type")
      (keys[0] as unknown as { mouth: string }).mouth = "<script>";
    if (kind === "missing follow")
      s.cameraAnimation = { keyframes: [], followId: "gone" };
    if (kind === "invalid numeric") keys[0].scale = Infinity;
    if (kind === "excessive keys")
      s.elements[0].animation!.keyframes = Array.from(
        { length: 121 },
        (_, i) => ({ ...keys[0], id: `key-${i}`, time: i / 13 }),
      );
    expect(() => validateProject(p)).toThrow();
  });
  it("enforces the project-wide keyframe budget in addition to per-track limits", () => {
    const p = project(),
      s = p.scenes[0],
      base = elementBase(s.elements[0]);
    p.scenes = Array.from({ length: 100 }, (_, i) => ({
      ...clone(s),
      id: `scene-${i}`,
      elements: [
        {
          ...s.elements[0],
          id: `actor-${i}`,
          animation: {
            blink: true,
            idle: "none",
            keyframes: Array.from({ length: 120 }, (_, j) => ({
              ...base,
              id: `key-${i}-${j}`,
              time: j / 12,
              easing: "linear",
            })),
          },
        },
      ],
    })) as Project["scenes"];
    expect(validateProject(p).scenes).toHaveLength(100);
    const more = clone(p.scenes[0]);
    more.id = "extra-scene";
    more.elements[0].id = "extra-actor";
    more.elements[0].animation!.keyframes.forEach((k, i) => {
      k.id = `extra-${i}`;
    });
    p.scenes.push(more);
    expect(() => validateProject(p)).toThrow();
  });
});
describe("compatibility, persistence and playback", () => {
  it.each([1, 2])(
    "migrates schema %i without moving artwork or changing legacy presets",
    (version) => {
      const p = project(),
        old = legacyFixture(p, version),
        before = JSON.stringify(old);
      const restored = parseBackup(before);
      expect(restored.schemaVersion).toBe(4);
      expect(JSON.stringify(old)).toBe(before);
      const positions = (project: Project) =>
        project.scenes.map((s) => ({
          id: s.id,
          duration: s.duration,
          elements: s.elements.map((e) => [e.id, e.x, e.y, e.motion]),
        }));
      expect(positions(restored)).toEqual(positions(p));
    },
  );
  it("round trips animated artwork in portable backups and IndexedDB", async () => {
    const p = starterProject();
    await saveProject(p);
    const reopened = (await listProjects()).find((x) => x.id === p.id)!;
    expect(parseBackup(JSON.stringify(reopened))).toEqual(p);
    expect(sceneAt(reopened.scenes[1], 7.123)).toEqual(
      sceneAt(p.scenes[1], 7.123),
    );
    await deleteProject(p.id);
  });
  it("upgrades the inclusion demo with timed faces, hearts, multiple keys and camera motion", () => {
    const p = starterProject();
    expect(validateProject(p)).toEqual(p);
    expect(sceneAt(p.scenes[1], 2).elements[1].emotion).toBe("sad");
    expect(sceneAt(p.scenes[1], 7).elements[0].pose).toBe("waving");
    expect(
      sceneAt(p.scenes[2], 7).elements.every((e) => e.heart === "together"),
    ).toBe(true);
    expect(cameraAt(p.scenes[1], 6).zoom).toBeGreaterThan(1);
    expect(sceneStart(p, 3)).toBe(30);
    expect(frameAt(p, 10).index).toBe(1);
  });
  it("advances, wraps selected-scene loops and stops at an exact ending", () => {
    expect(advancePlayback(9.9, 0.2, 0, 10, false)).toEqual({
      seconds: 10,
      playing: false,
    });
    expect(advancePlayback(19.9, 0.2, 10, 20, true).seconds).toBeCloseTo(10.1);
    expect(advancePlayback(10, 30.5, 10, 20, true).seconds).toBe(10.5);
  });
  it("pauses without advancing and resumes without counting paused wall time", () => {
    let next = 0;
    const queue = new Map<number, FrameRequestCallback>();
    vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
      queue.set(++next, fn);
      return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
    const step = (time: number) => {
      const callbacks = [...queue.values()];
      queue.clear();
      callbacks.forEach((fn) => fn(time));
    };
    const clock = new PlaybackClock();
    clock.configure(0, 2, false);
    clock.play();
    step(0);
    step(100);
    expect(clock.getSnapshot().seconds).toBeCloseTo(0.1);
    clock.pause();
    step(1000);
    expect(clock.getSnapshot().seconds).toBeCloseTo(0.1);
    clock.play();
    step(1000);
    step(1100);
    expect(clock.getSnapshot().seconds).toBeCloseTo(0.2);
    clock.seek(1.5);
    expect(clock.getSnapshot().seconds).toBe(1.5);
    clock.dispose();
  });
});
