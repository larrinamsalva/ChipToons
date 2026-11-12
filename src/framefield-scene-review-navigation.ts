/** Production navigation hints over the real multi-scene voice/caption
 * review. These are assigned-interval checks, NEVER verified speech or a
 * publishing/export readiness decision. All operations are read-only. */
export type SceneReviewKind = "voice" | "captions" | "timing";
export interface SceneReviewFlags {
  missingVoice: boolean;
  missingCaptions: boolean;
  unmatchedCues: number;
  partiallyCoveredCues: number;
}

export function framefieldSceneNeedsReview(
  scene: SceneReviewFlags,kind: SceneReviewKind,
): boolean {
  switch(kind){
    case "voice": return scene.missingVoice;
    case "captions": return scene.missingCaptions;
    case "timing": return scene.unmatchedCues>0 || scene.partiallyCoveredCues>0;
  }
}

export function framefieldSceneReviewCounts(scenes: readonly SceneReviewFlags[]) {
  return {
    voice:scenes.filter(scene=>framefieldSceneNeedsReview(scene,"voice")).length,
    captions:scenes.filter(scene=>framefieldSceneNeedsReview(scene,"captions")).length,
    timing:scenes.filter(scene=>framefieldSceneNeedsReview(scene,"timing")).length,
  };
}

/** Start *after* the current scene, wrap once, and allow returning the
 * current scene if it is the only matching item. Undefined means none. */
export function nextFramefieldSceneToReview(
  scenes:readonly SceneReviewFlags[],from:number,kind:SceneReviewKind,
):number|undefined {
  if(!scenes.length)return;
  const start=Number.isInteger(from) && from>=0 && from<scenes.length ? from : -1;
  for(let step=1;step<=scenes.length;step++){
    const index=(start+step)%scenes.length;
    if(framefieldSceneNeedsReview(scenes[index],kind))return index;
  }
}
