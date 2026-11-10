import { describe, expect, it } from "vitest";
import type { Asset } from "./model";
import { projectFromFrameAssetShots } from "./studio-multishot";
import { framefieldCaptionVoiceReview } from "./framefield-caption-voice-review";
import { builtInSound } from "./sounds";
import { newAudioClip } from "./production";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGO8I2f0n4GBgYGJAQoAIZICLyZ2XFkAAAAASUVORK5CYII=";
const asset = (prefix: string, n: number): Asset => ({
  id: `${prefix}-${n}`, name: `${prefix}${n}.png`,
  mime: "image/png", type: "image", dataUrl: png, sourceWidth: 2, sourceHeight: 2,
});
function example() {
  const shots = [
    { prefix: "shot01_frame_", assets: [asset("shot01_frame_",1),asset("shot01_frame_",2)] },
    { prefix: "shot02_frame_", assets: [asset("shot02_frame_",1),asset("shot02_frame_",2)] },
  ];
  const project = projectFromFrameAssetShots(shots,2,undefined,[
    { prefix: shots[0].prefix, title:"Scout", action:"", narration:"First we check the bike." },
    { prefix: shots[1].prefix, title:"Jo", action:"", narration:"Now we fix the tire." },
  ]);
  project.captions = [
    {id:"caption-one",sceneId:project.scenes[0].id,start:0,end:1,text:"First we check."},
    {id:"caption-two",sceneId:project.scenes[0].id,start:1,end:2,text:"Is the tire safe?"},
    {id:"caption-three",sceneId:project.scenes[1].id,start:0,end:2,text:"Now we fix the tire."},
  ];
  return project;
}

describe("Framefield caption-to-assigned voice interval review", () => {
  it("starts as a read-only review of written captions without invented voice recordings", () => {
    const p=example(),before=JSON.stringify(p);
    const board=framefieldCaptionVoiceReview(p);
    expect(board.scenesWithWrittenWords).toBe(2);
    expect(board.scenesWithAssignedVoice).toBe(0);
    expect(board.captions).toBe(3);
    expect(board.captionsWithoutOverlappingVoice).toBe(3);
    expect(board.scenesNeedingVoice).toBe(2);
    expect(board.scenesNeedingCaptions).toBe(0);
    expect(board.scenes[0].cues.map(c=>c.overlapsVoice)).toEqual([false,false]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("only counts real, unmuted assigned voice-clip timing, not music or another scene", () => {
    const p=example();
    const sound=builtInSound("melody");
    p.audioAssets=[sound];
    const voice=newAudioClip(p,sound,"narration",0,0);
    voice.duration=0.8;
    voice.fadeOut=0;
    p.audioClips=[voice];
    const board=framefieldCaptionVoiceReview(p);
    expect(board.scenesWithAssignedVoice).toBe(1);
    expect(board.captionsWithoutOverlappingVoice).toBe(2);
    expect(board.scenes[0].cues.map(c=>c.overlapsVoice)).toEqual([true,false]);
    expect(board.scenes[0].cues[0].coverageFraction).toBeCloseTo(0.8);
    expect(board.scenes[0].cues[0].uncovered)
      .toEqual([{ start: 0.8, end: 1 }]);
    expect(board.scenes[0].partiallyCoveredCues).toBe(1);
    expect(board.partiallyCoveredCues).toBe(1);
    expect(board.scenes[1].missingVoice).toBe(true);
    const music=newAudioClip(p,sound,"music",1,0);
    p.audioClips.push(music);
    expect(framefieldCaptionVoiceReview(p).scenes[1].voiceClips).toBe(0);

    voice.muted=true;
    expect(framefieldCaptionVoiceReview(p).scenesWithAssignedVoice).toBe(0);
    voice.muted=false;
    p.mixer.voice=0;
    expect(framefieldCaptionVoiceReview(p).scenesWithAssignedVoice).toBe(0);
    p.mixer.voice=1;
    p.mixer.muted=true;
    expect(framefieldCaptionVoiceReview(p).scenesWithAssignedVoice).toBe(0);
    p.mixer.muted=false;
    p.mixer.master=0;
    expect(framefieldCaptionVoiceReview(p).scenesWithAssignedVoice).toBe(0);
  });

  it("flags missing captions independently of an existing voice clip", () => {
    const p=example();
    p.captions=[];
    const asset=builtInSound("melody");
    p.audioAssets=[asset];
    const voice=newAudioClip(p,asset,"dialogue",0,0);
    voice.duration=1;
    voice.fadeOut=0;
    p.audioClips=[voice];
    const board=framefieldCaptionVoiceReview(p);
    expect(board.scenesNeedingCaptions).toBe(2);
    expect(board.scenes[0].voiceClips).toBe(1);
    expect(board.scenes[0].missingVoice).toBe(false);
    expect(board.scenes[1].missingVoice).toBe(true);
    expect(board.captions).toBe(0);
  });
});
