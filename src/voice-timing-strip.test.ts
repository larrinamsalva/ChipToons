import { describe, expect, it } from "vitest";
import { cameraShotDemo } from "./camera-shot-demo";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { sceneAssignedVoiceCoverage } from "./episode-voice-coverage";
import { voiceTimingBands } from "./voice-timing-strip";

describe("PR #127 accessible scene timing strips", () => {
  it("renders accurately proportioned bands from saved clips without double-counting overlap", () => {
    const project = cameraShotDemo();
    project.scenes[0].duration = 10;
    const sound = builtInSound("melody");
    project.audioAssets.push(sound);
    const a = newAudioClip(project, sound, "dialogue", 0, 1);
    const b = newAudioClip(project, sound, "narration", 0, 2);
    const c = newAudioClip(project, sound, "dialogue", 0, 7);
    project.audioClips.push(
      { ...a, duration: 3 }, { ...b, duration: 3 },
      { ...c, duration: 1 },
    );
    const before = JSON.stringify(project);
    const bands = voiceTimingBands(sceneAssignedVoiceCoverage(project, 0));
    expect(bands.map(b => [b.kind, b.start, b.end, b.widthPercent])).toEqual([
      ["unassigned", 0, 1, 10],
      ["assigned", 1, 5, 40],
      ["unassigned", 5, 7, 20],
      ["assigned", 7, 8, 10],
      ["unassigned", 8, 10, 20],
    ]);
    expect(bands.reduce((total, band) => total + band.widthPercent, 0)).toBe(100);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("handles all-assigned, all-unassigned, and zero-length scenes safely", () => {
    expect(voiceTimingBands({
      totalSeconds: 10, assignedSeconds: 10, spans: [], gaps: [],
    })).toEqual([{ kind: "assigned", start: 0, end: 10, widthPercent: 100 }]);
    expect(voiceTimingBands({
      totalSeconds: 10, assignedSeconds: 0, spans: [],
      gaps: [{ start: 0, end: 10 }],
    })).toEqual([{ kind: "unassigned", start: 0, end: 10, widthPercent: 100 }]);
    expect(voiceTimingBands({
      totalSeconds: 0, assignedSeconds: 0, spans: [], gaps: [],
    })).toEqual([]);
  });
});
