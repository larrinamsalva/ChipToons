import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicEyelidClosureAt } from "./cinematic-eyelid-motion";
import { cinematicFaceAt } from "./cinematic-face";
import { PuppetArt } from "./components/PuppetArt";
import { Stage } from "./components/Stage";
import { littleFixersFullBodyPilot } from "./little-fixers-full-body-pilot";
import { sceneFramesAt } from "./timeline";

const actor = { id: "scout-natural-blink" };

describe("PR #98 cinematic eyelid transitions", () => {
  it("eases open/shut/open deterministically without adding random blink events",()=>{
    const samples=Array.from({length:5800},(_,i)=>({
      time:i*.002,
      value:cinematicEyelidClosureAt(actor,i*.002),
    }));
    const peak=samples.find(item=>item.value>=.999);
    expect(peak).toBeDefined();
    expect(samples.some(item=>item.value>.15&&item.value<.85)).toBe(true);
    expect(samples.every(item=>item.value>=0&&item.value<=1)).toBe(true);
    const initial=peak!.time;
    const approaching=samples.filter(s=>s.time>initial-.12&&s.time<initial-.015);
    const opening=samples.filter(s=>s.time>initial+.085&&s.time<initial+.2);
    expect(approaching.some(s=>s.value>0&&s.value<1)).toBe(true);
    expect(opening.some(s=>s.value<.99)).toBe(true);
    for(const sample of samples.filter((_,index)=>index%13===0)){
      expect(cinematicEyelidClosureAt(actor,sample.time)).toBe(sample.value);
    }
    expect(cinematicEyelidClosureAt(actor,Number.NaN)).toBe(0);
    expect(cinematicEyelidClosureAt(actor,-1)).toBe(0);
    expect(cinematicEyelidClosureAt({...actor,animation:{
      blink:false,idle:"none" as const,keyframes:[],
    }},initial)).toBe(0);
  });
  it("produces a real intermediate eyelid path in the Stage without editing the cartoon",()=>{
    const project=littleFixersFullBodyPilot();
    const scene=project.scenes[0];
    const host=scene.elements.find(element=>element.characterId)!;
    const original=JSON.stringify(project);
    // Choose the sampled intermediate part of a real character's original
    // blink instead of relying on a randomized character ID phase.
    const sample=Array.from({length:3200},(_,i)=>i*.005)
      .find(t=>{
        const v=cinematicEyelidClosureAt(host,t);
        return v>.35&&v<.65;
      });
    expect(sample).toBeDefined();
    const time=sample!;
    const classic=renderToStaticMarkup(createElement(Stage,{
      project,scene,time,labelled:false,
    }));
    expect(classic).not.toContain("data-cinematic-blink-transition");
    project.visualStyle="storybook-cinematic";
    const frames=sceneFramesAt(project,scene,time);
    const face=cinematicFaceAt(
      project,scene,host,frames.get(host.id)!,frames,time,false,
    )!;
    expect(face.eyelidClosure).toBeGreaterThan(.35);
    expect(face.eyelidClosure).toBeLessThan(.65);
    expect(face.blink).toBe(false);
    const cinematic=renderToStaticMarkup(createElement(Stage,{
      project,scene,time,labelled:false,
    }));
    expect(cinematic).toContain('data-cinematic-blink-transition="true"');
    expect(renderToStaticMarkup(createElement(Stage,{
      project,scene,time,labelled:false,
    }))).toBe(cinematic);
    const calm=cinematicFaceAt(
      project,scene,host,frames.get(host.id)!,frames,time,true,
    );
    expect(calm).toBeUndefined();
    const noBlink={...host,animation:{...host.animation!,blink:false}};
    expect(cinematicFaceAt(project,scene,noBlink,
      frames.get(host.id)!,frames,time,false)?.eyelidClosure).toBe(0);
    project.visualStyle=undefined;
    expect(JSON.stringify(project)).toBe(original);
  });
  it("preserves original talking mouth, Classic eyes and real user-drawn eye artwork",()=>{
    const project=littleFixersFullBodyPilot();
    const character=project.characters[0];
    const animated=renderToStaticMarkup(createElement(PuppetArt,{
      character,assets:project.assets,emotion:"happy",mouth:"open",
      voiceOpening:.8,premium:true,blink:false,
      gaze:{x:0,y:0,brow:0,blink:false,eyelidClosure:.5},
    }));
    expect(animated).toContain('data-cinematic-blink-transition="true"');
    expect(animated).toContain('cy="15"');
    const classic=renderToStaticMarkup(createElement(PuppetArt,{
      character,assets:project.assets,emotion:"happy",mouth:"open",
      voiceOpening:.8,premium:false,blink:false,
      gaze:{x:0,y:0,brow:0,blink:false,eyelidClosure:.5},
    }));
    expect(classic).not.toContain("data-cinematic-blink-transition");
    const shut=renderToStaticMarkup(createElement(PuppetArt,{
      character,assets:project.assets,emotion:"happy",mouth:"smile",
      premium:true,blink:true,
      gaze:{x:0,y:0,brow:0,blink:true,eyelidClosure:1},
    }));
    expect(shut).toContain("M-19 -2h8");
    expect(shut).not.toContain('data-eye-highlight="premium"');
    project.visualStyle="storybook-cinematic";
    const scene=project.scenes[0],host=scene.elements.find(e=>e.characterId)!;
    const frames=sceneFramesAt(project,scene,2);
    character.puppet={...character.puppet!,parts:[
      ...character.puppet!.parts,{
        id:"painted-eyes",role:"eyes",parentId:"head",
        x:0,y:0,pivotX:0,pivotY:0,width:25,height:14,assetId:"painted",
      },
    ]};
    expect(cinematicFaceAt(project,scene,host,
      frames.get(host.id)!,frames,2,false)).toBeUndefined();
  });
});
