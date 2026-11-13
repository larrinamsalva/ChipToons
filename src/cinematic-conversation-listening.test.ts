import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { cinematicConversationListeningAt } from "./cinematic-conversation-listening";
import { cinematicSpeakingEyelineAt } from "./cinematic-conversation-speaking";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";
import { blankLine, withScript } from "./script";
import { neutralJoint } from "./puppet-model";
import { elementBase, sceneElementAt, sceneFramesAt } from "./timeline";
import { Stage } from "./components/Stage";
import type { VoiceMouthTrack } from "./voice-mouth-model";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  // A dedicated conversation: preserve the original handoff demo separately.
  scene.interactions = [];
  const [scout, jo] = scene.elements.filter(element => !!element.characterId);
  for (const actor of [scout, jo]) {
    actor.motion = "still";
    actor.animation = {
      blink: true, idle: "none",
      keyframes: [{
        ...elementBase(actor),
        id: "speaking-" + actor.id,
        time: 0, easing: "linear",
      }],
    };
  }
  const original = builtInSound("melody");
  project.audioAssets = [original];
  const clip = {
    ...newAudioClip(project, original, "dialogue", 0, .6),
    duration: 4, trimStart: 0, trimEnd: 4,
    volume: 1, characterId: scout.characterId,
  };
  project.audioClips = [clip];
  const track: VoiceMouthTrack = {
    clipId: clip.id, sourceId: original.id, speakerId: scout.characterId,
    trimStart: 0, trimEnd: 4, levels: "ff".repeat(100),
    start: 0, end: 4, delay: 0,
    preset: "normal", sensitivity: 1, minimum: .08,
    maximum: .82, expression: "keep", replaceManual: false,
    corrections: [],
  };
  scout.voiceMouth = [track];
  project.visualStyle = "storybook-cinematic";
  return {project,scene,scout,jo,clip,track,original};
}

