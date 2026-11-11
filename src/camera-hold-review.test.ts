import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import type { Asset } from "./model";
import { CameraHoldReview } from "./components/CameraHoldReview";
import { framefieldGentleCinematicGlide,framefieldCinematicGlideFrame } from "./framefield-cinematic-push";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { stageCameraAt } from "./timeline";
import { inspectCameraArtworkCoverage } from "./camera-motion-framing";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset=(p:string,n:number):Asset=>({
  id:p+n,name:p+n+".png",type:"image",mime:"image/png",
  dataUrl:png,sourceWidth:2,sourceHeight:2,
});
const fixture=()=>projectFromFrameAssetShots([
  {prefix:"shot01_",assets:[asset("shot01_",1),asset("shot01_",2)]},
  {prefix:"shot02_",assets:[asset("shot02_",1),asset("shot02_",2)]},
],2);

describe("read-only real Stage camera hold storyboard",()=>{
 it("shows the identical camera position at settle and near shot end",()=>{
  const p=fixture(),source=JSON.stringify(p),scene=p.scenes[0];
  const shot={...framefieldGentleCinematicGlide(p,scene,"down-right"),
    frame:framefieldCinematicGlideFrame("down-right","expressive"),move:1.5};
  const staged={...scene,cameraShots:[shot]};
  const project={...p,scenes:[staged,...p.scenes.slice(1)]};
  const atFinish=stageCameraAt(project,staged,1.5);
  const atEnd=stageCameraAt(project,staged,1.995);
  expect(atFinish).toMatchObject({x:480,y:270,zoom:1.4});
  expect(atEnd).toMatchObject({x:480,y:270,zoom:1.4});
  expect(inspectCameraArtworkCoverage(atFinish).edges).toEqual([]);
  expect(inspectCameraArtworkCoverage(atEnd).edges).toEqual([]);
  const svg=renderToStaticMarkup(createElement(CameraHoldReview,{
    project,scene:staged,shot,onInspectTime:()=>{},
  }));
  expect(svg).toContain("Camera settles frame");
  expect(svg).toContain("Near shot end frame");
  expect(svg).toContain("1.50s into scene");
  expect(svg).toContain("2.00s into scene");
  expect(svg.match(/data-camera-shot=/g)).toHaveLength(2);
  expect(svg.match(/data-camera-zoom="1.4"/g)).toHaveLength(2);
  expect(svg).toContain("Inspect camera settles in preview");
  expect(svg).toContain("Inspect near shot end in preview");
  expect(JSON.stringify(p)).toBe(source);
  expect(project.assets).toEqual(p.assets);
  expect(project.scenes[1]).toEqual(p.scenes[1]);
 });
 it("does not show misleading hold pictures for a continuous move",()=>{
  const p=fixture(),scene=p.scenes[0],shot=framefieldGentleCinematicGlide(p,scene,"up-left");
  expect(renderToStaticMarkup(createElement(CameraHoldReview,{
    project:p,scene,shot,
  }))).toBe("");
 });
});
