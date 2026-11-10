import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import {
  canStartFramefieldCinematicPush,
  framefieldCinematicGlideFrame, framefieldGentleCinematicGlide,
} from "./framefield-cinematic-push";
import { inspectCameraArtworkCoverage, cameraMotionArtworkSweep } from "./camera-motion-framing";
import { shotIssue } from "./camera-shots";
import { Stage } from "./components/Stage";
import { starterProject } from "./planner";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { stageCameraAt } from "./timeline";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset=(p:string,n:number):Asset=>({
  id:p+n,name:p+n+".png",type:"image",mime:"image/png",
  dataUrl:png,sourceWidth:2,sourceHeight:2,
});
const fixture=()=>projectFromFrameAssetShots([
  {prefix:"shot01_",assets:[asset("shot01_",1),asset("shot01_",2)]},
  {prefix:"shot02_",assets:[asset("shot02_",1),asset("shot02_",2)]},
],2);

describe("optional diagonal cinematic glide over imported PNG storyboard frames",()=>{
  it.each([
    ["up-left",335,190],["up-right",465,190],
    ["down-left",335,260],["down-right",465,260],
  ] as const)("validates %s and samples real Stage motion with safe picture bounds",(direction,x,y)=>{
    const p=fixture(),scene=p.scenes[0],before=JSON.stringify(p);
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(true);
    expect(framefieldCinematicGlideFrame(direction)).toEqual({x,y,zoom:1.3});
    const shot=framefieldGentleCinematicGlide(p,scene,direction);
    expect(shotIssue([shot],scene)).toBeUndefined();
    expect(shot).toMatchObject({
      style:"move",start:0,end:2,move:2,
      frame:{x,y,zoom:1.3},targets:[],follow:false,
    });
    expect(JSON.stringify(p)).toBe(before);
    const changed=structuredClone(p);
    changed.scenes[0].cameraShots=[shot];
    expect(validateProject(changed)).toEqual(changed);
    const start=stageCameraAt(changed,changed.scenes[0],0);
    const mid=stageCameraAt(changed,changed.scenes[0],1);
    const end=stageCameraAt(changed,changed.scenes[0],1.999);
    expect(start).toMatchObject({x:400,y:225,zoom:1});
    expect(mid.x).toBeGreaterThan(Math.min(400,x));
    expect(mid.x).toBeLessThan(Math.max(400,x));
    expect(mid.y).toBeGreaterThan(Math.min(225,y));
    expect(mid.y).toBeLessThan(Math.max(225,y));
    expect(mid.zoom).toBeGreaterThan(1);
    expect(mid.zoom).toBeLessThan(1.3);
    expect(end.x).toBeCloseTo(x,1);
    expect(end.y).toBeCloseTo(y,1);
    expect(end.zoom).toBeGreaterThan(1.299);
    for (const t of [0,0.5,1,1.5,1.999]) {
      expect(inspectCameraArtworkCoverage(stageCameraAt(changed,changed.scenes[0],t),t).edges)
        .toEqual([]);
    }
    expect(cameraMotionArtworkSweep(changed,changed.scenes[0],shot).flaggedCount).toBe(0);
    const art=renderToStaticMarkup(createElement(Stage,{
      project:changed,scene:changed.scenes[0],time:1,labelled:false,
    }));
    expect(art).toContain('data-camera-shot="'+shot.id+'"');
    expect(art).toContain('data-element-id="'+scene.elements[0].id+'"');
    expect(changed.scenes[1]).toEqual(p.scenes[1]);
    expect(changed.assets).toEqual(p.assets);
  });
  it("rejects invalid directions or any existing saved camera work",()=>{
    const p=fixture(),scene=p.scenes[0];
    expect(()=>framefieldCinematicGlideFrame("sideways" as "up-left"))
      .toThrow(/valid diagonal/);
    const old=framefieldGentleCinematicGlide(p,scene,"up-left");
    scene.cameraShots=[old];
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    expect(()=>framefieldGentleCinematicGlide(p,scene,"down-right"))
      .toThrow(/without authored/);
    scene.cameraShots=undefined;
    scene.cameraAnimation={keyframes:[],followId:scene.elements[0].id};
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    const normal=starterProject();
    expect(canStartFramefieldCinematicPush(normal,normal.scenes[0])).toBe(false);
  });
});
