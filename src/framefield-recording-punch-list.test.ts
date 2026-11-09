import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldRecordingPunchList } from "./framefield-recording-punch-list";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { starterProject } from "./demo-starter";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const image = (prefix: string, n: number): Asset => ({
  id: `${prefix}-${n}`, name: `${prefix}${n}.png`, type: "image",
  mime: "image/png", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
function project() {
  const a = "shot01_frame_", b = "shot02_frame_";
  const p = projectFromFrameAssetShots([
    { prefix: a, assets: [image(a, 1), image(a, 2)] },
    { prefix: b, assets: [image(b, 1), image(b, 2)] },
  ], 2, [{ prefix: b, holdSeconds: 1 }, { prefix: a, holdSeconds: 0 }], [
    { prefix: a, title: "Scout checks a tire", action: "", narration: "Look before you ride." },
    { prefix: b, title: "Jo helps", action: "", narration: "Let's fix this bike.\nPlease be careful." },
  ]);
  p.captions = [
    { id: "jo-one", sceneId: p.scenes[0].id, start: 0, end: 1.2, text: "Jo checks." },
    { id: "jo-two", sceneId: p.scenes[0].id, start: 1.2, end: 3, text: "Jo shows how." },
    { id: "scout", sceneId: p.scenes[1].id, start: 0, end: 2, text: "Look before you ride." },
  ];
  return p;
}

describe("Read-only time-coded recording punch list", () => {
  it("lists ordered real scene times, genuine caption words and missing recordings", () => {
    const p = project();
    const before = JSON.stringify(p);
    const text = framefieldRecordingPunchList(p);
    expect(text).toContain("SCENE 1 — Jo helps\nEpisode time: 0.00s to 3.00s");
    expect(text).toContain("SCENE 2 — Scout checks a tire\nEpisode time: 3.00s to 5.00s");
    expect(text).toContain("Written narration: Let's fix this bike. Please be careful.");
    expect(text).toContain("CAPTION 0.00s–1.20s: Jo checks.");
    expect(text).toContain("CAPTION 1.20s–3.00s: Jo shows how.");
    expect(text).toContain("CAPTION 3.00s–5.00s: Look before you ride.");
    expect(text).toContain("Captions: 3 | Captions without overlapping assigned voice: 3");
    expect(text).toContain("TO DO: Record or assign actual narration/dialogue");
    expect(text).toContain("No assigned voice clip overlaps");
    expect(text.indexOf("SCENE 1")).toBeLessThan(text.indexOf("SCENE 2"));
    expect(JSON.stringify(p)).toBe(before);
  });

  it("distinguishes voice time-window overlaps from proven speech, and never counts music", () => {
    const p = project(), source = builtInSound("melody");
    p.audioAssets = [source];
    const clip = newAudioClip(p, source, "narration", 0, 0);
    clip.duration = 0.8;
    clip.fadeOut = 0;
    p.audioClips = [clip];
    let text = framefieldRecordingPunchList(p);
    expect(text).toContain("Scenes with assigned voice intervals: 1");
    expect(text).toContain("An assigned voice clip overlaps. Listen to confirm");
    expect(text).toContain("Captions: 3 | Captions without overlapping assigned voice: 2");
    const music = newAudioClip(p, source, "music", 1, 0);
    p.audioClips.push(music);
    expect(framefieldRecordingPunchList(p)).toContain("Scenes with assigned voice intervals: 1");
    clip.muted = true;
    text = framefieldRecordingPunchList(p);
    expect(text).toContain("Scenes with assigned voice intervals: 0");
    expect(text).not.toContain("An assigned voice clip overlaps.");
  });

  it("lists missing captions independently and never operates on unrelated cartoons", () => {
    const p = project();
    p.captions = [];
    const text = framefieldRecordingPunchList(p);
    expect(text).toContain("TO DO: Add and review scene captions");
    expect(text).toContain("Timed captions: 0");
    expect(() => framefieldRecordingPunchList(starterProject("kindness")))
      .toThrow(/imported PNG storyboards/);
  });
});
