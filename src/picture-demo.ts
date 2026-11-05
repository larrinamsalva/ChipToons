import { decodeAsset, readAudio } from "./audio-files";
import type { CameraShot } from "./camera-shots";
import { imageLibraryItem, placeLibraryItem } from "./library";
import { makeScene, uid, validateProject } from "./model";
import type { Asset, Project, SceneElement } from "./model";
import { newPictureProject, defaultPanel, pictureCutout, pictureImage, picturePuppet } from "./picture-studio";
import type { Cutout, Mask } from "./picture-studio";
import { neutralJoint } from "./puppet-model";
import type { JointSnapshot } from "./puppet-model";
import { newAudioClip } from "./production";
import { blankLine, chooseScriptTake, scriptCaptions, setLineApproval, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";
import { analyzeVoiceEnvelope, applyTalkingPreset, withVoiceTrack } from "./voice-mouth";
import type { VoiceMouthTrack } from "./voice-mouth-model";

export const FIXERS_DEMO_TITLE = "Little Fixers Club — The Wobbly Chair";
const narration = [
  "Welcome, Little Fixers. Can you see this chair wobble? Let us set it aside and ask a grown-up to check the loose joint.",
  "Look right here, where the wooden pieces meet. We can watch the grown-up check the chair. We will wait until it is safe to use.",
  "Before you toss something, ask if it can be repaired or reused safely. Good looking out, Little Fixers!",
];

function trace(coordinates: [number, number][]): Mask {
  return { subtract: false, points: coordinates.map(([x, y]) => ({ x: x / 1100, y: y / 619 })) };
}

async function alternateFace(cutout: Cutout, eyes: boolean): Promise<Asset> {
  const image = await pictureImage(cutout.asset);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  ctx.scale(canvas.width, canvas.height);
  if (eyes) {
    ctx.strokeStyle = "#bc7550";
    ctx.lineWidth = 0.19;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0.15, 0.39); ctx.quadraticCurveTo(0.25, 0.24, 0.38, 0.42);
    ctx.moveTo(0.61, 0.67); ctx.quadraticCurveTo(0.71, 0.53, 0.83, 0.68);
    ctx.stroke();
    ctx.strokeStyle = "#402624";
    ctx.lineWidth = 0.055;
    ctx.stroke();
  } else {
    ctx.fillStyle = "#5d302b";
    ctx.beginPath();
    ctx.ellipse(0.50, 0.52, 0.37, 0.26, -0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f2ad99";
    ctx.beginPath();
    ctx.ellipse(0.52, 0.63, 0.20, 0.07, -0.13, 0, Math.PI * 2);
    ctx.fill();
  }
  return { ...cutout.asset, id: uid(), name: eyes ? "Hand-drawn eyelids" : "Hand-drawn open mouth",
    dataUrl: canvas.toDataURL("image/png") };
}

function actorKeys(element: SceneElement, beats: Array<[number, number, number]>) {
  return { idle: "breathe" as const, blink: true, keyframes: beats.map(([time, head, arm]) => ({
    ...elementBase(element), id: uid(), time, easing: "ease-in-out" as const, joints: {
      head: { ...neutralJoint, angle: head }, rightArm: { ...neutralJoint, angle: arm },
    } satisfies JointSnapshot,
  })) };
}

async function withWorkshopVoices(project: Project) {
  const urls = await Promise.all([
    import("./samples/little-fixers/line-1.mp3?inline"),
    import("./samples/little-fixers/line-2.mp3?inline"),
    import("./samples/little-fixers/line-3.mp3?inline"),
  ]);
  const files = await Promise.all(urls.map(async ({ default: url }, i) =>
    readAudio(new File([await (await fetch(url)).blob()], `Little Fixers · spoken line ${i + 1}.mp3`, { type: "audio/mpeg" }))));
  const context = new AudioContext({ sampleRate: 24000 });
  try {
    for (const [index, asset] of files.entries()) {
      const scene = project.scenes[index], line = scene.script!.lines[0];
      project = setLineApproval(chooseScriptTake(project, line.id, asset, true), line.id, true);
      const voicedScene = project.scenes[index];
      const clip = project.audioClips.find(item => item.id === voicedScene.script!.lines[0].clipId)!;
      const host = voicedScene.elements.find(element => element.characterId === line.speakerId)!;
      const track = applyTalkingPreset({
        clipId: clip.id, sourceId: asset.id, speakerId: host.characterId,
        trimStart: clip.trimStart, trimEnd: clip.trimEnd, start: 0, end: clip.duration,
        levels: analyzeVoiceEnvelope(await decodeAsset(context, asset), clip.trimStart, clip.trimEnd),
        sensitivity: 1, minimum: 0.13, maximum: 1, delay: 0,
        preset: "gentle", expression: "happy", replaceManual: false, corrections: [],
      } satisfies VoiceMouthTrack, "gentle");
      project = withVoiceTrack(project, voicedScene, host, clip.id, track);
      project.captions = scriptCaptions(project, project.scenes[index]);
    }
  } finally { await context.close(); }
  return project;
}

export async function littleFixersDemo(source: Asset): Promise<Project> {
  const image = await pictureImage(source);
  const [body, head, arm, eyes, mouth, chair] = await Promise.all([
    pictureCutout(image, [trace([[153,183],[195,170],[226,182],[266,174],[299,183],[317,206],[300,250],[285,279],[287,314],[321,290],[368,269],[397,270],[418,286],[418,338],[396,360],[373,395],[371,433],[414,456],[423,489],[403,497],[301,499],[298,472],[297,429],[320,375],[278,394],[238,445],[240,480],[228,495],[137,488],[129,461],[141,409],[146,363],[158,337],[151,315],[123,303],[119,281],[117,254],[131,218]])], "Workshop host body"),
    pictureCutout(image, [trace([[169,94],[191,76],[195,52],[218,27],[245,13],[279,8],[301,12],[324,29],[343,48],[357,72],[352,98],[340,117],[325,129],[308,156],[284,171],[266,192],[235,197],[211,193],[197,179],[178,175],[166,161],[158,136]])], "Workshop host head"),
    pictureCutout(image, [trace([[302,184],[325,197],[352,219],[361,204],[348,192],[329,196],[324,191],[333,177],[344,166],[347,149],[352,144],[359,149],[363,159],[387,165],[404,174],[417,185],[416,204],[416,236],[412,251],[400,265],[386,269],[365,267],[345,257],[323,245],[307,231],[293,211]])], "Workshop host pointing arm"),
    pictureCutout(image, [trace([[241,87],[251,88],[268,96],[274,106],[269,117],[259,119],[245,111],[238,100]]),
      trace([[279,118],[290,111],[307,115],[313,123],[308,134],[294,138],[282,133]])], "Workshop host eyes"),
    pictureCutout(image, [trace([[228,139],[241,140],[254,145],[267,149],[274,147],[269,158],[251,165],[238,164],[227,157]])], "Workshop host smile"),
    pictureCutout(image, [trace([[1010,31],[1029,37],[1032,42],[1061,42],[1072,31],[1087,34],[1088,100],[1094,106],[1090,120],[1085,126],[1049,130],[986,129],[982,123],[983,116],[1015,110]])], "Wooden chair back and seat"),
  ]);
  const [blink, openMouth] = await Promise.all([alternateFace(eyes, true), alternateFace(mouth, false)]);
  const puppet = picturePuppet("Workshop host", [
    { role: "torso", cutout: body }, { role: "rightArm", cutout: arm }, { role: "head", cutout: head },
    { role: "eyes", cutout: eyes }, { role: "mouth", cutout: mouth },
  ]);
  const rig = puppet.character.puppet;
  puppet.assets.push(blink, openMouth);
  const armPart = rig.parts.find(item => item.role === "rightArm")!;
  const headPart = rig.parts.find(item => item.role === "head")!;
  armPart.pivotX = -armPart.width * 0.42;
  armPart.pivotY = -armPart.height * 0.04;
  armPart.x += armPart.pivotX;
  armPart.y += armPart.pivotY;
  headPart.pivotY = headPart.height * 0.34;
  headPart.y += headPart.pivotY;
  for (const part of rig.parts.filter(item => item.role === "eyes" || item.role === "mouth")) {
    part.y -= headPart.pivotY;
    part.alternateAssetId = part.role === "eyes" ? blink.id : openMouth.id;
  }

  const original = newPictureProject(source, defaultPanel, false);
  const titles = ["Welcome to the workshop", "Look at the loose joint", "Repair, reuse, and rebuild"];
  let project: Project = {
    ...original, title: FIXERS_DEMO_TITLE, setting: "Little Fixers workshop",
    scenes: titles.map((title, index) => ({
      ...makeScene([]), title, background: "classroom", duration: [12, 12, 10][index], transition: "cut",
      action: ["The host points toward the chair.", "The chair wobbles in a close-up.", "The host reminds the team to ask an adult."][index],
      narration: "", dialogue: "",
    })),
  };
  const prop = imageLibraryItem(chair.asset, "Wobbly chair", "prop");
  prop.transform = { width: 175, height: 155 };
  for (let i = 0; i < project.scenes.length; i++) {
    project = placeLibraryItem(placeLibraryItem(project, i, puppet), i, prop);
    const scene = project.scenes[i];
    const [host, chairElement] = scene.elements;
    Object.assign(host, { x: 290, y: 415, scale: 2 });
    Object.assign(chairElement, { x: 525, y: 376 });
    host.animation = actorKeys(host, i === 0
      ? [[0, 0, -9], [1.3, -7, -12], [2.9, 8, 21], [4.6, 2, 14], [7.1, -7, -9], [10.1, 2, -4]]
      : [[0, 0, 5], [2.8, -8, 15], [5.2, 8, 22], [8.8, -2, 0]]);
    const wobble = i === 2 ? [[0, 0]] : [[0, 0], [3.1, 0], [3.4, -11], [3.72, 9], [4.04, -7], [4.4, 4], [4.85, 0]];
    chairElement.animation = { idle: "none", blink: false, keyframes: wobble.map(([time, rotation]) => ({
      ...elementBase(chairElement), id: uid(), time, rotation, easing: "linear",
    })) };
    if (i === 1) scene.cameraShots = [{
      id: uid(), style: "detail", start: 2.4, end: 6.2, frame: { x: 520, y: 310, zoom: 2.2 },
      move: 0, targets: [], follow: false, offset: { x: 0, y: 0 }, placement: "center",
      note: "Look closely where the chair back meets the seat.",
    } satisfies CameraShot];
    const line = { ...blankLine("dialogue", narration[i]), speakerId: host.characterId };
    project.scenes[i] = withScript(scene, { acting: "Friendly workshop host. Leave room to look at the chair.", emotion: "Curious and kind", lines: [line] });
  }
  const workshop = builtInSound("workshop"), creak = builtInSound("place");
  project.audioAssets.push(workshop, creak);
  project.audioClips.push({ ...newAudioClip(project, workshop, "effects", 0, 0), volume: 0.42 },
    { ...newAudioClip(project, creak, "effects", 1, 3.1), volume: 0.8 });
  return validateProject(await withWorkshopVoices(project));
}
