import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import type { Asset } from "./model";
import { CameraHoldReview } from "./components/CameraHoldReview";
import { cameraHoldCaptionChanges } from "./camera-hold-caption-changes";
import { cameraHoldContinuity } from "./camera-hold-continuity";
import { framefieldGentleCinematicGlide } from "./framefield-cinematic-push";
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

describe("exact timed captions during a real Stage camera hold",()=>{
  it("finds brief captions missed by five checkpoints and preserves original data",()=>{
    const source=fixture(),before=JSON.stringify(source),scene=source.scenes[0];
    const shot={...framefieldGentleCinematicGlide(source,scene,"up-left"),move:1.5};
    const staged={...scene,cameraShots:[shot]};
    const project={...source,scenes:[staged,...source.scenes.slice(1)],captions:[
      {id:"a",sceneId:scene.id,start:1.4,end:1.58,text:"First"},
      {id:"b",sceneId:scene.id,start:1.58,end:1.62,text:"Second"},
      {id:"c",sceneId:scene.id,start:1.62,end:1.66,text:"Third"},
      {id:"d",sceneId:scene.id,start:1.66,end:1.9,text:"Fourth"},
      {id:"e",sceneId:scene.id,start:1.9,end:2,text:"Fifth"},
      {id:"other",sceneId:source.scenes[1].id,start:0,end:2,text:"Other scene"},
    ]};
    const exact=cameraHoldCaptionChanges(project,staged,shot)!;
    expect(exact.startingCaption).toBe("First");
    expect(exact.changes.map(c=>[c.time,c.after])).toEqual([
      [1.58,"Second"],[1.62,"Third"],[1.66,"Fourth"],[1.9,"Fifth"],
    ]);
    const five=cameraHoldContinuity(project,staged,shot)!;
    expect(five.summary.captionTransitions).toBeLessThan(exact.changes.length);
    const html=renderToStaticMarkup(createElement(CameraHoldReview,{
      project,scene:staged,shot,onInspectTime:()=>{},
    }));
    expect(html).toContain("Exact caption changes during hold");
    expect(html).toContain("4 actual caption change(s) detected");
    expect(html).toContain('option value="1.62"');
    expect(html).not.toContain("Other scene");
    expect(JSON.stringify(source)).toBe(before);
    expect(project.assets).toEqual(source.assets);
    expect(project.scenes[1]).toEqual(source.scenes[1]);
  });
  it("handles simultaneous cues, overlap, identical wording and disappearance exactly",()=>{
    const p=fixture(),scene=p.scenes[0];
    const shot={...framefieldGentleCinematicGlide(p,scene,"up-left"),move:1.5};
    const project={...p,captions:[
      {id:"a",sceneId:scene.id,start:1.3,end:2,text:"A"},
      {id:"b",sceneId:scene.id,start:1.6,end:1.7,text:"B"},
      {id:"c",sceneId:scene.id,start:1.7,end:1.75,text:"B"},
      {id:"d",sceneId:scene.id,start:1.9,end:2,text:"D"},
      {id:"after",sceneId:scene.id,start:2,end:2.2,text:"Outside"},
    ]};
    const result=cameraHoldCaptionChanges(project,scene,shot)!;
    expect(result.startingCaption).toBe("A");
    expect(result.changes.map(c=>[c.time,c.after])).toEqual([
      [1.6,"A\\nB"],[1.9,"A\\nD"],
    ]);
    expect(result.changes.some(c=>c.time===2)).toBe(false);
  });
  it("doesn't invent events for no captions or no final hold",()=>{
    const p=fixture(),scene=p.scenes[0];
    const moving=framefieldGentleCinematicGlide(p,scene,"up-left");
    expect(cameraHoldCaptionChanges(p,scene,moving)).toBeUndefined();
    const held={...moving,move:1.5};
    expect(cameraHoldCaptionChanges(p,scene,held)?.changes).toEqual([]);
    const html=renderToStaticMarkup(createElement(CameraHoldReview,{
      project:p,scene:{...scene,cameraShots:[held]},shot:held,
    }));
    expect(html).toContain("No timed caption changes occur during this camera hold.");
  });
});
