import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { framefieldGentleCinematicReveal, canStartFramefieldCinematicPush } from "./framefield-cinematic-push";
import { shotIssue } from "./camera-shots";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { stageCameraAt } from "./timeline";
import { starterProject } from "./planner";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Stage } from "./components/Stage";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset=(p:string,n:number):Asset=>({
  id:p+n,name:p+n+".png",type:"image",mime:"image/png",
  dataUrl:png,sourceWidth:2,sourceHeight:2,
});
const fixture=()=>projectFromFrameAssetShots([
  {prefix:"shot01_",assets:[asset("shot01_",1),asset("shot01_",2)]},
  {prefix:"shot02_",assets:[asset("shot02_",1),asset("shot02_",2)]},
],2);

describe("optional cinematic close-to-wide reveal",()=>{
  it("starts close, eases back, and preserves actual artwork and saved project until Apply",()=>{
    const p=fixture(),scene=p.scenes[0],before=JSON.stringify(p);
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(true);
    const shot=framefieldGentleCinematicReveal(p,scene);
    expect(JSON.stringify(p)).toBe(before);
    expect(shotIssue([shot],scene)).toBeUndefined();
    expect(shot).toMatchObject({style:"move",start:0,end:2,move:2,
      fromFrame:{x:400,y:225,zoom:1.45},frame:{x:400,y:225,zoom:1},targets:[]});
    const changed=structuredClone(p);
    changed.scenes[0].cameraShots=[shot];
    expect(validateProject(changed)).toEqual(changed);
    const initial=stageCameraAt(changed,changed.scenes[0],0);
    const middle=stageCameraAt(changed,changed.scenes[0],1);
    const nearEnd=stageCameraAt(changed,changed.scenes[0],1.999);
    expect(initial.zoom).toBeCloseTo(1.45);
    expect(middle.zoom).toBeGreaterThan(1);
    expect(middle.zoom).toBeLessThan(1.45);
    expect(nearEnd.zoom).toBeCloseTo(1,2);
    expect(changed.assets).toEqual(p.assets);
    expect(changed.scenes[1]).toEqual(p.scenes[1]);
    for(const time of [0,1,1.999]){
      const svg=renderToStaticMarkup(createElement(Stage,{
        project:changed,scene:changed.scenes[0],time,labelled:false,
      }));
      expect(svg).toContain('data-camera-shot="'+shot.id+'"');
      expect(svg).toContain('data-element-id="'+scene.elements[0].id+'"');
    }
  });
  it("rejects corrupt starting camera and existing authored shots",()=>{
    const p=fixture(),scene=p.scenes[0],shot=framefieldGentleCinematicReveal(p,scene);
    expect(shotIssue([{...shot,fromFrame:{x:400,y:225,zoom:3.5}}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,fromFrame:{x:900,y:225,zoom:1.45}}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,start:0.25}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,move:0}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,style:"wide"}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,targets:[scene.elements[0].id]}],scene)).toBeTruthy();
    expect(shotIssue([{...shot,fromFrame:{x:400,y:225,zoom:1.45,remote:1}}],scene)).toBeTruthy();
    scene.cameraShots=[shot];
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    expect(()=>framefieldGentleCinematicReveal(p,scene)).toThrow(/without authored/);
    const standard=starterProject();
    expect(canStartFramefieldCinematicPush(standard,standard.scenes[0])).toBe(false);
  });
});
