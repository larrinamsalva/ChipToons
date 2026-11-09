import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldSceneVoiceSources } from "./framefield-voice-listenback";
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
  return projectFromFrameAssetShots([
    { prefix: a, assets: [image(a, 1), image(a, 2)] },
    { prefix: b, assets: [image(b, 1), image(b, 2)] },
  ], 2, [{ prefix: b, holdSeconds: 1 }, { prefix: a, holdSeconds: 0 }]);
}
describe("Read-only original voice source listen-back", () => {
  it("lists saved narration/dialogue assignments overlapping each reordered scene", () => {
    const p = example(), source = builtInSound("melody");
    p.audioAssets = [source];
    const first = newAudioClip(p, source, "narration", 0, 0);
    first.duration = 2;
    first.fadeOut = 0;
    const later = newAudioClip(p, source, "dialogue", 1, 0);
    later.duration = 1;
    later.fadeOut = 0;
    const music = newAudioClip(p, source, "music", 0, 0);
    p.audioClips = [later, music, first];
    const before = JSON.stringify(p);
    const at0 = framefieldSceneVoiceSources(p, 0);
    const at1 = framefieldSceneVoiceSources(p, 1);
    expect(at0).toHaveLength(1);
    expect(at0[0]).toMatchObject({
      clip: { id: first.id }, asset: { id: source.id },
      episodeStart: 0, episodeEnd: 2, audibleInMix: true,
    });
    expect(at1).toHaveLength(1);
    expect(at1[0]).toMatchObject({
      clip: { id: later.id }, episodeStart: 3, episodeEnd: 4,
    });
    expect(JSON.stringify(p)).toBe(before);
  });
  it("keeps muted cross-scene clips available but does not call them audible", () => {
    const p = example(), source = builtInSound("melody");
    p.audioAssets = [source];
    const clip = newAudioClip(p, source, "narration", 0, 0);
    clip.start = 2.5;
    clip.duration = 1.2;
    clip.fadeOut = 0;
    p.audioClips = [clip];
    expect(framefieldSceneVoiceSources(p, 0)).toHaveLength(1);
    expect(framefieldSceneVoiceSources(p, 1)).toHaveLength(1);
    clip.muted = true;
    expect(framefieldSceneVoiceSources(p, 1)[0].audibleInMix).toBe(false);
    clip.muted = false;
    p.mixer.voice = 0;
    expect(framefieldSceneVoiceSources(p, 0)[0].audibleInMix).toBe(false);
    p.mixer.voice = 1;
    clip.volume = 0;
    expect(framefieldSceneVoiceSources(p, 0)[0].audibleInMix).toBe(false);
    p.mixer.muted = true;
    expect(framefieldSceneVoiceSources(p, 0)[0].audibleInMix).toBe(false);
  });
  it("rejects unrelated projects and invalid scene positions", () => {
    const p = example();
    expect(() => framefieldSceneVoiceSources(p, -1)).toThrow(/out of range/);
    expect(() => framefieldSceneVoiceSources(p, 2)).toThrow(/out of range/);
    expect(() => framefieldSceneVoiceSources(starterProject("kindness"), 0))
      .toThrow(/imported PNG storyboards/);
  });
});
