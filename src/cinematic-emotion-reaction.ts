import type { Emotion, SceneElement } from "./model";

/** Small stage-unit accents following an ACTUALLY AUTHORED emotion keyframe.
 * This is sampled from local scene time only, with no side effects and no
 * invented dialogue or facial emotion overrides. */
export interface CinematicEmotionReaction {
  headTilt: number;
  torsoTilt: number;
  browLift: number;
  browAsymmetry: number;
  squint: number;
}

const duration=0.56;
const reactionWeights: Record<Emotion,{head:number;torso:number;brow:number;asym:number;squint:number}>={
  happy:     {head: 1.15, torso: 0.35, brow:0.28, asym:0.32, squint:0.55},
  excited:   {head: 1.70, torso: 0.55, brow:0.64, asym:0.40, squint:0.65},
  surprised: {head:-1.60, torso:-0.45, brow:0.82, asym:-0.35,squint:0},
  worried:   {head:-1.30, torso:-0.35, brow:0.49, asym:-0.38,squint:0.25},
  sad:       {head:-0.80, torso:-0.28, brow:0.14, asym:-0.22,squint:0.24},
  calm:      {head: 0.45, torso: 0.14, brow:0.10, asym:0.10, squint:0.15},
};

/** React only to a CHANGE of emotion between actual saved keyframes.
 * Do not add reactions to static/default faces, or repeat every scene loop.
 * Age and envelope are bounded; all output dies away after 0.56 seconds.
 */
export function cinematicEmotionReactionAt(
  element:Pick<SceneElement,"emotion"|"animation">,localTime:number,
):CinematicEmotionReaction|undefined {
  if(!Number.isFinite(localTime)||localTime<0)return;
  const keys=element.animation?.keyframes;
  if(!keys?.length)return;
  let previous:Emotion=element.emotion;
  let last:{time:number;emotion:Emotion}|undefined;
  for(const key of keys){
    if(key.time>localTime)break;
    if(key.time>0 && key.emotion!==previous){
      last={time:key.time,emotion:key.emotion};
    }
    previous=key.emotion;
  }
  if(!last)return;
  const age=localTime-last.time;
  if(age<0||age>=duration)return;
  const progress=age/duration;
  // Soft peak and full settle. Continuous first derivative at both ends.
  const envelope=Math.sin(Math.PI*progress)**2;
  const weight=reactionWeights[last.emotion];
  return {
    headTilt:weight.head*envelope,
    torsoTilt:weight.torso*envelope,
    browLift:weight.brow*envelope,
    browAsymmetry:weight.asym*envelope,
    squint:weight.squint*envelope,
  };
}
