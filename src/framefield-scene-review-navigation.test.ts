import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldGuidedSession } from "./framefield-guided-session";
import {
  framefieldSceneReviewCounts, nextFramefieldSceneToReview,
} from "./framefield-scene-review-navigation";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const prefix=(i:number)=>"shot"+String(i+1).padStart(2,"0")+"_frame_";
const shot=(i:number)=>({
  prefix:prefix(i),
  assets:[0,1].map((j):Asset=>({
    id:"img-"+i+"-"+j,name:prefix(i)+(j+1)+".png",
    type:"image",mime:"image/png",dataUrl:png,
    sourceWidth:2,sourceHeight:2,
  })),
});
const fixture=()=>projectFromFrameAssetShots(Array.from({length:8},(_,i)=>shot(i)),2);

describe("eight-scene editorial review navigator",()=>{
 it("finds distant written-voice, missing-caption and coverage gaps, wraps exactly once",()=>{
  const p=fixture();
  p.scenes[1].narration="Scout checks the wheel.";
  p.scenes[6].narration="Helper Jo shows safe tools.";
  p.captions=[
    {id:"caption-only",sceneId:p.scenes[3].id,start:0,end:1,text:"Safety first"},
    {id:"jo",sceneId:p.scenes[6].id,start:0,end:2,text:"Helper Jo shows safe tools."},
  ];
  const before=JSON.stringify(p);
  const session=framefieldGuidedSession(p);
  const scenes=session.scenes;
  expect(scenes).toHaveLength(8);
  expect(framefieldSceneReviewCounts(scenes)).toEqual({
    voice:2,captions:1,timing:2,
  });
  expect(nextFramefieldSceneToReview(scenes,0,"voice")).toBe(1);
  expect(nextFramefieldSceneToReview(scenes,1,"voice")).toBe(6);
  expect(nextFramefieldSceneToReview(scenes,6,"voice")).toBe(1);
  expect(nextFramefieldSceneToReview(scenes,7,"voice")).toBe(1);
  expect(nextFramefieldSceneToReview(scenes,6,"captions")).toBe(1);
  expect(nextFramefieldSceneToReview(scenes,1,"captions")).toBe(1);
  expect(nextFramefieldSceneToReview(scenes,1,"timing")).toBe(3);
  expect(nextFramefieldSceneToReview(scenes,3,"timing")).toBe(6);
  expect(nextFramefieldSceneToReview(scenes,6,"timing")).toBe(3);
  expect(nextFramefieldSceneToReview(scenes,-1,"timing")).toBe(3);
  expect(JSON.stringify(p)).toBe(before);
 });
 it("never treats intentionally silent scenes as a missing voice assignment",()=>{
  const p=fixture(),before=JSON.stringify(p);
  const scenes=framefieldGuidedSession(p).scenes;
  expect(framefieldSceneReviewCounts(scenes)).toEqual({
    voice:0,captions:0,timing:0,
  });
  for(const k of ["voice","captions","timing"] as const) {
    expect(nextFramefieldSceneToReview(scenes,0,k)).toBeUndefined();
    expect(nextFramefieldSceneToReview([],0,k)).toBeUndefined();
  }
  expect(JSON.stringify(p)).toBe(before);
 });
 it("distinguishes uncovered caption intervals from assigned or verified speech",()=>{
  const p=fixture();
  p.scenes[2].narration="Listen to the teacher";
  p.captions=[{id:"caption",sceneId:p.scenes[2].id,start:.2,end:1.5,text:"Listen"}];
  const steps=framefieldGuidedSession(p).scenes;
  expect(framefieldSceneReviewCounts(steps)).toEqual({voice:1,captions:0,timing:1});
  expect(nextFramefieldSceneToReview(steps,2,"timing")).toBe(2);
  expect(nextFramefieldSceneToReview(steps,Number.NaN,"voice")).toBe(2);
 });
});
