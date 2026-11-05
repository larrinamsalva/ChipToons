import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { LITTLE_FIXERS_EPISODE_TITLE } from "../src/little-fixers-opening-script";
import { participationWarnings } from "../src/participation-studio";
import { planSegments } from "../src/segments";
import { lineStatus } from "../src/script";
import { sceneFramesAt } from "../src/timeline";
import { backup, openLittleFixersOpening, restore, saved } from "./production-helpers";

test("opens and saves the editable Little Fixers episode opening with original artwork and approved takes", async ({ page }, info) => {
  test.setTimeout(85_000);
  await openLittleFixersOpening(page);
  await saved(page);
  const { data } = await backup(page);
  expect(data.title).toBe(LITTLE_FIXERS_EPISODE_TITLE);
  expect(data.targetAge).toBe("4–7");
  expect(data.scenes.map(scene => scene.duration)).toEqual([15, 15, 15, 15, 8, 17, 18, 16]);
  expect(planSegments(data, 60).segments.map(segment => segment.duration)).toEqual([60, 59]);
  expect(data.scenes[4].storyCard?.eyebrow).toBe("Little Fixers Club · Episode 1");

  const original = data.assets.find(asset => asset.id === data.pictureSourceId)!;
  const bundledPoster = await readFile(new URL("../public/examples/little-fixers.png", import.meta.url));
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  expect(sha(Buffer.from(original.dataUrl.split(",")[1], "base64"))).toBe(sha(bundledPoster));
  expect(data.characters).toHaveLength(1);
  const host = data.characters[0];
  expect(host.puppet?.parts.map(part => part.role)).toEqual(["torso", "rightArm", "head", "eyes", "mouth"]);
  const first = data.scenes[0];
  const actor = first.elements.find(element => element.characterId === host.id)!;
  expect(actor.animation?.keyframes.some(key => key.emotion === "surprised")).toBe(true);
  expect(actor.voiceMouth).toHaveLength(3);
  const speaking = Array.from({ length: 20 }, (_, i) => 0.65 + i * 0.05)
    .some(at => (sceneFramesAt(data, first, at).get(actor.id)?.voiceOpening ?? 0) > 0.18);
  expect(speaking).toBe(true);
  const lines = data.scenes.flatMap(scene => scene.script?.lines ?? []);
  expect(lines).toHaveLength(17);
  expect(data.captions).toHaveLength(lines.length);
  for (const line of lines) expect(lineStatus(data, line)).toBe("Approved");
  expect(participationWarnings(data, data.scenes[6], data.scenes[6].participation![0])).toEqual([]);

  await page.getByRole("button", { name: "Save and return to my cartoons" }).click();
  const projects = page.getByRole("button", { name: `Continue ${LITTLE_FIXERS_EPISODE_TITLE}`, exact: true });
  await expect(projects).toBeVisible();
  if (info.project.name === "desktop") {
    await restore(page, { ...data, id: "little-fixers-opening-portable-copy" });
    await saved(page);
    const reopened = (await backup(page)).data;
    expect(reopened.scenes).toEqual(data.scenes);
    expect(reopened.audioClips).toEqual(data.audioClips);
    expect(reopened.captions).toEqual(data.captions);
    expect(reopened.pictureSourceId).toBe(data.pictureSourceId);
  }
});
