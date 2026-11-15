import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { episodeVoiceOriginalSummary } from "./episode-voice-original-summary";

describe("PR #130 whole-episode voice originals inventory", () => {
  it("counts active unique voice clips only once across scene boundaries, not music or muted clips", () => {
    const project = cameraShotDemo();
    const sound = builtInSound("melody");
    project.audioAssets.push(sound);
    const first = newAudioClip(project, sound, "dialogue", 0, 0);
    const second = newAudioClip(project, sound, "narration", 0, project.scenes[0].duration - .4);
    const muted = newAudioClip(project, sound, "dialogue", 0, 2);
    const music = newAudioClip(project, sound, "music", 0, 2);
    project.audioClips.push(
      { ...first, duration: 1 },
      { ...second, duration: .8 },
      { ...muted, duration: 1, muted: true },
      { ...music, duration: 2 },
    );
    const original = JSON.stringify(project);
    expect(episodeVoiceOriginalSummary(project, new Set(), true, false))
      .toEqual({ total: 2, indexed: 2, missing: 0, unverified: 0, issues: [] });
    expect(JSON.stringify(project)).toBe(original);
  });

  it("distinguishes unavailable and unverified local originals, and never claims decoded speech", () => {
    const project = cameraShotDemo();
    const embedded = builtInSound("melody");
    const local = builtInSound("melody");
    local.id = "file-backed-original";
    local.dataUrl = "";
    local.file = { key: "local-audio", sha256: "a".repeat(64), size: 100 };
    project.audioAssets.push(embedded, local);
    const a = newAudioClip(project, embedded, "dialogue", 0, 1);
    const b = newAudioClip(project, local, "narration", 0, 2);
    project.audioClips.push(a, b);
    const snapshot = JSON.stringify(project);
    const pending = episodeVoiceOriginalSummary(project, new Set(), false, false);
    expect(pending).toMatchObject({ total: 2, indexed: 1, missing: 0, unverified: 1 });
    expect(pending.issues[0]).toMatchObject({
      clipId: b.id, sceneIndex: 0, status: "unverified",
    });
    const absent = episodeVoiceOriginalSummary(project, new Set([local.id]), true, false);
    expect(absent).toMatchObject({ total: 2, indexed: 1, missing: 1, unverified: 0 });
    expect(absent.issues[0].detail).toContain("Original audio missing");
    const failed = episodeVoiceOriginalSummary(project, new Set(), false, true);
    expect(failed.unverified).toBe(1);
    const found = episodeVoiceOriginalSummary(project, new Set(), true, false);
    expect(found).toMatchObject({ total: 2, indexed: 2, missing: 0, unverified: 0, issues: [] });
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("handles no voice clips without inventing a missing recording", () => {
    const project = cameraShotDemo();
    project.audioClips = [];
    expect(episodeVoiceOriginalSummary(project, new Set(), true, false))
      .toEqual({ total: 0, indexed: 0, missing: 0, unverified: 0, issues: [] });
  });
});
