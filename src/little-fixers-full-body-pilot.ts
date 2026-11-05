import { newFocusGraphic } from "./focus-studio";
import { makeScene, uid, validateProject } from "./model";
import type { Character, Project, Scene, SceneElement } from "./model";
import { starterProject } from "./planner";
import { newAudioClip } from "./production";
import { newPart, neutralJoint, sunnyRig } from "./puppet-model";
import { blankLine, withScript } from "./script";
import { builtInSound } from "./sounds";
import { elementBase } from "./timeline";

export const CARTOON_PILOT_TITLE =
  "Little Fixers Club — Full-Body Cartoon Workshop (34-second acting pilot; no narration)";

/** Standalone rigged cartoon performer: no uploaded picture, tracing, or poster. */
export function fullBodyWorkshopCharacter(): Character {
  const rig = sunnyRig();
  const torso = rig.parts.find(part => part.id === "torso")!;
  const leftLeg = rig.parts.find(part => part.id === "leftLeg")!;
  const rightLeg = rig.parts.find(part => part.id === "rightLeg")!;
  const leftFoot = { ...newPart("leftFoot", "leftFoot", leftLeg),
    x: 0, y: 38, pivotX: 0, pivotY: 0, width: 38, height: 21 };
  const rightFoot = { ...newPart("rightFoot", "rightFoot", rightLeg),
    x: 0, y: 38, pivotX: 0, pivotY: 0, width: 38, height: 21 };
  const toolBelt = { ...newPart("accessory", "toolBelt", torso),
    x: 0, y: 26, pivotX: 0, pivotY: 0, width: 79, height: 24 };
  const find = (id: string) => rig.parts.find(part => part.id === id)!;
  rig.parts = [
    find("leftLeg"), find("rightLeg"), leftFoot, rightFoot,
    find("leftArm"), find("rightArm"), torso, toolBelt, find("head"),
  ];
  rig.costume = "workshop";
  rig.description = "Original, fully rigged workshop cartoon host in cargo pants, toolbelt and dark boots; not a picture cutout.";
  return { id: uid(), name: "Scout — Little Fixers Workshop Guide",
    skin: "#d8a381", hair: "#45382b", shirt: "#277b8b", accessory: "none", puppet: rig };
}

function prop(name: NonNullable<SceneElement["prop"]>, x: number, y: number,
  scale: number, depth: NonNullable<SceneElement["sceneryDepth"]>): SceneElement {
  return { id: uid(), characterId: "", kind: "prop", prop: name,
    name: "Workshop " + name.replaceAll("-", " "), x, y, scale, sceneryDepth: depth,
    flip: false, rotation: 0, emotion: "calm", motion: "still" };
}

function notice(scene: Scene, time: number, duration: number, text: string) {
  return { ...newFocusGraphic(scene, time), kind: "label" as const, text, length: duration,
    target: { kind: "screen" as const, x: 579, y: 90 } };
}

/**
 * A small *original vector cartoon* acting proof: a full-body performer walks
 * into a layered workshop, notices the bench and points to the safe work area.
 *
 * No imported picture, no simulated 3D mesh, no automatic speech claims.
 * Every joint/camera/effect remains separately editable in ChipToons.
 */
