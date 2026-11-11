import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { framefieldGentleCinematicGlide, framefieldCinematicGlideFrame,
  framefieldGlideMoveDuration, framefieldGlidePacingOf } from "./framefield-cinematic-push";
import { inspectCameraArtworkCoverage, cameraMotionArtworkSweep } from "./camera-motion-framing";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { shotIssue } from "./camera-shots";
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

describe("real diagonal PNG camera pacing with end-frame hold",()=>{
  it.each([
    ["continuous",2],["settle-early",1.5],["quick-reveal",1],
  ] as const)("%s reuses the real move duration and safely holds its final view",(pacing,move)=>{
    const p=fixture(),before=JSON.stringify(p),scene=p.scenes[0];
    const shot={...framefieldGentleCinematicGlide(p,scene,"down-right"),
      frame:framefieldCinematicGlideFrame("down-right","expressive"),
      move:framefieldGlideMoveDuration(scene.duration,pacing)};
    expect(shot.move).toBe(move);
    expect(framefieldGlidePacingOf(move,scene.duration)).toBe(pacing);
    expect(shotIssue([shot],scene)).toBeUndefined();
    const changed={...p,scenes:[{...scene,cameraShots:[shot]},...p.scenes.slice(1)]};
    expect(validateProject(changed)).toEqual(changed);
    const staged=changed.scenes[0];
    const beforeFinish=stageCameraAt(changed,staged,move/2);
    const finished=stageCameraAt(changed,staged,move);
    const nearEnd=stageCameraAt(changed,staged,scene.duration-.001);
    expect(beforeFinish.zoom).toBeGreaterThan(1);
    expect(beforeFinish.zoom).toBeLessThan(1.4);
    expect(finished).toMatchObject({x:480,y:270,zoom:1.4});
    expect(nearEnd).toMatchObject({x:480,y:270,zoom:1.4});
    expect(cameraMotionArtworkSweep(changed,staged,shot).flaggedCount).toBe(0);
    for(const t of [0,.25,.5,1,1.5,1.999]){
      expect(inspectCameraArtworkCoverage(stageCameraAt(changed,staged,t)).edges).toEqual([]);
    }
    expect(changed.scenes[1]).toEqual(p.scenes[1]);
    expect(changed.assets).toEqual(p.assets);
    expect(JSON.stringify(p)).toBe(before);
  });
  it("does not guess an unmatched manual duration or allow invalid pacing",()=>{
    expect(framefieldGlidePacingOf(1.23,2)).toBe("custom");
    expect(framefieldGlidePacingOf(Number.NaN,2)).toBe("custom");
    expect(framefieldGlideMoveDuration(2,"settle-early")).toBe(1.5);
    expect(framefieldGlideMoveDuration(.005,"quick-reveal")).toBe(.005);
    expect(()=>framefieldGlideMoveDuration(2,"unknown" as "continuous"))
      .toThrow(/valid diagonal glide pacing/);
    expect(()=>framefieldGlideMoveDuration(0,"continuous"))
      .toThrow(/positive cinematic scene duration/);
  });
});
