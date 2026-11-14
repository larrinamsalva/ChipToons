import { describe, expect, it } from "vitest";
import { episodeCameraSummary } from "./episode-camera-review";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";

describe("PR #113 saved whole-episode camera overview", () => {
  it("counts custom camera seconds by scene, leaving default camera coverage informational", () => {
    const project = cameraShotDemo();
    const [a, b] = project.scenes;
    a.duration = 20;
    b.duration = 10;
    a.cameraShots = a.cameraShots!.slice(0, 2);
    b.cameraShots = undefined;
    const snapshot = JSON.stringify(project);
    const summary = episodeCameraSummary(project);
    expect(summary.seconds).toBe(30);
    expect(summary.customSeconds).toBeCloseTo(1.8);
    expect(summary.percent).toBe(6);
    // The duration is derived from floating-point shot intervals;
    // compare seconds with tolerance, not exact object equality.
    expect(summary.scenes[0].customSeconds).toBeCloseTo(1.8);
    expect(summary.scenes[0]).toMatchObject({
      sceneIndex: 0, seconds: 20,
      shotCount: 2, gapCount: 1, voiceStarts: 0,
    });
    expect(summary.scenes[1]).toMatchObject({
      sceneIndex: 1, seconds: 10, customSeconds: 0,
      shotCount: 0, gapCount: 1,
    });
    expect(episodeCameraSummary(project)).toEqual(summary);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("counts recorded voice starts on default views separately from custom shots", () => {
    const project = cameraShotDemo();
    const [first, second] = project.scenes;
    first.cameraShots = [first.cameraShots![0]];
    second.cameraShots = undefined;
    const audio = builtInSound("melody");
    project.audioAssets.push(audio);
    const active = newAudioClip(project, audio, "dialogue", 0, 2.2);
    const covered = newAudioClip(project, audio, "narration", 0, .6);
    const later = newAudioClip(project, audio, "dialogue", 1, .2);
    const muted = newAudioClip(project, audio, "dialogue", 0, 3.5);
    project.audioClips.push(
      { ...active, duration: 1 },
      { ...covered, duration: 1 },
      { ...later, duration: 1 },
      { ...muted, muted: true },
    );
    const report = episodeCameraSummary(project);
    expect(report.scenes[0]).toMatchObject({
      voiceStarts: 2, defaultVoiceStarts: 1,
    });
    expect(report.scenes[1]).toMatchObject({
      voiceStarts: 1, defaultVoiceStarts: 1,
    });
  });

  it("handles no scenes and full coverage safely", () => {
    const project = cameraShotDemo();
    const empty = episodeCameraSummary({ ...project, scenes: [] });
    expect(empty).toEqual({
      scenes: [], seconds: 0, customSeconds: 0, percent: 0,
    });
    expect(episodeCameraSummary(project).percent).toBe(100);
    expect(episodeCameraSummary(project).scenes.every(scene =>
      scene.gapCount === 0)).toBe(true);
  });
});
