import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { framefieldCinematicGlideFrame, framefieldGentleCinematicGlide,
  framefieldGlideIntensityOf, canStartFramefieldCinematicPush } from "./framefield-cinematic-push";
import { cameraMotionArtworkSweep, inspectCameraArtworkCoverage } from "./camera-motion-framing";
import { shotIssue } from "./camera-shots";
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

describe("optional intensity of reviewed PNG cinematic diagonal glide",()=>{
  it.each([
    ["subtle",1.2,45,24],
    ["balanced",1.3,65,35],
    ["expressive",1.4,80,45],
  ] as const)("%s preserves real original artwork in all four directions", (intensity, zoom, horizontal, vertical)=>{
    const p=fixture(),before=JSON.stringify(p),scene=p.scenes[0];
    expect(canStartFramefieldCinematicPush(p,scene)).toBe(true);
    for(const direction of ["up-left","up-right","down-left","down-right"] as const){
      const frame=framefieldCinematicGlideFrame(direction,intensity);
      expect(frame).toEqual({
        x:400+(direction.endsWith("left")?-horizontal:horizontal),
        y:225+(direction.startsWith("up")?-vertical:vertical),
        zoom,
      });
      expect(framefieldGlideIntensityOf(zoom)).toBe(intensity);
      const shot={...framefieldGentleCinematicGlide(p,scene,direction),frame};
      expect(shotIssue([shot],scene)).toBeUndefined();
      const staged={...scene,cameraShots:[shot]};
      const proposed={...p,scenes:[staged,...p.scenes.slice(1)]};
      expect(validateProject(proposed)).toEqual(proposed);
      expect(cameraMotionArtworkSweep(proposed,staged,shot).flaggedCount).toBe(0);
      const atStart=stageCameraAt(proposed,staged,0);
      const mid=stageCameraAt(proposed,staged,1);
      const end=stageCameraAt(proposed,staged,1.999);
      expect(atStart.zoom).toBe(1);
      expect(mid.zoom).toBeGreaterThan(1);
      expect(mid.zoom).toBeLessThan(zoom);
      expect(end.zoom).toBeGreaterThan(zoom-0.001);
      for(const at of [0,0.1,0.5,1,1.5,1.999]){
        expect(inspectCameraArtworkCoverage(stageCameraAt(proposed,staged,at)).edges)
          .toEqual([]);
      }
      expect(proposed.assets).toEqual(p.assets);
      expect(proposed.scenes[1]).toEqual(p.scenes[1]);
    }
    expect(JSON.stringify(p)).toBe(before);
  });
  it("rejects nonsense and preserves the previous balanced default",()=>{
    expect(framefieldCinematicGlideFrame("up-left"))
      .toEqual({x:335,y:190,zoom:1.3});
    expect(()=>framefieldCinematicGlideFrame("sideways" as "up-left"))
      .toThrow(/direction/);
    expect(()=>framefieldCinematicGlideFrame("up-left","extreme" as "expressive"))
      .toThrow(/intensity/);
  });
});
