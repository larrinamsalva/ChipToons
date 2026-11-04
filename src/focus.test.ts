import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { captionBand } from "./captions";
import { visualTeachingExample } from "./focus-examples";
import { focusIssue, focusWindow, stepNeedsReview } from "./focus-model";
import { focusAnchor, focusContrast, focusLayout, focusTiming, intersects, projectFocusPoint, sceneCaptionBand } from "./focus-motion";
import { newFocusGraphic } from "./focus-studio";
import { stagePoint } from "./interaction-motion";
import { parseBackup, uid, validateProject } from "./model";
import { starterProject } from "./planner";
import { cleanSceneReferences, duplicateAnimatedScene, retimeScene, sceneFramesAt, cameraAt } from "./timeline";
import { transformExample } from "./transform-examples";

function sample() {
  const original = transformExample("wagon");
  const project = visualTeachingExample(original, "wagon");
  const scene = project.scenes[0];
  return { original, project, scene, wagon: scene.elements.find(item => item.prop === "toy-wagon")!,
    graphics: scene.focusGraphics! };
}

describe("visual teaching graphics", () => {
  test("preserves original demos and backs all four visual lessons with editable graphics", () => {
    const { original, project } = sample();
    expect(original.scenes[0].focusGraphics).toBeUndefined();
    expect(project.scenes[0].elements).toEqual(original.scenes[0].elements);
    expect(project.captions).toEqual(original.captions);
    for (const example of ["tidy", "seed", "bridge"] as const) {
      const augmented = visualTeachingExample(transformExample(example), example);
      expect(augmented.scenes[0].focusGraphics!.length).toBeGreaterThanOrEqual(2);
    }
    const legacy = starterProject();
    expect(parseBackup(JSON.stringify(legacy))).toEqual(legacy);
  });

  test("uses the sampled hand position, camera and local detail for the stable object ID", () => {
    const { project, scene, wagon, graphics } = sample();
    const arrow = graphics.find(item => item.kind === "arrow")!;
    const sameName = { ...wagon, id: uid(), x: 50, y: 380 };
    const alternate = { ...scene, elements: [sameName, ...scene.elements] };
    const at = 6.1;
    const frames = sceneFramesAt(project, alternate, at);
    const frame = frames.get(wagon.id)!;
    expect(frame.heldBy).toBeTruthy();
    const camera = cameraAt(alternate, at);
    const local = stagePoint(wagon, frame, { x: 61, y: -6 });
    expect(focusAnchor(alternate, arrow, frames, camera)).toEqual({
      x: 400 + (local.x - camera.x) * camera.zoom, y: 225 + (local.y - camera.y) * camera.zoom,
    });
    expect(focusAnchor(alternate, arrow, frames, cameraAt(alternate, 0))).not.toEqual(focusAnchor(alternate, arrow, frames, camera));
    const fixed = graphics.find(item => item.kind === "card")!;
    expect(focusAnchor(alternate, fixed, frames, camera)).toEqual(focusAnchor(alternate, fixed, frames, cameraAt(alternate, 0)));
  });

  test("includes scenery depth and transforms offsets for flipped artwork", () => {
    const { scene, wagon } = sample();
    const object = { ...wagon, sceneryDepth: "behind" as const, flip: true, flipY: true };
    const withDepth = { ...scene, gentleDepth: true };
    const frame = { x: 400, y: 225, scale: 1.5, rotation: 90 };
    const camera = { x: 460, y: 255, zoom: 1.25 };
    const p = projectFocusPoint(withDepth, object, frame, camera, { x: 10, y: 20 });
    expect(p.x).toBeCloseTo(377.5);
    expect(p.y).toBeCloseTo(176.25);
    expect(projectFocusPoint(withDepth, object, frame, camera, { x: 10, y: 20 }, true)).not.toEqual(p);
  });

  test("samples start, fade, reveal and end deterministically, including calm previews", () => {
    const { scene, graphics } = sample();
    const arrow = { ...graphics[2], at: 2, length: 2, fadeIn: 0.2, fadeOut: 0.4, reveal: true };
    expect(focusTiming(scene, arrow, 1.99)).toBeUndefined();
    expect(focusTiming(scene, arrow, 2)).toEqual({ opacity: 0, progress: 0 });
    const early = focusTiming(scene, arrow, 2.1)!;
    expect(early.opacity).toBeCloseTo(0.5);
    expect(early.progress).toBeCloseTo(0.1 / 0.45);
    expect(focusTiming(scene, arrow, 3.8)?.opacity).toBeCloseTo(0.5);
    expect(focusTiming(scene, arrow, 4)).toBeUndefined();
    expect(focusTiming(scene, arrow, 2.1)).toEqual(early);
    expect(focusTiming(scene, arrow, 2.1, true)).toEqual({ opacity: 1, progress: 1 });
  });

  test("follows linked interaction and repair cues without overwriting custom learning wording", () => {
    const { scene, graphics } = sample();
    const action = scene.interactions![1];
    const arrow = { ...graphics[2], cue: { kind: "action" as const, interactionId: action.id, moment: "Attach" } };
    const changedAction = { ...scene, interactions: [scene.interactions![0], { ...action, attach: 5.25 }] };
    expect(focusWindow(changedAction, arrow).start).toBe(5.25);
    const track = scene.objectTracks![0];
    const repaired = graphics[4];
    const moved = { ...scene, objectTracks: [{ ...track, changes: [{ ...track.changes[0], at: 10 }] }] };
    expect(focusWindow(moved, repaired).start).toBe(10);
    const step = scene.learningSteps![1];
    const number = graphics[1];
    expect(stepNeedsReview(scene, number)).toBe(false);
    const edited = { ...scene, learningSteps: scene.learningSteps!.map(item => item.id === step.id ? { ...item, text: "Find a different detail" } : item) };
    expect(stepNeedsReview(edited, number)).toBe(true);
    expect(number.text).toBe("Look at the wheel");
  });

  test("keeps a fixed card clear of the exact existing top or bottom subtitle area", () => {
    const { project, scene, graphics } = sample();
    const card = graphics.find(item => item.kind === "card")!;
    const band = sceneCaptionBand(project, scene)!;
    const bottom = focusLayout(card, { x: 400, y: 425 }, band);
    expect(bottom.captionOverlap).toBe(true);
    expect(intersects(bottom.box!, band)).toBe(false);
    const topBand = captionBand(["We can look carefully."], { ...project.captionStyle, position: "top" })!;
    expect(intersects(focusLayout(card, { x: 400, y: 30 }, topBand).box!, topBand)).toBe(false);
    expect(focusContrast("#121925", "#fff5aa")).toBeGreaterThan(4.5);
    expect(focusContrast("#ffffff", "#ffffff")).toBe(1);
  });

  test("rejects invalid IDs, unsupported styles, references, times and excessive overlaps", () => {
    const { scene, graphics } = sample();
    const arrow = graphics[2];
    expect(focusIssue(graphics, scene)).toBeUndefined();
    for (const patch of [{ id: "" }, { style: "unsafe" }, { at: -1 }, { length: 999 }, { fadeIn: 6 },
      { ink: "url(unsafe)" }, { text: "X".repeat(89) }, { target: { ...arrow.target, id: "missing" } },
      { cue: { kind: "change", id: "missing" } }, { kind: "label", text: "" }]) {
      expect(focusIssue([{ ...arrow, ...patch }], scene)).toBeTruthy();
    }
    expect(focusIssue([arrow, arrow], scene)).toBeTruthy();
    expect(focusIssue(Array.from({ length: 4 }, () => ({ ...arrow, id: uid() })), scene)).toMatch(/three/);
    const spot = { ...arrow, kind: "spotlight", reveal: false };
    expect(focusIssue([spot, { ...spot, id: uid() }], scene)).toMatch(/one spotlight/);
  });

  test("remaps all scene links and retains editable fallback graphics when a target or cue is deleted", () => {
    const { scene, wagon, graphics } = sample();
    const copy = duplicateAnimatedScene(scene);
    const ids = copy.focusGraphics!;
    expect(ids[0].id).not.toBe(graphics[0].id);
    expect(ids[0].target).toMatchObject({ id: copy.elements.find(item => item.prop === "toy-wagon")!.id });
    expect(ids[1].cue).toMatchObject({ id: copy.learningSteps![1].id });
    expect(ids[1].stepSource?.id).toBe(copy.learningSteps![1].id);
    expect(ids[4].cue).toMatchObject({ id: copy.objectTracks![0].changes[0].id });
    expect(focusIssue(ids, copy)).toBeUndefined();
    const shorter = retimeScene(scene, 7);
    expect(focusWindow(shorter, shorter.focusGraphics![4]).start).toBe(4.625);
    const removed = cleanSceneReferences({ ...scene, elements: scene.elements.filter(item => item.id !== wagon.id) }, scene);
    expect(removed.focusGraphics![4]).toMatchObject({ target: { kind: "missing" }, cue: undefined, at: 9.25 });
    expect(focusIssue(removed.focusGraphics, removed)).toBeUndefined();
    const removedStep = cleanSceneReferences({ ...scene, learningSteps: [] }, scene);
    expect(stepNeedsReview(removedStep, removedStep.focusGraphics![1])).toBe(true);
  });

  test("preserves graphics, captions and original media in complete project backups", async () => {
    const { project, scene } = sample();
    const graphic = newFocusGraphic(scene, 12);
    const other = { ...scene, focusGraphics: [...scene.focusGraphics!, graphic] };
    const validated = validateProject({ ...project, scenes: [other, project.scenes[1]] });
    const file = new File([await episodePackage(validated)], "visual-teaching.ctepisode");
    const restored = await restoreProjectFile(file);
    expect(restored.id).not.toBe(validated.id);
    expect(restored.scenes).toEqual(validated.scenes);
    expect(restored.captions).toEqual(validated.captions);
    expect(restored.audioAssets).toEqual(validated.audioAssets);
  });
});
