import type { CameraShot } from "./camera-shots";
import { cameraHoldReviewTimes } from "./camera-motion-scrub";
import type { Project, Scene } from "./model";
import { sceneCaptionText } from "./production";

export type CameraHoldCaptionChange = {
  time: number;
  before: string;
  after: string;
};

/** Exact caption cue boundaries inside an existing, half-open camera hold.
 * Unlike five sampled checkpoints, this can see a brief caption appearing
 * and disappearing between two checkpoints. Read-only, no media operations. */
export function cameraHoldCaptionChanges(
  project: Project,scene: Scene,shot: CameraShot,
) {
  const hold=cameraHoldReviewTimes(shot);
  if(!hold)return;
  const boundaries=[...new Set(project.captions
    .filter(c=>c.sceneId===scene.id)
    .flatMap(c=>[c.start,c.end])
    .filter(t=>Number.isFinite(t) &&
      t>hold.finishTime+1e-7 && t<=hold.lastTime))].sort((a,b)=>a-b);
  const startingCaption=sceneCaptionText(project,scene,hold.finishTime);
  let previous=startingCaption;
  const changes:CameraHoldCaptionChange[]=[];
  for(const time of boundaries) {
    const next=sceneCaptionText(project,scene,time);
    if(next!==previous) changes.push({time,before:previous,after:next});
    previous=next;
  }
  return {startingCaption,changes,holdSeconds:hold.holdSeconds};
}
