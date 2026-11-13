import { describe, expect, it } from "vitest";
import { cameraCoverageReview } from "./camera-coverage-review";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { newAudioClip } from "./production";
import { builtInSound } from "./sounds";
import type { CameraShot } from "./camera-shots";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const [scout, jo] = scene.elements.filter(item => !!item.characterId);
  const shot = (id: string, start: number, end: number): CameraShot => ({
    id, style: "pair", start, end, move: .2,
    frame: { x: 400, y: 225, zoom: 1.4 },
    targets: [scout.id, jo.id], follow: false,
    offset: { x: 0, y: 0 }, placement: "center",
    note: "Creator keeps the pair in view.",
  });
  const audio = builtInSound("melody");
  const clip = (time: number) => ({
    ...newAudioClip(project, audio, "dialogue" as const, 0, time),
    volume: 1, duration: 1,
  });
  return { project, scene, shot, clip };
}

describe("PR #111 read-only camera coverage review", () => {
  it("shows default-camera gaps and the real custom-shot seconds", () => {
    const { project, scene, shot } = fixture();
    scene.duration = 20;
    const saved = [shot("a", 0, 4), shot("b", 6, 12)];
    const snapshot = JSON.stringify(project);
    const review = cameraCoverageReview(project, scene, saved);
    expect(review.coveredSeconds).toBe(10);
    expect(review.totalSeconds).toBe(20);
    expect(review.gaps).toEqual([
      { start: 4, end: 6 }, { start: 12, end: 20 },
    ]);
    expect(review.voices).toEqual([]);
    expect(cameraCoverageReview(project, scene, saved)).toEqual(review);
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("tracks source voice starts inside a shot or default camera, including exact cuts", () => {
    const { project, scene, shot, clip } = fixture();
    scene.duration = 20;
    const a = clip(2), b = clip(6), c = clip(12.5), muted = clip(7);
    muted.muted = true;
    project.audioClips = [c, muted, a, b];
    const review = cameraCoverageReview(project, scene, [
      shot("a", 0, 4), shot("b", 6, 12),
    ]);
    expect(review.voices).toEqual([
      { clipId: a.id, start: 2, category: "dialogue", shotId: "a" },
      { clipId: b.id, start: 6, category: "dialogue", shotId: "b" },
      { clipId: c.id, start: 12.5, category: "dialogue", shotId: undefined },
    ]);
  });

  it("handles contiguous, overlapping, empty and later scene coverage safely", () => {
    const { project, scene, shot, clip } = fixture();
    scene.duration = 10;
    expect(cameraCoverageReview(project, scene, [
      shot("a", 0, 5), shot("b", 5, 10),
    ])).toMatchObject({ coveredSeconds: 10, gaps: [] });
    expect(cameraCoverageReview(project, scene, [
      shot("a", 0, 8), shot("b", 5, 10),
    ]).coveredSeconds).toBe(10);
    expect(cameraCoverageReview(project, scene, []).gaps)
      .toEqual([{ start: 0, end: 10 }]);
    const second = { ...scene, id: "second-scene" };
    project.scenes = [scene, second];
    const later = clip(3);
    later.sceneId = second.id;
    project.audioClips = [later];
    const result = cameraCoverageReview(project, second, [shot("later", 0, 6)]);
    expect(result.voices).toEqual([{
      clipId: later.id, start: 3, category: "dialogue", shotId: "later",
    }]);
  });
});
