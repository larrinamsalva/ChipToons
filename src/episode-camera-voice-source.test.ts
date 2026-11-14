import { describe, expect, it } from "vitest";
import { cameraVoiceSourceStatus } from "./episode-camera-voice-source";
import { cameraShotDemo } from "./camera-shot-demo";
import { newAudioClip } from "./production";
import { builtInSound } from "./sounds";

function assignedVoice() {
  const project = cameraShotDemo();
  const source = builtInSound("melody");
  const clip = newAudioClip(project, source, "dialogue", 0, 2.2);
  project.audioAssets.push(source);
  project.audioClips.push(clip);
  return { project, source, clip };
}

describe("PR #120 accurate local source status for inspected voice cues", () => {
  it("identifies an assigned embedded source without claiming the recording is speech", () => {
    const { project, source, clip } = assignedVoice();
    const before = JSON.stringify(project);
    const status = cameraVoiceSourceStatus(project, clip.id, new Set(), true, false);
    expect(status).toEqual({
      soundReady: true,
      text: `Embedded audio source: ${source.name}. Listen to verify its contents.`,
    });
    expect(JSON.stringify(project)).toBe(before);
  });

  it("does not prepare sound while an external source is checking, absent, or unverified", () => {
    const { project, source, clip } = assignedVoice();
    source.dataUrl = "";
    source.file = { key: "voice-test", sha256: "a".repeat(64), size: 100 };
    const check = (missing: string[] = [], checked = true, failed = false) =>
      cameraVoiceSourceStatus(project, clip.id, new Set(missing), checked, failed);
    expect(check([], false).soundReady).toBe(false);
    expect(check([], false).text).toContain("Checking local audio source");
    expect(check([source.id]).soundReady).toBe(false);
    expect(check([source.id]).text).toContain("Original audio missing on this device");
    expect(check([], true, true).soundReady).toBe(false);
    expect(check([], true, true).text).toContain("not verified");
    expect(check().soundReady).toBe(true);
    expect(check().text).toContain("Local audio entry found");
    expect(check().text).toContain("Listen to verify");
  });

  it("does not offer sound for broken assignments or empty embedded bytes", () => {
    const { project, source, clip } = assignedVoice();
    expect(cameraVoiceSourceStatus(project, "missing-clip", new Set(), true, false))
      .toMatchObject({ soundReady: false });
    project.audioAssets = [];
    expect(cameraVoiceSourceStatus(project, clip.id, new Set(), true, false).text)
      .toContain("missing from this project");
    project.audioAssets = [source];
    source.dataUrl = "";
    expect(cameraVoiceSourceStatus(project, clip.id, new Set(), true, false))
      .toMatchObject({ soundReady: false });
  });
});
