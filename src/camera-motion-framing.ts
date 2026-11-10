import type { CameraValues } from "./animation-model";
import { cameraMotionSamples } from "./camera-motion-samples";
import type { CameraShot } from "./camera-shots";
import type { Project, Scene } from "./model";
import { stageCameraAt } from "./timeline";

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
