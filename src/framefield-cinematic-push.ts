import { hasCameraTrack, shotIssue } from "./camera-shots";
import type { CameraShot } from "./camera-shots";
import type { Project, Scene } from "./model";
import { newCameraShot } from "./shot-director";

/** Opt-in full-scene gentle zoom, reusing the normal camera and export pipeline.
 * Existing camera work, original PNGs and saved timelines are never overwritten. */
export function canStartFramefieldCinematicPush(project: Project, scene: Scene) {
  return project.templateId === "frame-sequence-storyboard" &&
    project.scenes.some(candidate => candidate.id === scene.id) &&
    scene.elements.some(element => element.kind === "art" &&
      !!element.frameSequence?.assetIds.length) &&
    !(scene.cameraShots?.length) && !hasCameraTrack(scene) &&
    scene.camera === "wide";
}

export function framefieldGentleCinematicPush(project: Project, scene: Scene): CameraShot {
  if (!canStartFramefieldCinematicPush(project, scene))
    throw new Error("A gentle push-in needs a PNG scene without authored camera shots or tracks.");
  const shot: CameraShot = {
    ...newCameraShot(project, scene, 0),
    style: "move",
    start: 0,
    end: scene.duration,
    move: scene.duration,
    frame: { x: 400, y: 225, zoom: 1.35 },
    targets: [],
    follow: false,
    offset: { x: 0, y: 0 },
    placement: "center",
    note: "Gentle cinematic push-in over the original PNG frames",
  };
  const issue = shotIssue([shot], scene);
  if (issue) throw new Error(issue);
  return shot;
}
