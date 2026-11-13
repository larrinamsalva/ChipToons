import { expect, test } from "@playwright/test";
import { shotAt, shotIssue } from "../src/camera-shots";
import { cinematicConversationListeningAt } from "../src/cinematic-conversation-listening";
import { cinematicSpeakingEyelineAt } from "../src/cinematic-conversation-speaking";
import { cinematicFaceAt } from "../src/cinematic-face";
import { projectFocusPoint } from "../src/focus-motion";
import { sceneFramesAt, stageCameraAt } from "../src/timeline";
import { mouthTrackIsCurrent } from "../src/voice-mouth";
import { backup, saved } from "./production-helpers";

const TITLE =
  "Little Fixers Club — Scout & Jo's Cinematic Conversation (34-second voiced cartoon)";

test("public Scout and Jo cartoon cuts camera on the three real original voice takes", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch cinematic Scout and Jo camera cuts (0:34)", exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
  await saved(page);
  const { data } = await backup(page);
  const [scene] = data.scenes;
  const shots = scene.cameraShots!;
  const [scout, jo] = scene.elements.filter(e => !!e.characterId);
  expect(data.title).toBe(TITLE);
  expect(data.visualStyle).toBe("storybook-cinematic");
  expect(data.scenes).toHaveLength(1);
  expect(scene.duration).toBe(34);
  expect(data.characters).toHaveLength(2);
  expect(data.assets).toHaveLength(0);
  expect(jo.voiceMouth).toBeUndefined();
  expect(scout.voiceMouth).toHaveLength(3);
  expect(data.audioClips.filter(clip => clip.category === "dialogue")).toHaveLength(3);
  expect(data.audioAssets).toHaveLength(6);
  expect(data.captions.length).toBeGreaterThanOrEqual(3);
  expect(shots).toHaveLength(9);
  expect(shotIssue(shots, scene)).toBeUndefined();
  expect(shots.map(s => s.style)).toEqual([
    "pair","close","pair","close","reaction","pair","close","reaction","wide",
  ]);
  expect(shots[0].start).toBe(0);
  expect(shots.at(-1)!.end).toBe(34);
  expect(shots[0].move).toBe(0);
  // True editable Stage-camera movement on all eight succeeding shots.
  // The camera should be continuous at the cut, halfway eased, then
  // settled on the new composition without moving any voice clip or actor.
  for (const shot of shots.slice(1)) {
    expect(shot.move).toBeGreaterThanOrEqual(.4);
    expect(shot.move).toBeLessThanOrEqual(.82);
    const before = stageCameraAt(data, scene, shot.start - .000001);
    const start = stageCameraAt(data, scene, shot.start);
    const midway = stageCameraAt(data, scene, shot.start + shot.move / 2);
    const settled = stageCameraAt(data, scene, shot.start + shot.move);
    expect(start.shotId).toBe(shot.id);
    expect(midway.shotId).toBe(shot.id);
    expect(settled.shotId).toBe(shot.id);
    for (const key of ["x", "y", "zoom"] as const) {
      expect(start[key]).toBeCloseTo(before[key], 3);
      expect(midway[key]).toBeCloseTo((start[key] + settled[key]) / 2, 3);
      expect(Number.isFinite(settled[key])).toBe(true);
    }
    expect(stageCameraAt(data, scene, shot.start + shot.move / 2))
      .toEqual(midway);
  }
  expect(new Set(shots.map(shot => shot.id)).size).toBe(shots.length);
  for (const [i, shot] of shots.entries()) {
    expect(shot.end).toBeGreaterThan(shot.start);
    if (i) expect(shot.start).toBeCloseTo(shots[i-1].end, 7);
    const mid = (shot.start + shot.end) / 2;
    expect(shotAt(scene, mid)?.id).toBe(shot.id);
    const frames = sceneFramesAt(data, scene, mid);
    const camera = stageCameraAt(data, scene, mid, false, frames);
    expect(camera.shotId).toBe(shot.id);
    expect(camera.zoom).toBeGreaterThanOrEqual(1);
    expect(camera.zoom).toBeLessThanOrEqual(3);
    for (const id of shot.targets) {
      const element = scene.elements.find(item => item.id === id)!;
      const frame = frames.get(id)!;
      const pos = projectFocusPoint(scene, element, frame, camera, shot.offset);
      expect(pos.x).toBeGreaterThan(20);
      expect(pos.x).toBeLessThan(780);
      expect(pos.y).toBeGreaterThan(20);
      expect(pos.y).toBeLessThan(430);
    }
    expect(stageCameraAt(data, scene, mid, false, frames)).toEqual(camera);
  }
  const originalStarts = scout.voiceMouth!.map(track => {
    expect(mouthTrackIsCurrent(data, scene, scout, track)).toBe(true);
    const clip = data.audioClips.find(c => c.id === track.clipId)!;
    expect(clip.assetId).toBe(track.sourceId);
    return clip.start;
  });
  expect(originalStarts).toHaveLength(3);
  for (const [i, shot] of [shots[1],shots[3],shots[6]].entries()) {
    expect(shot.style).toBe("close");
    expect(shot.targets).toEqual([scout.id]);
    expect(shot.start).toBeCloseTo(originalStarts[i], 4);
    expect(shot.lineId).toBe(scene.script?.lines[i].id);
    expect(stageCameraAt(data,scene,shot.start+.2).shotId).toBe(shot.id);
  }
  expect(shots[4].targets).toEqual([jo.id]);
  expect(shots[7].targets).toEqual([jo.id]);
  expect(shots[8].targets).toEqual([]);

  // Real, deterministic visual eyelines: place Scout on the left with
  // look room toward Jo, and Jo on the right looking back toward Scout.
  // This is a real Stage camera property, not a changed character pose.
  for (const index of [1, 3, 6]) {
    const shot = shots[index];
    expect(shot.placement).toBe("left");
    const t = shot.start + shot.move + .12;
    const frames = sceneFramesAt(data, scene, t);
    const camera = stageCameraAt(data, scene, t, false, frames);
    const point = projectFocusPoint(scene, scout,
      frames.get(scout.id)!, camera, shot.offset);
    expect(point.x).toBeGreaterThan(225);
    expect(point.x).toBeLessThan(370);
    expect(stageCameraAt(data, scene, t, false, frames)).toEqual(camera);
  }
  for (const index of [4, 7]) {
    const shot = shots[index];
    expect(shot.placement).toBe("right");
    const t = shot.start + shot.move + .12;
    const frames = sceneFramesAt(data, scene, t);
    const camera = stageCameraAt(data, scene, t, false, frames);
    const point = projectFocusPoint(scene, jo,
      frames.get(jo.id)!, camera, shot.offset);
    expect(point.x).toBeGreaterThan(430);
    expect(point.x).toBeLessThan(575);
    expect(stageCameraAt(data, scene, t, false, frames)).toEqual(camera);
  }
  expect([shots[0], shots[2], shots[5], shots[8]]
    .every(shot => shot.placement === "center")).toBe(true);
  // PR #105: the actual saved character and the actual Stage/export frame
  // keep Jo attending to Scout during both genuine SILENT reaction shots.
  for (const index of [1, 3, 6]) {
    const shot = shots[index];
    const time = shot.start + 1.45;
    const frames = sceneFramesAt(data, scene, time);
    const cue = cinematicSpeakingEyelineAt(data, scene, scout, frames, time, false);
    expect(cue?.partnerId).toBe(jo.id);
    expect(cue?.dx).toBeGreaterThan(0);
    expect(cue?.focus).toBeGreaterThan(.75);
    const face = cinematicFaceAt(data, scene, scout,
      frames.get(scout.id)!, frames, time, false);
    expect(face?.x).toBeGreaterThan(1);
  }
  for (const index of [4, 7]) {
    const shot = shots[index];
    const time = (shot.start + shot.end) / 2;
    const frames = sceneFramesAt(data, scene, time);
    const cue = cinematicConversationListeningAt(data, scene, jo, frames, time, false);
    expect(cue?.speakerId).toBe(scout.id);
    expect(cue?.reaction).toBeGreaterThan(.7);
    expect(cue?.dx).toBeLessThan(0);
    const gaze = cinematicFaceAt(data, scene, jo, frames.get(jo.id)!, frames, time, false);
    expect(gaze?.x).toBeLessThan(-1);
    expect(gaze?.squint).toBeGreaterThan(.08);
    expect(cinematicConversationListeningAt(data, scene, jo, frames, time, true))
      .toBeUndefined();
  }
  expect((await backup(page)).data).toEqual(data);

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Continue " + TITLE }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible();
  expect((await backup(page)).data.scenes[0].cameraShots).toEqual(shots);
});
