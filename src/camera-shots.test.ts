import "fake-indexeddb/auto";
import { describe, expect, test } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { MAX_CAMERA_SHOTS, shotAt, shotIssue, shotNeedsReview } from "./camera-shots";
import { episodePackage, restoreProjectFile } from "./episode-package";
import { projectFocusPoint } from "./focus-motion";
import { uid, validateProject } from "./model";
import { duplicateScript, withScript } from "./script";
import { newCameraShot, shotPreset } from "./shot-director";
import { cameraAt, cleanSceneReferences, duplicateAnimatedScene, retimeScene, sceneFramesAt, stageCameraAt } from "./timeline";
import { transformExample } from "./transform-examples";

describe("camera shots", () => {
  test("validates intervals, references, zoom, unique IDs and the shot count", () => {
    const project = cameraShotDemo(), scene = project.scenes[0], [first, second] = scene.cameraShots!;
    expect(shotIssue([first, second], scene)).toBeUndefined();
    expect(shotIssue([first, { ...second, start: 1.19 }], scene)).toMatch(/overlap/);
    expect(shotIssue([first, { ...second, id: first.id }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, end: first.start }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, frame: { ...first.frame, zoom: 3.01 } }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, move: 3 }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, targets: [uid()] }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, lineId: uid() }], scene)).toBeTruthy();
    expect(shotIssue([{ ...first, cue: { anchor: { kind: "focus", id: uid() }, reviewedAt: 0 } }], scene)).toBeTruthy();
    expect(shotIssue(Array(MAX_CAMERA_SHOTS + 1).fill(first), scene)).toMatch(/24/);
    expect(() => validateProject({ ...project, scenes: [{ ...scene, cameraShots: [{ ...first, id: scene.id }] }, project.scenes[1]] })).toThrow();
  });

  test("uses exact half-open cuts and returns to the unmodified authored camera in the gaps", () => {
    const project = cameraShotDemo(), scene = project.scenes[0], [wide, , , close] = scene.cameraShots!;
    const mix = { ...scene, cameraShots: [wide, close] };
    expect(shotAt(mix, wide.end - 0.000001)?.id).toBe(wide.id);
    expect(stageCameraAt(project, mix, wide.end)).toEqual(cameraAt(scene, wide.end));
    expect(stageCameraAt(project, mix, close.start - 0.000001)).toEqual(cameraAt(scene, close.start - 0.000001));
    expect(stageCameraAt(project, mix, close.start)).toMatchObject({ shotId: close.id, zoom: 2.35 });
    expect(stageCameraAt(project, mix, close.end)).toEqual(cameraAt(scene, close.end));
    expect(stageCameraAt(project, mix, scene.duration)).toEqual(cameraAt(scene, scene.duration));
    expect(mix.cameraAnimation).toBe(scene.cameraAnimation);
  });

  test("eases deterministically from the previous composition and gives calm previews a settled frame", () => {
    const project = cameraShotDemo(), scene = project.scenes[0], move = scene.cameraShots!.find(shot => shot.style === "move")!;
    const from = stageCameraAt(project, scene, move.start), to = stageCameraAt(project, scene, move.start + move.move);
    expect(from.zoom).toBeCloseTo(2.65);
    expect(to.zoom).toBeCloseTo(1.55);
    const mid = move.start + move.move / 2, expected = stageCameraAt(project, scene, mid);
    expect(expected.zoom).toBeCloseTo((from.zoom + to.zoom) / 2);
    expect(expected.x).toBeCloseTo((from.x + to.x) / 2);
    expect(stageCameraAt(project, scene, move.start + 0.2).zoom).toBeGreaterThan(expected.zoom);
    expect(stageCameraAt(project, scene, mid)).toEqual(expected);
    expect(stageCameraAt(project, scene, mid, true)).toEqual(to);
  });

  test("uses held and moving object positions, and can hold framing at the start", () => {
    const project = cameraShotDemo(), [repair, roll] = project.scenes;
    const detail = repair.cameraShots!.find(shot => shot.start === 7.65)!;
    const time = 8.2, frames = sceneFramesAt(project, repair, time);
    const target = repair.elements.find(item => item.id === detail.targets[0])!, frame = frames.get(target.id)!;
    expect(frame.heldBy).toBeTruthy();
    const camera = stageCameraAt(project, repair, time, false, frames);
    const p = projectFocusPoint(repair, target, frame, camera, detail.offset);
    expect(p.x).toBeCloseTo(400);
    expect(p.y).toBeGreaterThanOrEqual(200);
    expect(p.y).toBeLessThan(400);
    const follow = roll.cameraShots!.find(shot => shot.style === "follow")!;
    expect(stageCameraAt(project, roll, 3.8).x - stageCameraAt(project, roll, 1.7).x).toBeGreaterThan(85);
    const fixed = { ...roll, cameraShots: [{ ...follow, follow: false }] };
    expect(stageCameraAt(project, fixed, 3.8)).toEqual(stageCameraAt(project, fixed, 1.7));
  });

  test("fits both subjects and offers a camera suggestion for the existing speaker", () => {
    const project = cameraShotDemo(), scene = project.scenes[0];
    const time = 1.9, frames = sceneFramesAt(project, scene, time);
    const pair = scene.cameraShots!.find(shot => shot.style === "pair")!, camera = stageCameraAt(project, scene, time);
    const people = pair.targets.map(id => projectFocusPoint(scene, scene.elements.find(item => item.id === id)!,
      frames.get(id)!, camera, pair.offset));
    expect(people).toHaveLength(2);
    expect(people.every(({ x, y }) => x > 50 && x < 750 && y > 50 && y < 395)).toBe(true);
    const legacy = { ...scene, cameraShots: undefined };
    const draft = newCameraShot(project, legacy, 0, scene.script!.lines[1].id);
    expect(draft.style).toBe("close");
    expect(draft.targets).toEqual(scene.cameraShots!.find(shot => shot.style === "close")!.targets);
    expect(shotPreset(legacy, draft, "pair").targets).toHaveLength(2);
  });

  test("keeps reviewed timing and fixed framing when references are changed or removed", () => {
    const project = cameraShotDemo(), scene = project.scenes[0];
    const detail = scene.cameraShots!.find(shot => shot.start === 7.65)!;
    expect(shotNeedsReview(scene, detail)).toBe(false);
    const edited = { ...scene, participation: scene.participation!.map(moment => ({ ...moment, thinkFor: moment.thinkFor + 0.2 })) };
    expect(shotNeedsReview(edited, detail)).toBe(true);
    expect(shotAt(edited, 7.65)?.id).toBe(detail.id);
    const deleted = cleanSceneReferences({ ...scene, elements: scene.elements.filter(item => item.id !== detail.targets[0]),
      participation: [] }, scene);
    const recovered = deleted.cameraShots!.find(shot => shot.id === detail.id)!;
    expect(recovered).toMatchObject({ start: detail.start, frame: detail.frame, targets: [], follow: false, missingTarget: true, missingLink: true });
    expect(recovered.cue).toBeUndefined();
    const close = scene.cameraShots!.find(shot => shot.lineId)!;
    const unlinked = withScript(scene, { ...scene.script!, lines: scene.script!.lines.filter(line => line.id !== close.lineId) });
    expect(unlinked.cameraShots!.find(shot => shot.id === close.id)).toMatchObject({ missingLink: true, lineId: undefined });
  });

  test("retimes and duplicates shots with their stable targets, script lines and events", () => {
    const project = cameraShotDemo(), scene = project.scenes[0];
    const resized = retimeScene(scene, scene.duration * 2);
    expect(shotIssue(resized.cameraShots, resized)).toBeUndefined();
    expect(resized.cameraShots!.map(shot => [shot.start, shot.end, shot.move]))
      .toEqual(scene.cameraShots!.map(shot => [shot.start * 2, shot.end * 2, shot.move * 2]));
    const copy = duplicateScript(duplicateAnimatedScene(scene), [], []);
    expect(shotIssue(copy.cameraShots, copy)).toBeUndefined();
    expect(copy.cameraShots!.map(shot => shot.id).some(id => scene.cameraShots!.some(shot => shot.id === id))).toBe(false);
    expect(copy.cameraShots!.find(shot => shot.lineId)?.lineId).toBe(copy.script!.lines[1].id);
    expect(copy.cameraShots!.find(shot => shot.cue?.anchor.kind === "participation")?.cue?.anchor.id).toBe(copy.participation![0].id);
    expect(copy.cameraShots!.find(shot => shot.cue?.anchor.kind === "change")?.cue?.anchor.id).toBe(copy.objectTracks![0].changes[0].id);
    expect(copy.cameraShots!.find(shot => shot.style === "detail")?.targets[0]).toBe(copy.elements.find(item => item.prop === "toy-wagon")?.id);
  });

  test("round trips optional shots in schema 4 JSON and episode packages, leaving old cameras intact", async () => {
    const legacy = validateProject(JSON.parse(JSON.stringify(transformExample("wagon")))), scene = legacy.scenes[0];
    expect(scene.cameraShots).toBeUndefined();
    expect([0, 0.101, 7, 13.99, 14].map(at => stageCameraAt(legacy, scene, at)))
      .toEqual([0, 0.101, 7, 13.99, 14].map(at => cameraAt(scene, at)));
    const project = cameraShotDemo();
    const json = await restoreProjectFile(new File([JSON.stringify(project)], "camera.json"));
    const complete = await restoreProjectFile(new File([await episodePackage(project)], "camera.ctepisode"));
    for (const restored of [json, complete]) {
      expect(restored.schemaVersion).toBe(4);
      expect(restored.scenes.map(item => item.cameraShots)).toEqual(project.scenes.map(item => item.cameraShots));
      expect(restored.audioClips).toEqual(project.audioClips);
      expect(restored.captions).toEqual(project.captions);
    }
  });
});
