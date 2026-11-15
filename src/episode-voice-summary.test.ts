import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { episodeAssignedVoiceSummary } from "./episode-voice-summary";

describe("PR #126 whole-episode assigned voice summary", () => {
  it("combines scene coverage, ranks true gaps and does not double count overlapping or crossing clips", () => {
    const project = cameraShotDemo();
    project.scenes[0].duration = 10;
    project.scenes[1].duration = 5;
    const sound = builtInSound("melody");
    project.audioAssets.push(sound);
    const first = newAudioClip(project, sound, "dialogue", 0, 1);
    const overlap = newAudioClip(project, sound, "narration", 0, 3);
    const spillover = newAudioClip(project, sound, "dialogue", 0, 9);
    const music = newAudioClip(project, sound, "music", 1, 2);
    project.audioClips.push(
      { ...first, duration: 3 }, { ...overlap, duration: 3 },
      { ...spillover, duration: 1.5 }, { ...music, duration: 2 },
    );
    const before = JSON.stringify(project);
    const result = episodeAssignedVoiceSummary(project);
    expect(result.totalSeconds).toBe(15);
    expect(result.assignedSeconds).toBe(6.5);
    expect(result.unassignedSeconds).toBe(8.5);
    expect(result.intervalCount).toBe(3);
    expect(result.longestGaps.map(x => [x.sceneIndex, x.start, x.end, x.episodeStart, x.episodeEnd]))
      .toEqual([
        [1, .5, 5, 10.5, 15],
        [0, 6, 9, 6, 9],
        [0, 0, 1, 0, 1],
      ]);
    expect(episodeAssignedVoiceSummary(project)).toEqual(result);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("limits ranked intervals to five and handles an empty episode without false readiness claims", () => {
    const project = cameraShotDemo();
    project.audioClips = [];
    expect(episodeAssignedVoiceSummary(project).longestGaps).toHaveLength(2);
    project.scenes = [];
    expect(episodeAssignedVoiceSummary(project)).toEqual({
      totalSeconds: 0, assignedSeconds: 0, unassignedSeconds: 0,
      intervalCount: 0, longestGaps: [],
    });
  });
});
