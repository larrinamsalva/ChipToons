import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";

describe("PR #123 read-only assigned voice timing coverage", () => {
  it("unions overlaps, excludes muted/music, and clips a voice spilling into the next scene", () => {
    const project = cameraShotDemo();
    project.scenes[0].duration = 10;
    project.scenes[1].duration = 5;
    const audio = builtInSound("melody");
    project.audioAssets.push(audio);
    const a = newAudioClip(project, audio, "dialogue", 0, 1);
    const b = newAudioClip(project, audio, "narration", 0, 3);
    const c = newAudioClip(project, audio, "dialogue", 0, 9);
    const muted = newAudioClip(project, audio, "dialogue", 0, 7);
    const music = newAudioClip(project, audio, "music", 0, 8);
    project.audioClips.push(
      { ...a, duration: 3 },
      { ...b, duration: 3 },
      { ...c, duration: 1.5 },
      { ...muted, duration: 1, muted: true },
      { ...music, duration: 1 },
    );
    const snapshot = JSON.stringify(project);
    const first = sceneAssignedVoiceCoverage(project, 0);
    expect(first.totalSeconds).toBe(10);
    expect(first.spans.map(({ start, end }) => [start, end])).toEqual([
      [1, 4], [3, 6], [9, 10],
    ]);
    expect(first.gaps).toEqual([{ start: 0, end: 1 }, { start: 6, end: 9 }]);
    expect(first.assignedSeconds).toBe(6);
    const second = sceneAssignedVoiceCoverage(project, 1);
    expect(second.spans).toEqual([{
      clipId: c.id, category: "dialogue", start: 0, end: .5,
    }]);
    expect(second.gaps).toEqual([{ start: .5, end: 5 }]);
    expect(second.assignedSeconds).toBe(.5);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("does not call an unassigned interval silent or treat an empty scene as a failure", () => {
    const project = cameraShotDemo();
    project.scenes[0].duration = 1200;
    project.audioClips = [];
    const coverage = sceneAssignedVoiceCoverage(project, 0);
    expect(coverage).toEqual({
      totalSeconds: 1200,
      assignedSeconds: 0,
      spans: [],
      gaps: [{ start: 0, end: 1200 }],
    });
    expect(sceneAssignedVoiceCoverage(project, -1)).toEqual({
      totalSeconds: 0, assignedSeconds: 0, spans: [], gaps: [],
    });
  });
});
