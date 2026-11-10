import type { CameraValues } from "./animation-model";
import { cameraMotionSamples } from "./camera-motion-samples";
import type { CameraShot } from "./camera-shots";
import type { Project, Scene } from "./model";
import { sceneFramesAt, sceneStart, stageCameraAt } from "./timeline";

export type CameraArtworkEdge = "left" | "right" | "top" | "bottom";
export type CameraArtworkCheck = {
  time: number;
  edges: CameraArtworkEdge[];
  /** Fraction of the visible camera rectangle lying outside the original 800x450 stage.
   * An advisory canvas-coverage check, not detection of missing artwork pixels. */
  outsideFraction: number;
};

/** The Stage's actual camera transform is:
 * translate(400 225) scale(zoom) translate(-x -y).
 * Invert it to find the visible 800x450 source-space rectangle. */
export function inspectCameraArtworkCoverage(
  camera: Pick<CameraValues, "x" | "y" | "zoom">,
  time = 0,
): CameraArtworkCheck {
  const {x,y,zoom}=camera;
  if (!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(zoom)||zoom<=0) {
    return {time,edges:["left","right","top","bottom"],outsideFraction:1};
  }
  const visibleHalfWidth=400/zoom, visibleHalfHeight=225/zoom;
  const left=x-visibleHalfWidth, right=x+visibleHalfWidth;
  const top=y-visibleHalfHeight, bottom=y+visibleHalfHeight;
  const epsilon=0.02;
  const edges:CameraArtworkEdge[]=[
    ...(left < -epsilon ? ["left" as const] : []),
    ...(right > 800+epsilon ? ["right" as const] : []),
    ...(top < -epsilon ? ["top" as const] : []),
    ...(bottom > 450+epsilon ? ["bottom" as const] : []),
  ];
  const visibleW=2*visibleHalfWidth,visibleH=2*visibleHalfHeight;
  const withinW=Math.max(0,Math.min(800,right)-Math.max(0,left));
  const withinH=Math.max(0,Math.min(450,bottom)-Math.max(0,top));
  const outsideFraction=Math.max(0,Math.min(1,1-(withinW*withinH)/(visibleW*visibleH)));
  return {time,edges,outsideFraction};
}

/** Calls the same deterministic camera evaluator as the movie compositor.
 * A/B comparison passes the saved scene instead of the proposed scene;
 * no mutations and no automatic corrections are ever performed. */
export function cameraMotionArtworkChecks(project:Project,scene:Scene,shot:Pick<CameraShot,"start"|"end">){
  return cameraMotionSamples(shot).map(sample=>{
    const camera=stageCameraAt(project,scene,sample.time);
    return {...sample,...inspectCameraArtworkCoverage(camera,sample.time)};
  });
}


/** Additional full-move advisory: 21 deterministic samples, including the
 * half-open end, catch problems between the three large preview frames.
 * These are samples, not a continuous-motion mathematical proof. */
export function cameraMotionArtworkSweep(
  project: Project, scene: Scene, shot: Pick<CameraShot, "start" | "end">,
) {
  const duration = shot.end - shot.start;
  if (!Number.isFinite(shot.start) || !Number.isFinite(shot.end) || duration <= 0) {
    return { checks: [] as CameraArtworkCheck[], flaggedCount: 0, worst: undefined as CameraArtworkCheck | undefined };
  }
  const checks = Array.from({length:21},(_,i)=>{
    const time = i === 20
      ? shot.end - Math.min(0.005,duration/10)
      : shot.start + duration*i/20;
    return inspectCameraArtworkCoverage(stageCameraAt(project,scene,time),time);
  });
  const flaggedCount=checks.filter(check=>check.edges.length>0).length;
  const worst=checks.reduce<CameraArtworkCheck | undefined>(
    (chosen,check)=>check.outsideFraction>(chosen?.outsideFraction??0) ? check : chosen,
    undefined,
  );
  return {checks,flaggedCount,worst};
}


/** Match Stage.tsx's exact scene time, calm-mode frames, voice offset and
 * camera evaluator. Read-only: called only while the director is previewed. */
export function liveCameraFraming(
  project: Project, scene: Scene, time: number, calm = false,
) {
  const sceneIndex = project.scenes.findIndex(item => item.id === scene.id);
  const safeTime = Math.max(0, Math.min(scene.duration, time));
  const voiceStart = scene.elements.some(element => element.voiceMouth?.length)
    ? sceneStart(project, sceneIndex) : 0;
  const frames = sceneFramesAt(project, scene, safeTime, voiceStart, calm);
  const camera = stageCameraAt(project, scene, safeTime, calm, frames, voiceStart);
  return { camera, coverage: inspectCameraArtworkCoverage(camera, safeTime) };
}