export function littleFixersFullBodyPilot(): Project {
  const base = starterProject("safety");
  const character = fullBodyWorkshopCharacter();
  const scene = makeScene([character], 0);
  const host = scene.elements[0];
  host.x = 171; host.y = 381; host.scale = 1.28; host.motion = "still";
  host.emotion = "happy";

  // Alternating leg angles and opposing arms create a real full-body walking
  // cycle, with planted holds and a final pointing gesture. No slide-only move.
  const steps = [
    [0, 171, 0, 0, 0, 0, "happy"],
    [2, 186, 22, -22, 18, -18, "happy"],
    [4, 221, -22, 22, -18, 18, "happy"],
    [6, 253, 24, -24, 20, -20, "happy"],
    [8, 289, -23, 23, -18, 18, "happy"],
    [10, 320, 18, -18, 14, -14, "happy"],
    [12, 335, 0, 0, 1, 1, "happy"],
    [16, 337, 0, 0, -6, 42, "surprised"],
    [20, 336, 0, 0, 2, 35, "happy"],
    [25, 336, 0, 0, 3, 12, "happy"],
    [29, 336, 0, 0, -7, 28, "excited"],
    [33.8, 336, 0, 0, 0, 8, "happy"],
  ] as const;
  host.animation = { idle: "breathe", blink: true, keyframes: steps.map(
    ([time, x, leftLeg, rightLeg, leftArm, rightArm, emotion]) => ({
      ...elementBase(host), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
        leftArm: { ...neutralJoint, angle: leftArm },
        rightArm: { ...neutralJoint, angle: rightArm },
        head: { ...neutralJoint, angle: time >= 16 && time <= 25 ? -9 : 3 },
      },
    }),
  ) };

  const workshop = withScript({
    ...scene, title: "The Workshop Comes Alive — full-body acting pilot",
    duration: 34, background: "classroom", chapter: "introduction",
    transition: "cut", gentleDepth: true,
    backgroundAnimation: { enabled: true, style: "parallax", keyframes: [] },
    action: "An original vector character enters with a full-body walk cycle, slows to a stop, looks toward an adult-only toolbox and points to a clear work zone.",
    elements: [
      prop("shelf", 639, 283, 1.10, "behind"),
      prop("table", 575, 354, 1.08, "behind"),
      prop("toolbox", 596, 292, 0.62, "behind"),
      host,
      prop("book", 465, 367, 0.43, "alongside"),
      prop("toy-wagon", 96, 435, 0.60, "front"),
      prop("recycling-bin", 749, 426, 0.59, "front"),
    ],
    cameraShots: [
      { id: uid(), style: "follow", start: 2, end: 12, move: 2,
        frame: { x: 265, y: 234, zoom: 1.20 }, targets: [host.id],
        follow: true, offset: { x: 0, y: 0 }, placement: "center",
        note: "Follow the full-body walk through the layered workshop." },
      { id: uid(), style: "medium", start: 17, end: 25, move: 1.4,
        frame: { x: 559, y: 263, zoom: 1.48 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Move from host to grown-up's toolbox as the host points." },
      { id: uid(), style: "medium", start: 27, end: 33.5, move: 1,
        frame: { x: 330, y: 231, zoom: 1.20 }, targets: [],
        follow: false, offset: { x: 0, y: 0 }, placement: "center",
        note: "Return to the smiling host and the safe learning space." },
    ],
  }, { acting: "Perform with body gestures, not prerecorded speech.",
    emotion: "Curious, playful and reassuring",
    lines: [
      { ...blankLine("dialogue", "Welcome to our workshop! Watch me walk over to the bench."),
        speakerId: character.id },
      { ...blankLine("dialogue", "Tools stay with our grown-up. We can look, plan, and help safely."),
        speakerId: character.id },
    ] });
  workshop.focusGraphics = [
    notice(workshop, 0.7, 5.8, "A cartoon character walks!"),
    notice(workshop, 17, 7, "Tools are for grown-ups"),
    notice(workshop, 27, 6, "Look · Stop · Ask"),
  ];
  const room = builtInSound("workshop");
  const stepsSound = builtInSound("steps");
  const success = builtInSound("success");
  const project: Project = {
    ...base, characters: [character], scenes: [workshop], assets: [],
    templateId: "little-fixers-full-body-pilot",
    title: CARTOON_PILOT_TITLE, plannedMinutes: 1,
    idea: "Create a genuine original cartoon person who can walk and act without a picture or sketch.",
    lesson: "Walk safely, keep the workshop tidy and ask grown-ups about tools.",
    setting: "A dimensional, softly layered workshop.",
    artStyle: "Original vector 2.5D cartoon, not a photograph or 3D mesh.",
    targetAge: "4–7",
    outline: { beginning: "Scout enters the workshop.",
      conflict: "Tools could be unsafe without a grown-up.",
      response: "Scout points out a clear space and safe tools.",
      ending: "Look, stop, ask." },
    audioAssets: [room, stepsSound, success], audioClips: [], captions: [],
  };
  project.audioClips = [
    { ...newAudioClip(project, room, "effects", 0), duration: 34, loop: true, volume: 0.18 },
    { ...newAudioClip(project, stepsSound, "effects", 0, 1), duration: 11, loop: true, volume: 0.27 },
    { ...newAudioClip(project, success, "effects", 0, 28), volume: 0.54 },
  ];
  return validateProject(project);
}
