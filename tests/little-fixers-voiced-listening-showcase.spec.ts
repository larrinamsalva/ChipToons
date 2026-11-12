import { test, expect } from "@playwright/test";
import { cinematicConversationListeningAt } from "../src/cinematic-conversation-listening";
import { cinematicFaceAt } from "../src/cinematic-face";
import { sceneElementAt, sceneFramesAt } from "../src/timeline";
import { mouthTrackIsCurrent } from "../src/voice-mouth";
import { backup, saved } from "./production-helpers";

const TITLE =
  "Little Fixers Club — Scout Speaks, Helper Jo Listens (34-second voiced cartoon)";

test("public 34-second Scout and Jo cartoon shows real approved voice-paced listening", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  await page.getByRole("button", {
    name: "Watch Helper Jo listen to Scout (0:34)", exact: true,
  }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true }))
    .toBeVisible({ timeout: 55_000 });
  await saved(page);
  const { data } = await backup(page);
  expect(data.title).toBe(TITLE);
  expect(data.visualStyle).toBe("storybook-cinematic");
  expect(data.scenes).toHaveLength(1);
  expect(data.scenes[0].duration).toBe(34);
  expect(data.characters).toHaveLength(2);
  expect(data.assets).toHaveLength(0); // original vector puppets, no image cutouts
  const scene = data.scenes[0];
  const scout = scene.elements.find(item =>
    item.characterId === data.characters[0].id)!;
  const jo = scene.elements.find(item =>
    item.characterId === data.characters[1].id)!;
  expect(data.characters[0].puppet?.costume).toBe("workshop");
  expect(data.characters[1].puppet?.costume).toBe("workshop");
  expect(data.characters[1].name).toMatch(/Helper Jo/);
  expect(jo.animation?.keyframes).toHaveLength(3);
  expect(jo.animation?.keyframes.every(key => !key.joints?.head)).toBe(true);
  expect(jo.voiceMouth).toBeUndefined(); // Jo is listening, not falsely speaking
  expect(scout.voiceMouth).toHaveLength(3);
  expect(scene.script?.lines).toHaveLength(3);
  expect(data.audioClips.filter(clip => clip.category === "dialogue"))
    .toHaveLength(3);
  expect(data.audioAssets).toHaveLength(6);
  expect(data.captions.length).toBeGreaterThanOrEqual(3);
  for (const track of scout.voiceMouth!) {
    expect(mouthTrackIsCurrent(data, scene, scout, track)).toBe(true);
    expect(data.audioClips.some(clip =>
      clip.id === track.clipId && clip.assetId === track.sourceId)).toBe(true);
  }

  const found = Array.from({ length: 425 }, (_, i) => i * .08)
    .flatMap(time => {
      const frames = sceneFramesAt(data, scene, time);
      const cue = cinematicConversationListeningAt(
        data, scene, jo, frames, time, false,
      );
      return cue && cue.focus > .35 ? [{time, frames, cue}] : [];
    });
  expect(found.length).toBeGreaterThan(5);
  const selected = found.find(result =>
    Math.abs(result.cue.headTilt) > .2);
  expect(selected).toBeDefined();
  const {time,frames,cue} = selected!;
  expect(cue.speakerId).toBe(scout.id);
  expect(cue.dx).toBeLessThan(0);
  expect(frames.get(scout.id)?.voiceOpening).toBeGreaterThan(0);
  const base = sceneElementAt(data, scene, jo, time, 0);
  expect((frames.get(jo.id)?.joints?.head?.angle ?? 0) -
    (base.joints?.head?.angle ?? 0)).toBeCloseTo(cue.headTilt);
  const face = cinematicFaceAt(
    data, scene, jo, frames.get(jo.id)!, frames, time, false,
  )!;
  expect(face.x).toBeLessThan(-.5);
  expect(sceneFramesAt(data, scene, time).get(jo.id)).toEqual(frames.get(jo.id));
  expect(cinematicConversationListeningAt(data, scene, jo, frames, time, true))
    .toBeUndefined();
  expect((await backup(page)).data).toEqual(data); // render pass does not edit project

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Continue " + TITLE }).click();
  await expect(page.getByRole("heading", { name: TITLE, exact: true })).toBeVisible();
  expect((await backup(page)).data.scenes[0].elements).toHaveLength(scene.elements.length);
});
