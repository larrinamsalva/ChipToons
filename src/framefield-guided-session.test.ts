import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldGuidedSession } from "./framefield-guided-session";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { starterProject } from "./demo-starter";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const image = (prefix: string, n: number): Asset => ({
  id: prefix + n, name: prefix + n + ".png", type: "image",
  mime: "image/png", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
function example() {
  const a = "shot01_frame_", b = "shot02_frame_";
  const p = projectFromFrameAssetShots([
    { prefix: a, assets: [image(a, 1), image(a, 2)] },
    { prefix: b, assets: [image(b, 1), image(b, 2)] },
  ], 2, [{ prefix: b, holdSeconds: 1 }, { prefix: a, holdSeconds: 0 }], [
    { prefix: a, title: "Scout", action: "", narration: "Check the bike." },
    { prefix: b, title: "Jo", action: "", narration: "We can fix it." },
  ]);
  p.captions = [
    { id: "jo", sceneId: p.scenes[0].id, start: 0, end: 1, text: "We can fix it." },
    { id: "scout", sceneId: p.scenes[1].id, start: 0, end: 2, text: "Check the bike." },
  ];
  return p;
}

describe("Framefield guided scene rehearsal", () => {
  it("reads true ordered scene times and written words without modifying the cartoon", () => {
    const p = example(), before = JSON.stringify(p);
    const steps = framefieldGuidedSession(p);
    expect(steps.scenes.map(s => [s.title, s.episodeStart, s.episodeEnd]))
      .toEqual([["Jo", 0, 3], ["Scout", 3, 5]]);
    expect(steps.scenes[0].narration).toBe("We can fix it.");
    expect(steps.scenes[1].cues[0].episodeStart).toBe(3);
    expect(steps.scenesNeedingVoice).toBe(2);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("only counts assigned audible voice intervals, not music or muted clips", () => {
    const p = example(), sound = builtInSound("melody");
    p.audioAssets = [sound];
    const clip = newAudioClip(p, sound, "narration", 0, 0);
    clip.duration = 0.8;
    clip.fadeOut = 0;
    p.audioClips = [clip, newAudioClip(p, sound, "music", 1, 0)];
    expect(framefieldGuidedSession(p).scenesWithAssignedVoice).toBe(1);
    expect(framefieldGuidedSession(p).scenes[0].cues[0].overlapsVoice).toBe(true);
    clip.muted = true;
    expect(framefieldGuidedSession(p).scenesWithAssignedVoice).toBe(0);
  });
  it("is not shown for unrelated cartoons", () => {
    expect(() => framefieldGuidedSession(starterProject("kindness")))
      .toThrow(/imported PNG storyboards/);
  });
});
