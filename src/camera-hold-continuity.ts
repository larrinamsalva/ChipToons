import type { CameraShot } from "./camera-shots";
import { cameraHoldReviewTimes } from "./camera-motion-scrub";
import { liveCameraFraming } from "./camera-motion-framing";
import type { Project, Scene } from "./model";
import { sceneCaptionText } from "./production";

/** A small set of actual Stage camera/caption samples during an authored hold.
 * Changes to original PNGs/characters are intentionally not measured. */
export type CameraHoldCheckpoint = {
  time: number;
  x: number; y: number; zoom: number;
  shotId?: string;
  caption: string;
  outsideEdges: string[];
};

export function summarizeCameraHoldCheckpoints(
  samples: readonly CameraHoldCheckpoint[], expectedShotId: string,
) {
  if (!samples.length) {
    return { changedFramingCount: 0, captionTransitions: 0,
      boundaryWarnings: 0, inactiveShotCount: 0 };
  }
  const baseline = samples[0];
  const changedFramingCount = samples.filter(point =>
    Math.hypot(point.x - baseline.x, point.y - baseline.y) > 0.05 ||
    Math.abs(point.zoom - baseline.zoom) > 0.001,
  ).length;
  const captionTransitions = samples.slice(1).filter((point,i) =>
    point.caption !== samples[i].caption,
  ).length;
  return {
    changedFramingCount,
    captionTransitions,
    boundaryWarnings: samples.filter(point => point.outsideEdges.length > 0).length,
    inactiveShotCount: samples.filter(point => point.shotId !== expectedShotId).length,
  };
}

/** Five deterministic, half-open hold checkpoints using exactly the Stage's
 * camera evaluator and the preview's real caption time. Read-only. */
export function cameraHoldContinuity(
  project: Project, scene: Scene, shot: CameraShot,
) {
  const hold = cameraHoldReviewTimes(shot);
  if (!hold) return;
  const samples: CameraHoldCheckpoint[] = Array.from({length:5}, (_,i) => {
    const time = hold.finishTime + (hold.lastTime - hold.finishTime) * i / 4;
    const {camera,coverage} = liveCameraFraming(project,scene,time);
    return {
      time,x:camera.x,y:camera.y,zoom:camera.zoom,shotId:camera.shotId,
      caption:sceneCaptionText(project,scene,time),
      outsideEdges:coverage.edges,
    };
  });
  return {samples,summary:summarizeCameraHoldCheckpoints(samples,shot.id)};
}
