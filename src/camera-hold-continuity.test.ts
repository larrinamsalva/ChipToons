import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import type { Asset } from "./model";
import { CameraHoldReview } from "./components/CameraHoldReview";
import {
  cameraHoldContinuity, summarizeCameraHoldCheckpoints,
} from "./camera-hold-continuity";
import { framefieldGentleCinematicGlide,framefieldCinematicGlideFrame } from "./framefield-cinematic-push";
import { projectFromFrameAssetShots } from "./studio-multishot";

const png="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset=(p:string,n:number):Asset=>({
  id:p+n,name:p+n+".png",type:"image",mime:"image/png",
  dataUrl:png,sourceWidth:2,sourceHeight:2,
});
const fixture=()=>projectFromFrameAssetShots([
  {prefix:"shot01_",assets:[asset("shot01_",1),asset("shot01_",2)]},
  {prefix:"shot02_",assets:[asset("shot02_",1),asset("shot02_",2)]},
],2);

describe("read-only camera hold continuity checkpoints",()=>{
 it("uses five real camera samples and never mutates original PNG scenes",()=>{
  const original=fixture(),before=JSON.stringify(original),scene=original.scenes[0];
  const shot={...framefieldGentleCinematicGlide(original,scene,"down-right"),
    frame:framefieldCinematicGlideFrame("down-right","expressive"),move:1.5};
  const staged={...scene,cameraShots:[shot]};
  const project={...original,scenes:[staged,...original.scenes.slice(1)]};
  const result=cameraHoldContinuity(project,staged,shot)!;
  expect(result.samples).toHaveLength(5);
  expect(result.samples.map(s=>s.time)).toEqual([
    1.5,1.62375,1.7475,1.87125,1.995,
  ]);
  expect(result.samples.every(s=>s.zoom===1.4&&s.x===480&&s.y===270))
    .toBe(true);
  expect(result.summary).toEqual({
    changedFramingCount:0, captionTransitions:0,
    boundaryWarnings:0, inactiveShotCount:0,
  });
  const html=renderToStaticMarkup(createElement(CameraHoldReview,{
    project,scene:staged,shot,onInspectTime:()=>{},
  }));
  expect(html).toContain("Camera hold continuity checkpoints");
  expect(html).toContain("Camera framing stays steady at all 5 sampled moments.");
  expect(html).toContain("Inspect hold checkpoint 3");
  expect(html.match(/Inspect hold checkpoint /g)).toHaveLength(5);
  expect(html.match(/data-camera-zoom="1.4"/g)).toHaveLength(2);
  expect(JSON.stringify(original)).toBe(before);
  expect(project.scenes[1]).toEqual(original.scenes[1]);
  expect(project.assets).toEqual(original.assets);
 });
 it("flags camera drift, captions, canvas and missing selected shots without false approval",()=>{
  const samples=[
    {time:1,x:400,y:225,zoom:1.2,shotId:"s1",caption:"Hello",outsideEdges:[]},
    {time:1.2,x:400,y:225,zoom:1.2,shotId:"s1",caption:"Hello",outsideEdges:[]},
    {time:1.4,x:405,y:225,zoom:1.2,shotId:"s1",caption:"Next",outsideEdges:[]},
    {time:1.6,x:405,y:225,zoom:1.3,shotId:"other",caption:"Next",outsideEdges:["right"]},
    {time:1.8,x:405,y:225,zoom:1.3,shotId:"s1",caption:"Last",outsideEdges:[]},
  ];
  expect(summarizeCameraHoldCheckpoints(samples,"s1")).toEqual({
    changedFramingCount:3,captionTransitions:2,boundaryWarnings:1,inactiveShotCount:1,
  });
  expect(summarizeCameraHoldCheckpoints([],"s1")).toEqual({
    changedFramingCount:0,captionTransitions:0,boundaryWarnings:0,inactiveShotCount:0,
  });
 });
 it("hides continuity review when the camera has no held interval",()=>{
  const p=fixture(),scene=p.scenes[0];
  const shot=framefieldGentleCinematicGlide(p,scene,"up-left");
  expect(cameraHoldContinuity(p,scene,shot)).toBeUndefined();
 });
});
