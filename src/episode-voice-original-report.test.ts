import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { episodeVoiceOriginalReport } from "./episode-voice-original-report";

describe("PR #131 complete originals checklist", () => {
  it("deduplicates cross-scene recordings and leaves the cartoon unchanged", () => {
    const project = cameraShotDemo();
    const audio = builtInSound("melody");
    project.audioAssets.push(audio);
    const first = newAudioClip(project, audio, "dialogue", 0, 1);
    const crossing = newAudioClip(project, audio, "narration", 0, project.scenes[0].duration - .3);
    const muted = newAudioClip(project, audio, "dialogue", 0, 2);
    project.audioClips.push(
      { ...first, duration: 1 }, { ...crossing, duration: 1 },
      { ...muted, duration: 1, muted: true },
    );
    const snapshot = JSON.stringify(project);
    const report = episodeVoiceOriginalReport(project, new Set(), true, false);
    expect(report).toContain("UNIQUE VOICE CLIPS — 2");
    expect(report).toContain("Indexed original sources: 2 | Missing: 0 | Unverified: 0");
    expect(report.match(/\[ \] INDEXED \| Scene /g)).toHaveLength(2);
    expect(report).toContain("first visible scene interval 00:00:01.00–00:00:02.00");
    expect(report).toContain("Indexed does not mean decoded");
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("lists all seven missing clips, beyond the five shown in the on-screen preview", () => {
    const project = cameraShotDemo();
    const audio = builtInSound("melody");
    audio.dataUrl = "";
    project.audioAssets.push(audio);
    for (let i = 0; i < 7; i++) {
      const clip = newAudioClip(project, audio, "dialogue", 0, i + 1);
      project.audioClips.push({ ...clip, duration: .25 });
    }
    const report = episodeVoiceOriginalReport(project, new Set(), true, false);
    expect(report).toContain("UNIQUE VOICE CLIPS — 7");
    expect(report).toContain("Indexed original sources: 0 | Missing: 7 | Unverified: 0");
    expect(report.match(/\[ \] MISSING \| Scene /g)).toHaveLength(7);
  });

  it("separates a pending source check from a missing original and handles no clips", () => {
    const project = cameraShotDemo();
    const audio = builtInSound("melody");
    audio.dataUrl = "";
    audio.file = { key: "original", sha256: "a".repeat(64), size: 100 };
    project.audioAssets.push(audio);
    project.audioClips.push(newAudioClip(project, audio, "narration", 0, 1));
    const pending = episodeVoiceOriginalReport(project, new Set(), false, false);
    expect(pending).toContain("Indexed original sources: 0 | Missing: 0 | Unverified: 1");
    expect(pending).toContain("[ ] UNVERIFIED");
    const absent = episodeVoiceOriginalReport(project, new Set([audio.id]), true, false);
    expect(absent).toContain("Indexed original sources: 0 | Missing: 1 | Unverified: 0");
    expect(absent).toContain("[ ] MISSING");
    project.audioClips = [];
    expect(episodeVoiceOriginalReport(project, new Set(), true, false))
      .toContain("No assigned, unmuted dialogue or narration clips intersect this episode");
  });
});
