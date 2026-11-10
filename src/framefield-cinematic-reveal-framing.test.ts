import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { shotIssue } from "./camera-shots";
import {
  framefieldRevealStartingView, framefieldRevealFocusOf,
  framefieldGentleCinematicReveal,
} from "./framefield-cinematic-push";
import { stageCameraAt } from "./timeline";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset=(p:string,n:number):Asset=>({
  id:p+n,name:p+n+".png",type:"image",mime:"image/png",
  dataUrl:png,sourceWidth:2,sourceHeight:2,
});
function fixture(){
 return projectFromFrameAssetShots([
  {prefix:"shot01_",assets:[asset("shot01_",1),asset("shot01_",2)]},
  {prefix:"shot02_",assets:[asset("shot02_",1),asset("shot02_",2)]},
 ],2);
}
describe("Cinematic reveal creator-controlled starting view",()=>{
  it.each([
    ["left",1.15],["center",1.45],["right",1.65],["left",1.85],
  ] as const)("keeps %s crop inside original artwork at %s zoom", (focus,zoom)=>{
    const view=framefieldRevealStartingView(zoom,focus);
    const halfWidth=400/zoom;
    expect(view.x-halfWidth).toBeGreaterThanOrEqual(0);
    expect(view.x+halfWidth).toBeLessThanOrEqual(800);
    expect(view.y-225/zoom).toBeGreaterThanOrEqual(0);
    expect(view.y+225/zoom).toBeLessThanOrEqual(450);
    expect(framefieldRevealFocusOf(view)).toBe(focus);
    const p=fixture(),before=JSON.stringify(p);
    const shot={...framefieldGentleCinematicReveal(p,p.scenes[0]),fromFrame:view};
    expect(shotIssue([shot],p.scenes[0])).toBeUndefined();
    expect(JSON.stringify(p)).toBe(before);
    const next=structuredClone(p);
    next.scenes[0].cameraShots=[shot];
    expect(validateProject(next)).toEqual(next);
    expect(stageCameraAt(next,next.scenes[0],0)).toMatchObject({...view,shotId:shot.id});
    const middle=stageCameraAt(next,next.scenes[0],1);
    expect(middle.zoom).toBeGreaterThan(1);
    expect(middle.zoom).toBeLessThan(zoom);
    expect(next.scenes[1]).toEqual(p.scenes[1]);
    expect(next.assets).toEqual(p.assets);
  });
  it("rejects invalid strengths and directions before a camera edit",()=>{
    for(const value of [Number.NaN,Infinity,1.05,2.5])
      expect(()=>framefieldRevealStartingView(value)).toThrow(/valid cinematic/);
    expect(()=>framefieldRevealStartingView(1.45,"up" as "left")).toThrow(/valid cinematic/);
    expect(framefieldRevealStartingView(1.45)).toEqual({x:400,y:225,zoom:1.45});
  });
});
