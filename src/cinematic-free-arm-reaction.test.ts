import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicFreeArmReactionAt } from "./cinematic-free-arm-reaction";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { elementAt, elementBase, sceneElementAt, sceneFramesAt } from "./timeline";
import { Stage } from "./components/Stage";
import { neutralJoint } from "./puppet-model";

function fixture() {
  const project=littleFixersFullBodyPilot(), scene=project.scenes[0];
  const actor=scene.elements.find(item=>item.characterId)!;
  actor.emotion="calm";
  actor.motion="still";
  const initial=elementBase(actor);
  actor.animation={blink:false,idle:"none",keyframes:[
    {...initial,id:"relaxed",time:0,easing:"linear",emotion:"calm"},
    {...initial,id:"joy",time:2,easing:"linear",emotion:"excited"},
    {...initial,id:"unsure",time:4,easing:"linear",emotion:"worried"},
  ]};
  const rig=project.characters.find(c=>c.id===actor.characterId)!.puppet!;
  return {project,scene,actor,rig};
}

describe("PR #96 free-arm emotional acting",()=>{
  it("adds matched bounded arm rotations only for real emotion changes, then settles",()=>{
    const {project,scene,actor,rig}=fixture();
    const before=JSON.stringify(project);
    const raw=elementAt(actor,2.28,scene.duration);
    expect(cinematicFreeArmReactionAt(scene,actor,rig,raw,1.5)).toBeUndefined();
    expect(cinematicFreeArmReactionAt(scene,actor,rig,raw,2.8)).toBeUndefined();
    const response=cinematicFreeArmReactionAt(scene,actor,rig,raw,2.28)!;
    expect(response.leftArm.angle).toBeCloseTo(2.5);
    expect(response.rightArm.angle).toBeCloseTo(-2.5);
    expect(response.leftArm.x).toBe(0);
    expect(response.rightArm.x).toBe(0);
    expect(cinematicEmotionReactionAt(actor,2.28)?.headTilt).toBeCloseTo(1.7);
    for(let i=0;i<200;i++){
      const joints=cinematicFreeArmReactionAt(scene,actor,rig,raw,i*.025);
      if(!joints)continue;
      expect(Math.abs(joints.leftArm.angle)).toBeLessThanOrEqual(2.5);
      expect(joints.rightArm.angle).toBeCloseTo(-joints.leftArm.angle);
    }
    expect(JSON.stringify(project)).toBe(before);
  });
  it("uses the real Stage frame only in cinematic mode without touching saved artwork",()=>{
    const {project,scene,actor}=fixture();
    const before=JSON.stringify(project);
    const classic=sceneElementAt(project,scene,actor,2.28,0);
    expect(classic.joints?.leftArm).toBeUndefined();
    project.visualStyle="storybook-cinematic";
    const frame=sceneElementAt(project,scene,actor,2.28,0);
    expect(frame.joints?.leftArm?.angle).toBeCloseTo(2.5);
    expect(frame.joints?.rightArm?.angle).toBeCloseTo(-2.5);
    expect(frame.x).toBeCloseTo(classic.x);
    expect(frame.emotion).toBe(classic.emotion);
    expect(frame.mouth).toBe(classic.mouth);
    expect(frame.voiceOpening).toBe(classic.voiceOpening);
    expect(sceneFramesAt(project,scene,2.28).get(actor.id)).toEqual(frame);
    expect(sceneElementAt(project,scene,actor,2.28,0)).toEqual(frame);
    const rendered=renderToStaticMarkup(createElement(Stage,{
      project,scene,time:2.28,labelled:false,
    }));
    expect(rendered).toContain("data-puppet");
    expect(rendered).toContain("data-puppet-finish");
    const settled=sceneElementAt(project,scene,actor,2.8,0);
    expect(settled.joints?.leftArm).toBeUndefined();
    expect(settled.joints?.rightArm).toBeUndefined();
    const calm=sceneElementAt(project,scene,actor,2.28,0,true);
    expect(calm.joints?.leftArm).toBeUndefined();
    expect(calm.joints?.rightArm).toBeUndefined();
    project.visualStyle=undefined;
    expect(JSON.stringify(project)).toBe(before);
  });
  it("keeps authored arm choreography, original gestures and props under creator control",()=>{
    const {project,scene,actor,rig}=fixture();
    const key=actor.animation!.keyframes[1];
    key.joints={leftArm:{...neutralJoint,angle:20}};
    let raw=elementAt(actor,2.28,scene.duration);
    const response=cinematicFreeArmReactionAt(scene,actor,rig,raw,2.28)!;
    expect(response.leftArm?.angle).toBe(raw.joints?.leftArm?.angle);
    expect(response.rightArm.angle).toBeCloseTo(-2.5);
    // A performed interaction anywhere in the scene disables automatic
    // arm shaping, even outside its hold interval.
    const handling={...scene,interactions:[{
      id:"repair-prop",kind:"point" as const,actorId:actor.id,
      objectId:"toolbox",start:7,attach:7.1,finish:8,
      grip:{hand:"right" as const,x:0,y:0},
    }]};
    expect(cinematicFreeArmReactionAt(handling,actor,rig,raw,2.28)).toBeUndefined();
    project.visualStyle="storybook-cinematic";
    const actual=sceneElementAt(project,handling,actor,2.28,0);
    expect(actual.joints?.leftArm?.angle).toBe(raw.joints?.leftArm?.angle);
    expect(actual.joints?.rightArm).toBeUndefined();
    const recipient={...handling,interactions:[{
      ...handling.interactions[0],actorId:"someone-else",
      transfer:{time:7.5,actorId:actor.id,grip:{hand:"left" as const,x:0,y:0}},
    }]};
    expect(cinematicFreeArmReactionAt(recipient,actor,rig,raw,2.28)).toBeUndefined();
    raw={...raw,gesture:"wave"};
    expect(cinematicFreeArmReactionAt(scene,actor,rig,raw,2.28)).toBeUndefined();
  });
  it("falls back on image-backed, incomplete or absent limbs",()=>{
    const {scene,actor,rig}=fixture();
    const raw=elementAt(actor,2.28,scene.duration);
    const altered={...rig,parts:rig.parts.map(part=>
      part.role==="leftArm"?{...part,assetId:"painted-arm"}:part)};
    expect(cinematicFreeArmReactionAt(scene,actor,altered,raw,2.28)?.leftArm)
      .toBeUndefined();
    expect(cinematicFreeArmReactionAt(scene,actor,altered,raw,2.28)?.rightArm)
      .toBeDefined();
    const noArms={...rig,parts:rig.parts.filter(p=>
      p.role!=="leftArm"&&p.role!=="rightArm")};
    expect(cinematicFreeArmReactionAt(scene,actor,noArms,raw,2.28))
      .toBeUndefined();
    expect(cinematicFreeArmReactionAt(undefined,actor,rig,raw,2.28))
      .toBeUndefined();
    expect(cinematicFreeArmReactionAt(scene,actor,rig,raw,Number.NaN))
      .toBeUndefined();
    expect(cinematicFreeArmReactionAt(scene,actor,rig,raw,-1))
      .toBeUndefined();
  });
});
