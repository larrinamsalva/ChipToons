import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { planStory, DEFAULT_IDEA } from "./planner";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { elementBase, sceneElementAt, sceneFramesAt } from "./timeline";
import { sunnyRig, neutralJoint } from "./puppet-model";
import { voiceMouthAt } from "./voice-mouth";
import { cinematicVoiceHeadAt } from "./cinematic-voice-head";
import { Stage } from "./components/Stage";
import type { VoiceMouthTrack } from "./voice-mouth-model";

function fixture() {
  const project = planStory({ ...DEFAULT_IDEA, idea: "Help my little friend learn to speak clearly." });
  const scene = project.scenes[0], actor = scene.elements[0];
  const character = project.characters.find(c => c.id === actor.characterId)!;
  character.puppet = sunnyRig();
  actor.motion = "still";
  actor.emotion = "happy";
  const source = builtInSound("melody");
  const clip = {
    ...newAudioClip(project, source, "dialogue", 0, .6),
    duration: 4, trimStart: 0, trimEnd: 4,
    characterId: actor.characterId, volume: 1,
  };
  project.audioAssets = [source];
  project.audioClips = [clip];
  const track: VoiceMouthTrack = {
    clipId: clip.id, sourceId: source.id, speakerId: actor.characterId,
    trimStart: 0, trimEnd: 4, levels: "ff".repeat(100),
    start: 0, end: 4, delay: 0, preset: "normal",
    sensitivity: 1, minimum: .08, maximum: .82,
    expression: "keep", replaceManual: false, corrections: [],
  };
  actor.voiceMouth = [track];
  project.visualStyle = "storybook-cinematic";
  const original = JSON.stringify(project);
  const withoutVoice = { ...actor, voiceMouth: undefined };
  return {project,scene,actor,character,track,clip,withoutVoice,original};
}

