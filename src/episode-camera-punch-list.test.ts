import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { episodeCameraPunchList, cameraReviewTimecode } from "./episode-camera-punch-list";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";

describe("PR #115 downloadable camera worksheet", () => {
  it("uses real scene and episode times from saved shots without altering the cartoon", () => {
    const project = cameraShotDemo();
    const [first, second] = project.scenes;
    first.duration = 20;
    second.duration = 10;
    first.cameraShots = first.cameraShots!.slice(0, 2);
    second.cameraShots = undefined;
    const before = JSON.stringify(project);
    const text = episodeCameraPunchList(project);
    expect(text).toContain("CHIPTOONS — WHOLE-EPISODE CAMERA REVIEW CHECKLIST");
    expect(text).toContain("Scenes: 2 | Custom camera: 6% (1.80s of 30.00s)");
    expect(text).toContain("SCENE 1 — " + first.title);
    expect(text).toContain("Episode time: 00:00:00.00 to 00:00:20.00");
    expect(text).toContain("DEFAULT CAMERA scene 00:00:01.80–00:00:20.00 | episode 00:00:01.80–00:00:20.00");
    expect(text).toContain("SCENE 2 — " + second.title);
    expect(text).toContain("Episode time: 00:00:20.00 to 00:00:30.00");
    expect(text).toContain("DEFAULT CAMERA scene 00:00:00.00–00:00:10.00 | episode 00:00:20.00–00:00:30.00");
    expect(episodeCameraPunchList(project)).toBe(text);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("identifies actual assigned voice starts and excludes muted/background clips", () => {
    const project = cameraShotDemo();
    const [first, second] = project.scenes;
    first.duration = 20;
    first.cameraShots = [first.cameraShots![0]];
    second.cameraShots = undefined;
    const sound = builtInSound("melody");
    project.audioAssets.push(sound);
    const covered = newAudioClip(project, sound, "dialogue", 0, .6);
    const uncovered = newAudioClip(project, sound, "dialogue", 0, 2.2);
    const later = newAudioClip(project, sound, "narration", 1, .2);
    const music = newAudioClip(project, sound, "music", 0, 3);
    const muted = newAudioClip(project, sound, "dialogue", 0, 3);
    project.audioClips = [covered, uncovered, later, music, { ...muted, muted: true }];
    const text = episodeCameraPunchList(project);
    expect(text).toContain("DIALOGUE START scene 00:00:00.60 | episode 00:00:00.60 | custom camera shot");
    expect(text).toContain("DIALOGUE START scene 00:00:02.20 | episode 00:00:02.20 | default camera");
    expect(text).toContain(`NARRATION START scene 00:00:00.20 | episode ${cameraReviewTimecode(20.2)} | default camera`);
    expect(text.match(/DIALOGUE START/g)).toHaveLength(2);
    expect(text.match(/NARRATION START/g)).toHaveLength(1);
  });

  it("supports very long movies and an empty episode", () => {
    expect(cameraReviewTimecode(3599.999)).toBe("01:00:00.00");
    expect(cameraReviewTimecode(1200.05)).toBe("00:20:00.05");
    const project = cameraShotDemo();
    project.scenes = [];
    const text = episodeCameraPunchList(project);
    expect(text).toContain("Scenes: 0 | Custom camera: 0% (0.00s of 0.00s)");
    expect(text).not.toContain("SCENE 1 —");
  });
  it("includes accurate device-specific voice source notes only when supplied, without changing the project", () => {
    const project = cameraShotDemo();
    const source = builtInSound("melody");
    const clip = newAudioClip(project, source, "dialogue", 0, 2.2);
    project.audioAssets.push(source);
    project.audioClips.push(clip);
    const before = JSON.stringify(project);
    const embedded = episodeCameraPunchList(project, {
      missing: new Set<string>(), checked: true, checkFailed: false,
    });
    expect(embedded).toContain("Audio-source notes reflect only the file index");
    expect(embedded).toContain(`AUDIO SOURCE — Embedded audio source: ${source.name}.`);
    expect(embedded).toContain("Listen to verify its contents");
    expect(episodeCameraPunchList(project)).not.toContain("AUDIO SOURCE —");
    expect(JSON.stringify(project)).toBe(before);

    project.audioAssets = project.audioAssets.map(asset => asset.id === source.id ? {
      ...asset, dataUrl: "",
      file: { key: "local-test-file", size: 100, sha256: "a".repeat(64) },
    } : asset);
    const options = { missing: new Set([source.id]), checked: true, checkFailed: false };
    const missing = episodeCameraPunchList(project, options);
    expect(missing).toContain("Original audio missing on this device");
    expect(missing).not.toContain("Local audio entry found");
    const pending = episodeCameraPunchList(project, { ...options, missing: new Set(), checked: false });
    expect(pending).toContain("Checking local audio source");
    const failed = episodeCameraPunchList(project, { ...options, missing: new Set(), checkFailed: true });
    expect(failed).toContain("Local audio source not verified");
    const indexed = episodeCameraPunchList(project, { ...options, missing: new Set() });
    expect(indexed).toContain("Local audio entry found");
    expect(indexed).toContain("not necessarily been decoded or heard");
  });

});
