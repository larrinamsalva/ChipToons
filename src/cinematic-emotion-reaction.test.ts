import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementBase,sceneElementAt,sceneFramesAt } from "./timeline";
import { Stage } from "./components/Stage";
import { PuppetArt } from "./components/PuppetArt";

function fixture() {
  const project=littleFixersFullBodyPilot();
  const scene=project.scenes[0];
  const actor=scene.elements.find(e=>e.characterId)!;
  actor.emotion="calm";
  const initial=elementBase(actor);
  actor.animation={
    blink:false,idle:"none",keyframes:[
      {...initial,id:"react-calm",time:0,easing:"linear",emotion:"calm"},
      {...initial,id:"react-excited",time:2,easing:"linear",emotion:"excited"},
      {...initial,id:"react-excited-again",time:3,easing:"linear",emotion:"excited"},
      {...initial,id:"react-worried",time:4,easing:"linear",emotion:"worried"},
    ],
  };
  return {project,scene,actor};
}

describe("PR #95 authored-emotion reaction acting",()=>{
 it("responds only to actual authored emotion changes, for 0.56s with smooth bounds",()=>{
  const {actor}=fixture();
  expect(cinematicEmotionReactionAt(actor,0.15)).toBeUndefined();
  expect(cinematicEmotionReactionAt(actor,1.99)).toBeUndefined();
  expect(cinematicEmotionReactionAt(actor,2.28)).toMatchObject({
    headTilt:1.7,torsoTilt:.55,browLift:.64,browAsymmetry:.4,squint:.65,
  });
  expect(cinematicEmotionReactionAt(actor,2.56)).toBeUndefined();
  expect(cinematicEmotionReactionAt(actor,3.28)).toBeUndefined();
  const worried=cinematicEmotionReactionAt(actor,4.28)!;
  expect(worried.headTilt).toBeCloseTo(-1.3);
  expect(worried.browAsymmetry).toBeCloseTo(-.38);
  expect(worried.squint).toBeCloseTo(.25);
  for(let i=0;i<200;i++){
    const data=cinematicEmotionReactionAt(actor,i*.025);
    if(!data)continue;
    expect(Math.abs(data.headTilt)).toBeLessThanOrEqual(1.7);
    expect(Math.abs(data.torsoTilt)).toBeLessThanOrEqual(.55);
    expect(data.squint).toBeGreaterThanOrEqual(0);
    expect(data.squint).toBeLessThanOrEqual(.65);
  }
  expect(cinematicEmotionReactionAt(actor,Number.NaN)).toBeUndefined();
  expect(cinematicEmotionReactionAt(actor,-1)).toBeUndefined();
 });
 it("polishes existing cinematic frame/face but preserves Classic, calm editor, lip-sync and source",()=>{
  const {project,scene,actor}=fixture();
  const old=JSON.stringify(project);
  const classic=sceneFramesAt(project,scene,2.28).get(actor.id)!;
  const classicStage=renderToStaticMarkup(createElement(Stage,{
    project,scene,time:2.28,labelled:false,
  }));
  expect(classicStage).not.toContain("data-cinematic-reaction-lid");
  project.visualStyle="storybook-cinematic";
  const cinematic=sceneFramesAt(project,scene,2.28).get(actor.id)!;
  expect(cinematic.x).toBeCloseTo(classic.x);
  expect(cinematic.mouth).toBe(classic.mouth);
  expect(cinematic.emotion).toBe(classic.emotion);
  expect(cinematic.voiceOpening).toBe(classic.voiceOpening);
  expect(cinematic.joints?.head?.angle)
    .toBeGreaterThan((classic.joints?.head?.angle??0)+1);
  expect(sceneFramesAt(project,scene,2.28).get(actor.id)).toEqual(cinematic);
  const calm=sceneElementAt(project,scene,actor,2.28,0,true);
  expect(calm.rotation).toBeCloseTo(classic.rotation);
  const frames=sceneFramesAt(project,scene,2.28);
  const face=cinematicFaceAt(project,scene,actor,frames.get(actor.id)!,frames,2.28,false)!;
  expect(face.squint).toBeCloseTo(.65);
  expect(face.browAsymmetry).toBeCloseTo(.4);
  expect(cinematicFaceAt(project,scene,actor,frames.get(actor.id)!,frames,2.28,true))
    .toBeUndefined();
  const cinematicStage=renderToStaticMarkup(createElement(Stage,{
    project,scene,time:2.28,labelled:false,
  }));
  expect(cinematicStage).toContain('data-cinematic-reaction-lid="true"');
  expect(cinematicStage).toContain('data-cinematic-reaction-brow="true"');
  const stageLater=renderToStaticMarkup(createElement(Stage,{
    project,scene,time:2.8,labelled:false,
  }));
  expect(stageLater).not.toContain('data-cinematic-reaction-lid="true"');
  delete project.visualStyle;
  expect(JSON.stringify(project)).toBe(old);
 });
 it("does not add painted-pupil animation or rewrite manual mouths",()=>{
  const {project,scene,actor}=fixture();
  project.visualStyle="storybook-cinematic";
  const faceAt=sceneFramesAt(project,scene,2.28);
  const reaction=cinematicFaceAt(
    project,scene,actor,faceAt.get(actor.id)!,faceAt,2.28,false,
  )!;
  const actorCharacter=project.characters.find(c=>c.id===actor.characterId)!;
  const authored=renderToStaticMarkup(createElement(PuppetArt,{
    character:actorCharacter,assets:project.assets,emotion:"excited",mouth:"open",
    voiceOpening:.5,premium:true,gaze:reaction,
  }));
  expect(authored).toContain('data-cinematic-reaction-lid="true"');
  expect(authored).toContain('cy="15"');
  expect(authored).not.toContain("M-13 11q13 18 26 0");
  const classic=renderToStaticMarkup(createElement(PuppetArt,{
    character:actorCharacter,assets:project.assets,emotion:"excited",mouth:"open",
    voiceOpening:.5,premium:false,gaze:reaction,
  }));
  expect(classic).not.toContain("data-cinematic-reaction-lid");
  const before=JSON.stringify(project);
  const character=project.characters.find(c=>c.id===actor.characterId)!;
  const rig=character.puppet!;
  character.puppet={...rig,parts:[...rig.parts,{
    id:"raster-eyes",role:"eyes",parentId:"head",x:0,y:0,
    pivotX:0,pivotY:0,width:24,height:16,assetId:"artist-painted",
  }]};
  expect(cinematicFaceAt(project,scene,actor,faceAt.get(actor.id)!,faceAt,2.28,false))
    .toBeUndefined();
  character.puppet=rig;
  expect(JSON.stringify(project)).toBe(before);
 });
});