describe("PR #99 genuine voice-paced cinematic head acting",()=>{
  it("adds a bounded spoken response from approved recorded-voice mouth values, not new audio",()=>{
    const {project,scene,actor,withoutVoice,original}=fixture();
    const times = [1.1,1.23,1.4,1.6,1.83,2.01,2.2,2.45,2.7];
    const deltas = times.map(time=>{
      const talking = sceneElementAt(project,scene,actor,time,0);
      const quiet = sceneElementAt(project,scene,withoutVoice,time,0);
      const approved = voiceMouthAt(project,scene,actor,time,false)!;
      expect(talking.voiceOpening).toBe(approved.opening);
      expect(talking.mouth).toBe("open");
      expect(talking.x).toBeCloseTo(quiet.x);
      expect(talking.y).toBeCloseTo(quiet.y);
      expect(talking.rotation).toBeCloseTo(quiet.rotation);
      const difference=(talking.joints?.head?.angle??0)-(quiet.joints?.head?.angle??0);
      expect(Math.abs(difference)).toBeLessThanOrEqual(1.05);
      expect(sceneElementAt(project,scene,actor,time,0)).toEqual(talking);
      return Math.abs(difference);
    });
    expect(Math.max(...deltas)).toBeGreaterThan(.12);
    const frame=sceneFramesAt(project,scene,1.4).get(actor.id)!;
    expect(frame).toEqual(sceneElementAt(project,scene,actor,1.4,0));
    const rendered=renderToStaticMarkup(createElement(Stage,{
      project,scene,time:1.4,labelled:false,
    }));
    expect(rendered).toContain("data-puppet");
    expect(JSON.stringify(project)).toBe(original);
  });
  it("honors silence, muted voices and changed/removed recordings",()=>{
    const {project,scene,actor,withoutVoice,track,clip}=fixture();
    const time=1.4;
    const original=sceneElementAt(project,scene,withoutVoice,time,0);
    actor.voiceMouth=[{...track, levels:"00".repeat(100)}];
    const silent=sceneElementAt(project,scene,actor,time,0);
    expect(silent.voiceOpening).toBe(0);
    expect(silent.joints).toEqual(original.joints);
    actor.voiceMouth=[track];
    project.mixer={...project.mixer,muted:true};
    const muted=sceneElementAt(project,scene,actor,time,0);
    expect(muted.voiceOpening).toBe(0);
    expect(muted.joints).toEqual(original.joints);
    project.mixer={...project.mixer,muted:false};
    for (const bad of [
      { ...clip, assetId:"missing-original" },
      { ...clip, trimStart:.2 },
    ]) {
      project.audioClips=[bad];
      const stale=sceneElementAt(project,scene,actor,time,0);
      expect(stale.voiceOpening).toBeUndefined();
      expect(stale.joints).toEqual(original.joints);
    }
    project.audioClips=[];
    expect(sceneElementAt(project,scene,actor,time,0).joints)
      .toEqual(original.joints);
  });
  it("preserves creator-authored heads, active gestures and scripted interactions",()=>{
    const {project,scene,actor,withoutVoice}=fixture();
    const head={...neutralJoint,angle:16};
    actor.animation={blink:true,idle:"none",keyframes:[{
      ...elementBase(actor),id:"original-head-performance",
      time:0,easing:"linear",joints:{head},
    }]};
    const time=1.4;
    expect(sceneElementAt(project,scene,actor,time,0).joints?.head)
      .toEqual(sceneElementAt(project,scene,withoutVoice,time,0).joints?.head);
    actor.animation=undefined;
    const interaction={id:"prop-action",kind:"point" as const,
      actorId:actor.id,objectId:"prop",start:4,attach:4.1,finish:5,
      grip:{hand:"right" as const,x:0,y:0}};
    const handled={...scene,interactions:[interaction]};
    const active=sceneElementAt(project,handled,actor,time,0);
    const baseline=sceneElementAt(project,handled,withoutVoice,time,0);
    expect(active.joints?.head).toEqual(baseline.joints?.head);
    const receiving={...scene,interactions:[{
      ...interaction,actorId:"someone-else",
      transfer:{time:4.5,actorId:actor.id,
        grip:{hand:"left" as const,x:0,y:0}},
    }]};
    expect(sceneElementAt(project,receiving,actor,time,0).joints?.head)
      .toEqual(sceneElementAt(project,receiving,withoutVoice,time,0).joints?.head);
    actor.animation={blink:true,idle:"none",keyframes:[{
      ...elementBase(actor),id:"wave",time:0,easing:"linear",gesture:"wave",
    }]};
    expect(sceneElementAt(project,scene,actor,time,0).joints?.head)
      .toEqual(sceneElementAt(project,scene,withoutVoice,time,0).joints?.head);
  });
  it("leaves Classic, calm previews, painted heads and non-rigged characters unchanged",()=>{
    const {project,scene,actor,character,withoutVoice}=fixture();
    const time=1.4;
    const cinematic=sceneElementAt(project,scene,actor,time,0);
    const calm=sceneElementAt(project,scene,actor,time,0,true);
    expect(calm.voiceOpening).toBeUndefined();
    expect(calm.joints).toBeUndefined();
    project.visualStyle=undefined;
    const classic=sceneElementAt(project,scene,actor,time,0);
    const classicWithout=sceneElementAt(project,scene,withoutVoice,time,0);
    expect(classic.joints).toEqual(classicWithout.joints);
    expect(classic.x).toBe(classicWithout.x);
    project.visualStyle="storybook-cinematic";
    const originalRig=character.puppet!;
    const head=originalRig.parts.find(p=>p.role==="head")!;
    character.puppet={...originalRig,parts:originalRig.parts.map(p=>
      p.id===head.id?{...p,assetId:"painted-head"}:p)};
    const painted=sceneElementAt(project,scene,actor,time,0);
    const paintedWithout=sceneElementAt(project,scene,withoutVoice,time,0);
    expect(painted.joints?.head).toEqual(paintedWithout.joints?.head);
    character.puppet=undefined;
    const noRig=sceneElementAt(project,scene,actor,time,0);
    expect(noRig.joints).toEqual(sceneElementAt(project,scene,withoutVoice,time,0).joints);
    expect(cinematic.voiceOpening).toBeGreaterThan(0);
  });
  it("bounds a direct speaking frame without creating new props or rewriting keys",()=>{
    const {project,scene,actor}=fixture();
    const time=1.4;
    const frame=sceneElementAt(project,scene,actor,time,0);
    const source=JSON.stringify(project);
    const effected=cinematicVoiceHeadAt(project,scene,actor,frame,time,0,false);
    expect((effected.joints?.head?.angle??0)-(frame.joints?.head?.angle??0))
      .toBeLessThanOrEqual(1.05);
    expect(JSON.stringify(project)).toBe(source);
  });
});
