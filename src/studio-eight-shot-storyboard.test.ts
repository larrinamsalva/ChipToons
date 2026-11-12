import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it } from "vitest";
import type { Asset } from "./model";
import { validateProject } from "./model";
import { groupNumberedShots,projectFromFrameAssetShots } from "./studio-multishot";
import { planStoryReel,storyReelFrameAt } from "./studio-story-reel";
import { emptyShotBeat } from "./studio-shot-beats";
import { attachStoryboardCaptionDrafts } from "./studio-caption-import";
import { frameAt } from "./timeline";
import { frameSequenceAssetIdAt } from "./frame-sequence-model";
import { Stage } from "./components/Stage";

const originals=[
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=",
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGOUu2Tzn4GBgYGJAQoAIMoCL4mvtcwAAAAASUVORK5CYII=",
] as const;
const prefix=(i:number)=>"shot"+String(i+1).padStart(2,"0")+"_frame_";
const sourceFiles=(shots=8,framesPerShot=2)=>Array.from({length:shots},(_,i)=>
 Array.from({length:framesPerShot},(_,j)=>
  new File([new Uint8Array([0,1,2])],prefix(i)+String(j+1).padStart(4,"0")+".png",{type:"image/png"}),
 )).flat();
const asset=(i:number,j:number):Asset=>({
 id:"asset-"+i+"-"+j,
 name:prefix(i)+String(j+1).padStart(4,"0")+".png",
 type:"image",mime:"image/png",dataUrl:"data:image/png;base64,"+originals[j%2],
 sourceWidth:2,sourceHeight:2,
});
const imported=(shots=8,frames=2)=>Array.from({length:shots},(_,i)=>({
 prefix:prefix(i),assets:Array.from({length:frames},(_,j)=>asset(i,j)),
}));

describe("eight-shot real portable PNG storyboard",()=>{
 it("groups 8 shuffled numbered shots without increasing source asset limits",()=>{
  const files=sourceFiles();
  const sorted=groupNumberedShots([...files].reverse());
  expect(sorted).toHaveLength(8);
  expect(sorted.map(x=>x.prefix)).toEqual(Array.from({length:8},(_,i)=>prefix(i)));
  expect(sorted.every(shot=>shot.files.length===2)).toBe(true);
  expect(()=>groupNumberedShots(sourceFiles(9))).toThrow(/2–8 distinct shot/);
  expect(()=>groupNumberedShots(sourceFiles(8,6))).toThrow(/4–40/);
 });
 it("creates 8 independent real scenes, 8 exact reel cuts and original media/voice-free captions",()=>{
  const source=imported(),prior=JSON.stringify(source);
  const reversed=source.map(s=>({prefix:s.prefix,holdSeconds:0 as const})).reverse();
  const beats=source.map((shot,i)=>({
    ...emptyShotBeat(shot.prefix),
    title:"Learning moment "+(i+1),
    narration:"Scout learns step "+(i+1)+".",
  }));
  const project=projectFromFrameAssetShots(source,2,reversed,beats);
  expect(project.scenes).toHaveLength(8);
  expect(project.assets).toHaveLength(16);
  expect(project.title).toContain("8-shot");
  expect(project.scenes.map(s=>s.title)).toEqual(
    Array.from({length:8},(_,i)=>"Learning moment "+(8-i)));
  expect(project.scenes.map(s=>s.duration)).toEqual(Array(8).fill(2));
  expect(project.scenes.every(s=>s.transition==="cut")).toBe(true);
  const files=sourceFiles();
  const grouped=groupNumberedShots(files);
  const reel=planStoryReel(grouped,2,reversed);
  expect(reel.shots).toHaveLength(8);
  expect(reel.duration).toBe(16);
  for(let i=0;i<8;i++){
    const time=i*2+.7;
    const f=frameAt(project,time);
    expect(f.index).toBe(i);
    const chosen=project.assets[i*2+1];
    expect(frameSequenceAssetIdAt(f.scene.elements[0],f.localTime)).toBe(chosen.id);
    expect(storyReelFrameAt(reel,time).prefix).toBe(reversed[i].prefix);
    const svg=renderToStaticMarkup(createElement(Stage,{
      project,scene:f.scene,time:f.localTime,labelled:false,
    }));
    expect(svg).toContain('href="'+chosen.dataUrl+'"');
  }
  const captioned=attachStoryboardCaptionDrafts(
    project,reversed.map(s=>s.prefix),beats);
  expect(captioned.captions).toHaveLength(8);
  expect(captioned.captions.every((cue,i)=>cue.sceneId===captioned.scenes[i].id &&
    cue.start===0&&cue.end===2)).toBe(true);
  expect(captioned.audioClips).toHaveLength(0);
  expect(validateProject(captioned)).toEqual(captioned);
  expect(JSON.stringify(source)).toBe(prior);
  expect(project.captions).toEqual([]);
 });
 it("honors the unchanged 40-frame maximum with 8 scenes and rejects a 9th",()=>{
  const full=projectFromFrameAssetShots(imported(8,5),2);
  expect(full.scenes).toHaveLength(8);
  expect(full.assets).toHaveLength(40);
  expect(()=>projectFromFrameAssetShots(imported(9,2),2)).toThrow(/2–8/);
  expect(()=>projectFromFrameAssetShots(imported(8,6),2)).toThrow(/40 total/);
 });
});