describe("PR #100 genuine recorded-conversation listening", () => {
  it("makes Helper Jo watch Scout's real approved speech with a subtle listener head cue", () => {
    const {project,scene,scout,jo}=fixture();
    const snapshot=JSON.stringify(project);
    const time=1.4;
    const frames=sceneFramesAt(project,scene,time);
    expect(frames.get(scout.id)?.voiceOpening).toBeGreaterThan(.2);
    const cue=cinematicConversationListeningAt(project,scene,jo,frames,time,false)!;
    expect(cue.speakerId).toBe(scout.id);
    expect(cue.dx).toBeLessThan(0);
    expect(cue.focus).toBeGreaterThan(.5);
    expect(cue.headTilt).toBeLessThan(-.5);
    expect(Math.abs(cue.headTilt)).toBeLessThanOrEqual(1.35);
    expect(cinematicConversationListeningAt(project,scene,scout,frames,time,false))
      .toBeUndefined();
    const original=sceneElementAt(project,scene,jo,time,0);
    const listener=frames.get(jo.id)!;
    expect((listener.joints?.head?.angle ?? 0) -
      (original.joints?.head?.angle ?? 0)).toBeCloseTo(cue.headTilt);
    expect(listener.x).toBe(original.x);
    expect(listener.y).toBe(original.y);
    const face=cinematicFaceAt(project,scene,jo,listener,frames,time,false)!;
    expect(face.x).toBeLessThan(-1.1);
    expect(sceneFramesAt(project,scene,time).get(jo.id)).toEqual(listener);
    const svg=renderToStaticMarkup(createElement(Stage,{
      project,scene,time,labelled:false,
    }));
    expect(svg).toContain("data-cinematic-pupil");
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("switches listening direction when Helper Jo speaks later in the same cartoon",()=>{
    const {project,scene,scout,jo,original,track}=fixture();
    const later={
      ...newAudioClip(project,original,"dialogue",0,7),
      duration:4,trimStart:0,trimEnd:4,volume:1,
      characterId:jo.characterId,
    };
    project.audioClips.push(later);
    jo.voiceMouth=[{
      ...track,clipId:later.id,speakerId:jo.characterId,
    }];
    const before=JSON.stringify(project);
    const early=sceneFramesAt(project,scene,1.4);
    expect(cinematicConversationListeningAt(project,scene,jo,early,1.4,false)?.speakerId)
      .toBe(scout.id);
    const laterFrames=sceneFramesAt(project,scene,8);
    expect(laterFrames.get(jo.id)?.voiceOpening).toBeGreaterThan(.2);
    const watching=cinematicConversationListeningAt(
      project,scene,scout,laterFrames,8,false,
    )!;
    expect(watching.speakerId).toBe(jo.id);
    expect(watching.dx).toBeGreaterThan(0);
    expect(watching.headTilt).toBeGreaterThan(.5);
    expect(cinematicConversationListeningAt(project,scene,jo,laterFrames,8,false))
      .toBeUndefined();
    expect(JSON.stringify(project)).toBe(before);
  });

  it("does not guess conversation cues during silence, muted playback or edited originals",()=>{
    const {project,scene,jo,scout,track,clip}=fixture();
    const frames=sceneFramesAt(project,scene,1.4);
    expect(cinematicConversationListeningAt(project,scene,jo,frames,1.4,false))
      .toBeDefined();
    scout.voiceMouth=[{...track,levels:"00".repeat(100)}];
    const silent=sceneFramesAt(project,scene,1.4);
    expect(silent.get(scout.id)?.voiceOpening).toBe(0);
    expect(cinematicConversationListeningAt(project,scene,jo,silent,1.4,false))
      .toBeUndefined();
    scout.voiceMouth=[track];
    project.mixer={...project.mixer,muted:true};
    const muted=sceneFramesAt(project,scene,1.4);
    expect(cinematicConversationListeningAt(project,scene,jo,muted,1.4,false))
      .toBeUndefined();
    project.mixer={...project.mixer,muted:false};
    project.audioClips=[{...clip,trimStart:.2}];
    const edited=sceneFramesAt(project,scene,1.4);
    expect(edited.get(scout.id)?.voiceOpening).toBeUndefined();
    expect(cinematicConversationListeningAt(project,scene,jo,edited,1.4,false))
      .toBeUndefined();
    project.audioClips=[];
    const missing=sceneFramesAt(project,scene,1.4);
    expect(cinematicConversationListeningAt(project,scene,jo,missing,1.4,false))
      .toBeUndefined();
  });

  it("keeps authored head performances, active handoffs, Classic and calm authoring in control",()=>{
    const {project,scene,jo,scout}=fixture();
    const time=1.4;
    const base=sceneFramesAt(project,scene,time);
    const action={id:"hand-pose",kind:"point" as const,
      actorId:jo.id,objectId:scene.elements.find(e=>e.kind==="prop")!.id,
      start:9,attach:9.5,finish:11,
      grip:{hand:"right" as const,x:0,y:0}};
    const busyScene={...scene,interactions:[action]};
    expect(cinematicConversationListeningAt(
      project,busyScene,jo,base,time,false)).toBeUndefined();
    expect(cinematicConversationListeningAt(
      project,scene,jo,base,time,true)).toBeUndefined();
    jo.animation!.keyframes[0].joints={
      head:{...neutralJoint,angle:15},
    };
    expect(cinematicConversationListeningAt(
      project,scene,jo,base,time,false)).toBeUndefined();
    jo.animation!.keyframes[0].joints=undefined;
    const creatorGesture={...base.get(jo.id)!,gesture:"wave" as const};
    const gestures=new Map(base).set(jo.id,creatorGesture);
    expect(cinematicConversationListeningAt(
      project,scene,jo,gestures,time,false)).toBeUndefined();
    const original=sceneElementAt(project,scene,jo,time,0);
    project.visualStyle=undefined;
    const classic=sceneFramesAt(project,scene,time).get(jo.id)!;
    expect(classic.joints).toEqual(sceneElementAt(project,scene,jo,time,0).joints);
    expect(cinematicConversationListeningAt(
      project,scene,jo,base,time,false)).toBeUndefined();
    project.visualStyle="storybook-cinematic";
    expect(cinematicConversationListeningAt(
      project,scene,scout,base,time,false)).toBeUndefined();
    const joCharacter=project.characters.find(c=>c.id===jo.characterId)!;
    const rig=joCharacter.puppet!;
    joCharacter.puppet={...rig,parts:rig.parts.map(part=>
      part.role==="head" ? {...part,assetId:"painted-head"} : part)};
    expect(cinematicConversationListeningAt(
      project,scene,jo,base,time,false)).toBeUndefined();
    joCharacter.puppet=rig;
    expect(original.x).toBe(classic.x);
  });
  it("follows the creator's silent reaction close-up with real eyelines and a gentle response", () => {
    const { project, scene, scout, jo } = fixture();
    // A reaction shot deliberately remains meaningful even with NO voice:
    // do not synthesize spoken syllables, lip-sync, or audio.
    project.audioClips = [];
    scout.voiceMouth = [];
    scene.cameraShots = [{
      id: "jo-silent-reaction", style: "reaction",
      start: 5, end: 9, move: 0, note: "Jo listens to Scout",
      frame: { x: 400, y: 225, zoom: 1.85 },
      targets: [jo.id], follow: false,
      offset: { x: 0, y: 0 }, placement: "right",
    }];
    const snapshot = JSON.stringify(project);
    const time = 7;
    const frames = sceneFramesAt(project, scene, time);
    const cue = cinematicConversationListeningAt(project, scene, jo, frames, time, false)!;
    expect(cue.speakerId).toBe(scout.id);
    expect(cue.dx).toBeLessThan(0);
    expect(cue.focus).toBeGreaterThan(.85);
    expect(cue.reaction).toBeGreaterThan(.85);
    expect(cue.headTilt).toBeLessThan(0);
    const rendered = frames.get(jo.id)!;
    const original = sceneElementAt(project, scene, jo, time, 0);
    expect((rendered.joints?.head?.angle ?? 0) -
      (original.joints?.head?.angle ?? 0)).toBeCloseTo(cue.headTilt);
    const face = cinematicFaceAt(project, scene, jo, rendered, frames, time, false)!;
    expect(face.x).toBeLessThan(-1);
    expect(face.squint).toBeGreaterThan(.1);
    expect(face.cheekLift).toBeGreaterThan(.1);
    expect(rendered.voiceOpening).toBeUndefined();
    expect(cinematicConversationListeningAt(
      project, scene, jo, sceneFramesAt(project, scene, 5), 5, false,
    )).toBeUndefined();
    expect(cinematicConversationListeningAt(
      project, scene, jo, sceneFramesAt(project, scene, 9), 9, false,
    )).toBeUndefined();
    const early = cinematicConversationListeningAt(
      project, scene, jo, sceneFramesAt(project, scene, 5.15), 5.15, false,
    )!;
    const late = cinematicConversationListeningAt(
      project, scene, jo, sceneFramesAt(project, scene, 8.8), 8.8, false,
    )!;
    expect(early.focus).toBeLessThan(cue.focus);
    expect(late.focus).toBeLessThan(cue.focus);
    expect(cinematicConversationListeningAt(
      project, scene, jo, frames, time, true,
    )).toBeUndefined();
    expect(JSON.stringify(project)).toBe(snapshot);
    // Authored head performances still have unconditional priority.
    jo.animation!.keyframes[0].joints = {
      head: { ...neutralJoint, angle: 15 },
    };
    expect(cinematicConversationListeningAt(
      project, scene, jo, frames, time, false,
    )).toBeUndefined();
  });
  it("keeps Scout looking toward Jo only during an actual approved speaking close-up", () => {
    const { project, scene, scout, jo, track, clip } = fixture();
    scene.script = withScript(scene, {
      acting: "Scout speaks to Helper Jo", emotion: "Friendly",
      lines: [{ ...blankLine("dialogue", "Scout speaks."),
        speakerId: scout.characterId }],
    }).script;
    scene.cameraShots = [{
      id: "scout-recorded-close", style: "close", start: clip.start, end: clip.start + 3.8,
      move: 0, note: "Scout speaks to Jo", targets: [scout.id],
      lineId: scene.script!.lines[0].id,
      frame: { x: 400, y: 225, zoom: 2 },
      follow: false, offset: { x: 0, y: 0 }, placement: "left",
    }];
    const snapshot = JSON.stringify(project);
    const t = 1.4;
    const frames = sceneFramesAt(project, scene, t);
    const cue = cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false)!;
    expect(cue.partnerId).toBe(jo.id);
    expect(cue.dx).toBeGreaterThan(0);
    expect(cue.focus).toBeGreaterThan(.8);
    const face = cinematicFaceAt(project, scene, scout,
      frames.get(scout.id)!, frames, t, false)!;
    expect(face.x).toBeGreaterThan(1);
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false))
      .toEqual(cue);
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, true))
      .toBeUndefined();
    expect(cinematicSpeakingEyelineAt(project, scene, scout,
      sceneFramesAt(project, scene, clip.start), clip.start, false)).toBeUndefined();
    expect(cinematicSpeakingEyelineAt(project, scene, scout,
      sceneFramesAt(project, scene, clip.start + 3.8), clip.start + 3.8, false)).toBeUndefined();
    expect(JSON.stringify(project)).toBe(snapshot);

    project.mixer.muted = true;
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false))
      .toBeUndefined();
    project.mixer.muted = false;
    project.audioClips = [{ ...clip, trimStart: .2 }];
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false))
      .toBeUndefined();
    project.audioClips = [clip];
    scout.voiceMouth = [{ ...track, sourceId: "changed-source" }];
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false))
      .toBeUndefined();
    scout.voiceMouth = [track];
    scene.cameraShots![0].lineId = undefined;
    expect(cinematicSpeakingEyelineAt(project, scene, scout, frames, t, false))
      .toBeUndefined();
  });
});
