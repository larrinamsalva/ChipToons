import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { canStartFramefieldCinematicPush,
  framefieldCinematicTiltFrame, framefieldGentleCinematicTilt } from "./framefield-cinematic-push";
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

describe("optional cinematic up/down tilt across original PNG frames",()=>{
  it.each([
    ["up",190],["down",260],
  ] as const)("builds a protected %s camera move using the real Stage", (direction,y)=>{
    const p=fixture(),scene=p.scenes[0],before=JSON.stringify(p);
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(true);
    expect(framefieldCinematicTiltFrame(direction)).toEqual({x:400,y,zoom:1.25});
    const shot=framefieldGentleCinematicTilt(p,scene,direction);
    expect(shotIssue([shot],scene)).toBeUndefined();
    expect(shot).toMatchObject({style:"move",start:0,end:2,move:2,
      frame:{x:400,y,zoom:1.25},targets:[],follow:false});
    expect(JSON.stringify(p)).toBe(before);
    const approved=structuredClone(p);
    approved.scenes[0].cameraShots=[shot];
    expect(validateProject(approved)).toEqual(approved);
    const atStart=stageCameraAt(approved,approved.scenes[0],0);
    const atMiddle=stageCameraAt(approved,approved.scenes[0],1);
    const atEnd=stageCameraAt(approved,approved.scenes[0],1.999);
    expect(atStart).toMatchObject({x:400,y:225,zoom:1});
    expect(atMiddle.y).toBeGreaterThan(Math.min(y,225));
    expect(atMiddle.y).toBeLessThan(Math.max(y,225));
    expect(atMiddle.zoom).toBeGreaterThan(1);
    expect(atMiddle.zoom).toBeLessThan(1.25);
    expect(atEnd.y).toBeCloseTo(y,1);
    expect(atEnd.zoom).toBeGreaterThan(1.249);
    for(const t of [0,1,1.999]) {
      const sample=stageCameraAt(approved,approved.scenes[0],t);
      expect(inspectCameraArtworkCoverage(sample,t).edges).toEqual([]);
    }
    expect(cameraMotionArtworkSweep(approved,approved.scenes[0],shot).flaggedCount).toBe(0);
    const markup=renderToStaticMarkup(createElement(Stage,{
      project:approved,scene:approved.scenes[0],time:1,labelled:false,
    }));
    expect(markup).toContain('data-camera-shot="'+shot.id+'"');
    expect(markup).toContain('data-element-id="'+scene.elements[0].id+'"');
    expect(approved.scenes[1]).toEqual(p.scenes[1]);
    expect(approved.assets).toEqual(p.assets);
  });
  it("rejects direction mistakes and refuses to overwrite existing camera work",()=>{
    const p=fixture(),scene=p.scenes[0];
    expect(()=>framefieldCinematicTiltFrame("left" as "up")).toThrow(/up or down/);
    const shot=framefieldGentleCinematicTilt(p,scene,"up");
    scene.cameraShots=[shot];
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    expect(()=>framefieldGentleCinematicTilt(p,scene,"down")).toThrow(/without authored/);
    scene.cameraShots=undefined;
    scene.cameraAnimation={keyframes:[],followId:scene.elements[0].id};
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(false);
    const unrelated=starterProject();
    expect(canStartFramefieldCinematicPush(unrelated,unrelated.scenes[0])).toBe(false);
  });
});
