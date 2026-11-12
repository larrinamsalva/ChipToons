import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { cinematicFaceAt } from "./cinematic-face";
import { PuppetArt } from "./components/PuppetArt";
import { Stage } from "./components/Stage";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementBase, sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersFullBodyPilot();
  const scene = project.scenes[0];
  const actor = scene.elements.find(e => e.characterId)!;
  actor.emotion = "calm";
  const initial = elementBase(actor);
  actor.animation = {
    blink: false, idle: "none",
    keyframes: [
      {...initial,id:"original-calm",time:0,easing:"linear",emotion:"calm"},
      {...initial,id:"happy-beat",time:2,easing:"linear",emotion:"excited"},
      {...initial,id:"sad-beat",time:4,easing:"linear",emotion:"sad"},
    ],
  };
  return {project,scene,actor};
}
function stage(project:ReturnType<typeof fixture>["project"],
  scene:ReturnType<typeof fixture>["scene"],time:number) {
  return renderToStaticMarkup(createElement(Stage,{
    project,scene,time,labelled:false,
  }));
}

describe("PR #97 cinematic cheek expressions",()=>{
  it("samples a bounded, deterministic and brief authored-emotion smile and sad response",()=>{
    const {actor}=fixture();
    expect(cinematicEmotionReactionAt(actor,1.99)).toBeUndefined();
    const excited=cinematicEmotionReactionAt(actor,2.28)!;
    expect(excited.cheekLift).toBeCloseTo(1.8);
    expect(excited.cheekWarmth).toBeCloseTo(.25);
    expect(cinematicEmotionReactionAt(actor,2.28)).toEqual(excited);
    expect(cinematicEmotionReactionAt(actor,2.56)).toBeUndefined();
    const sad=cinematicEmotionReactionAt(actor,4.28)!;
    expect(sad.cheekLift).toBeCloseTo(-.6);
    expect(sad.cheekWarmth).toBeCloseTo(-.09);
    for(let tick=0;tick<240;tick++){
      const sample=cinematicEmotionReactionAt(actor,tick*.025);
      if(!sample)continue;
      expect(sample.cheekLift).toBeGreaterThanOrEqual(-.6);
      expect(sample.cheekLift).toBeLessThanOrEqual(1.8);
      expect(sample.cheekWarmth).toBeGreaterThanOrEqual(-.09);
      expect(sample.cheekWarmth).toBeLessThanOrEqual(.25);
    }
  });
  it("renders real animated cheeks in Cinematic Stage but not Classic, calm or settled frames",()=>{
    const {project,scene,actor}=fixture();
    const saved=JSON.stringify(project);
    const classic=stage(project,scene,2.28);
    expect(classic).not.toContain("data-cinematic-cheek");
    expect(classic).not.toContain("data-cinematic-smile-crease");
    project.visualStyle="storybook-cinematic";
    const preview=stage(project,scene,2.28);
    expect(preview).toContain('data-cinematic-cheek="animated"');
    expect(preview).toContain('data-cinematic-smile-crease="true"');
    expect(stage(project,scene,2.28)).toBe(preview);
    expect(stage(project,scene,2.8)).not.toContain("data-cinematic-cheek");
    expect(stage(project,scene,2.8)).not.toContain("data-cinematic-smile-crease");
    const frames=sceneFramesAt(project,scene,2.28);
    const gaze=cinematicFaceAt(project,scene,actor,frames.get(actor.id)!,frames,2.28,false)!;
    expect(gaze.cheekLift).toBeCloseTo(1.8);
    expect(gaze.cheekWarmth).toBeCloseTo(.25);
    expect(cinematicFaceAt(project,scene,actor,frames.get(actor.id)!,frames,2.28,true))
      .toBeUndefined();
    project.visualStyle=undefined;
    expect(JSON.stringify(project)).toBe(saved);
  });
  it("respects a manually open recorded-speech mouth while retaining expressive cheeks",()=>{
    const {project,scene,actor}=fixture();
    project.visualStyle="storybook-cinematic";
    actor.animation!.keyframes[1].mouth="open";
    const original=JSON.stringify(project);
    const frames=sceneFramesAt(project,scene,2.28);
    expect(frames.get(actor.id)?.mouth).toBe("open");
    const svg=stage(project,scene,2.28);
    expect(svg).toContain('data-cinematic-cheek="animated"');
    expect(svg).not.toContain("data-cinematic-smile-crease");
    expect(JSON.stringify(project)).toBe(original);
    const face=cinematicFaceAt(project,scene,actor,frames.get(actor.id)!,frames,2.28,false)!;
    const character=project.characters.find(c=>c.id===actor.characterId)!;
    const open=renderToStaticMarkup(createElement(PuppetArt,{
      character,assets:project.assets,emotion:"excited",mouth:"open",
      voiceOpening:.7,premium:true,gaze:face,
    }));
    expect(open).toContain('data-cinematic-cheek="animated"');
    expect(open).not.toContain("data-cinematic-smile-crease");
    const classic=renderToStaticMarkup(createElement(PuppetArt,{
      character,assets:project.assets,emotion:"excited",mouth:"open",
      voiceOpening:.7,premium:false,gaze:face,
    }));
    expect(classic).not.toContain("data-cinematic-cheek");
  });
  it("honors artist-painted eyes instead of reinterpreting their face",()=>{
    const {project,scene,actor}=fixture();
    project.visualStyle="storybook-cinematic";
    const frame=sceneFramesAt(project,scene,2.28);
    const character=project.characters.find(c=>c.id===actor.characterId)!;
    const rig=character.puppet!;
    character.puppet={...rig,parts:[...rig.parts,{
      id:"painted-eyes",role:"eyes",parentId:"head",
      x:0,y:0,pivotX:0,pivotY:0,width:25,height:14,assetId:"artist-photo",
    }]};
    expect(cinematicFaceAt(project,scene,actor,frame.get(actor.id)!,frame,2.28,false))
      .toBeUndefined();
  });
});
