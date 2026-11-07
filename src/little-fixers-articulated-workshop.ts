import { fullBodyWorkshopCharacter } from "./little-fixers-full-body-pilot";
import { makeScene, uid, validateProject } from "./model";
import type { Character, Emotion, Project, SceneElement } from "./model";
import { newPart, neutralJoint } from "./puppet-model";
import { starterProject } from "./planner";
import { elementBase } from "./timeline";
import type { Interaction } from "./interaction-model";

export const ARTICULATED_WORKSHOP_TITLE =
  "Little Fixers Club — Scout & Helper Jo's Bend-and-Reach Workshop (30-second silent animation demo)";

/**
 * Create a fresh, self-contained performer with genuinely parented forearms
 * and hands. Never mutate the previously approved full-body pilot or the
 * four-minute Little Fixers story, whose older scenes rely on simpler rigs.
 */
export function articulatedWorkshopCharacter(role: "scout" | "jo"): Character {
  const character = fullBodyWorkshopCharacter();
  const rig = character.puppet!;
  for (const side of ["left", "right"] as const) {
    const arm = rig.parts.find(part => part.role === `${side}Arm`)!;
    const forearm = {
      ...newPart(`${side}Forearm`, `${side}Forearm`, arm),
      x: 0, y: 34, pivotX: 0, width: 20, height: 33,
    };
    const hand = {
      ...newPart(`${side}Hand`, `${side}Hand`, forearm),
      x: 0, y: 27, pivotX: 0, width: 22, height: 22,
    };
    // Keep the forearm and hand immediately after their upper arm in paint
    // order, so the shirt/torso naturally overlaps the rear arm.
    rig.parts.splice(rig.parts.indexOf(arm) + 1, 0, forearm, hand);
  }
  rig.description = "Original workshop performer with editable, parented shoulders, elbows and hands. No external image or voice recording.";
  if (role === "jo") {
    character.name = "Helper Jo — Trusted Grown-Up";
    character.shirt = "#954c68";
    character.hair = "#3c2947";
    character.skin = "#bf876a";
  }
  return character;
}

type Beat = readonly [number, number, Emotion, number, number, number];
function act(element: SceneElement, beats: readonly Beat[]) {
  element.animation = {
    idle: "breathe", blink: true,
    // Only legs and head are authored. The shoulder/elbow/hand pairs stay
    // unkeyed, allowing the real cinematic IK to do its job.
    keyframes: beats.map(([time, x, emotion, head, leftLeg, rightLeg]) => ({
      ...elementBase(element), id: uid(), time, x, emotion,
      easing: "ease-in-out" as const,
      joints: {
        head: { ...neutralJoint, angle: head },
        leftLeg: { ...neutralJoint, angle: leftLeg },
        rightLeg: { ...neutralJoint, angle: rightLeg },
      },
    })),
  };
}

/**
 * An actual openable, 30-second original vector cartoon, not just a unit-test
 * fixture or static picture. Both animated performers bend their arms to
 * approach and share a *picture checklist* safely in the workshop.
 *
 * Existing Little Fixers demos are intentionally unchanged.
 */
export function littleFixersArticulatedWorkshop(): Project {
  const base = starterProject("safety");
  const scout = articulatedWorkshopCharacter("scout");
  const jo = articulatedWorkshopCharacter("jo");
  const scene = makeScene([scout, jo]);
  scene.duration = 30;
  scene.title = "A tiny handoff — shoulders, elbows and hands work together";
  scene.background = "classroom";
  scene.camera = "wide";
  scene.transition = "cut";
  scene.chapter = "exploration";
  scene.gentleDepth = true;
  scene.action =
    "In a tidy workshop, Scout safely lifts a paper picture checklist and shares it with trusted grown-up Helper Jo. Their independently rigged elbows and hands bend toward the checklist as they gently pass it. No power tools or dangerous repair actions.";
  scene.narration = "Scout has a picture plan. Helper Jo can help us follow the safety steps.";
  scene.dialogue = "Scout: Can we look at the picture plan together?\nHelper Jo: Of course! We can stop, look and ask.";
  const [scoutActor, joActor] = scene.elements;
  scoutActor.x = 343; scoutActor.y = 381; scoutActor.scale = 1.25;
  scoutActor.motion = "still"; scoutActor.emotion = "happy";
  joActor.x = 558; joActor.y = 381; joActor.scale = 1.47;
  joActor.motion = "still"; joActor.emotion = "calm";

  act(scoutActor, [
    [0, 329, "happy", -2, 0, 0],
    [2.5, 343, "happy", 5, 9, -9],
    [4, 343, "happy", -6, 0, 0],
    [9.8, 343, "happy", -4, 0, 0],
    [13, 343, "excited", 6, 0, 0],
    [20, 343, "calm", 3, 0, 0],
    [29.8, 343, "happy", -1, 0, 0],
  ]);
  act(joActor, [
    [0, 570, "calm", -2, 0, 0],
    [2.5, 558, "happy", 7, -8, 8],
    [4, 558, "calm", -5, 0, 0],
    [9.8, 558, "happy", -8, 0, 0],
    [13, 558, "happy", 4, 0, 0],
    [20, 558, "excited", -7, 0, 0],
    [29.8, 558, "happy", 0, 0, 0],
  ]);

  const checklist: SceneElement = {
    id: uid(), characterId: "", kind: "prop", prop: "book",
    name: "Large paper picture checklist — safe for Scout to share",
    x: 437, y: 292, scale: 0.42, rotation: 0, flip: false,
    emotion: "calm", motion: "still",
  };
  const table: SceneElement = {
    id: uid(), characterId: "", kind: "prop", prop: "table",
    name: "Low workshop table", x: 466, y: 372, scale: 0.83,
    rotation: 0, flip: false, emotion: "calm",
    motion: "still", sceneryDepth: "behind",
  };
  const shelf: SceneElement = {
    id: uid(), characterId: "", kind: "prop", prop: "shelf",
    name: "Adult-only tool storage", x: 721, y: 302, scale: 0.92,
    rotation: 0, flip: false, emotion: "calm",
    motion: "still", sceneryDepth: "behind",
  };
  scene.elements = [shelf, table, scoutActor, joActor, checklist];

  const share: Interaction = {
    id: uid(), kind: "give", actorId: scoutActor.id,
    objectId: checklist.id, start: 4, attach: 5.4, finish: 13,
    grip: { hand: "right", x: 0, y: 0 },
    transfer: { time: 9.8, actorId: joActor.id,
      grip: { hand: "left", x: 0, y: 0 } },
    release: { time: 12, position: { x: 464, y: 313 } },
  };
  scene.interactions = [share];

  return validateProject({
    ...base,
    title: ARTICULATED_WORKSHOP_TITLE,
    templateId: "little-fixers-articulated-workshop",
    visualStyle: "storybook-cinematic",
    characters: [scout, jo],
    scenes: [scene],
    assets: [],
    plannedMinutes: 1,
    idea: "Show real articulated shoulder, elbow and hand animation during a safe picture-checklist handoff.",
    lesson: "Sharing a simple plan with a trusted grown-up helps everyone do a safe job.",
    setting: "A dimensional, warmly lit learning workshop.",
    artStyle: "Original editable 2.5D vector cartoon with full-body articulated puppet rigs.",
    targetAge: "4–7",
    outline: {
      beginning: "Scout and Helper Jo walk into the tidy workshop.",
      conflict: "Scout needs to share a picture safety checklist.",
      response: "They gently reach toward it, bend their elbows and pass it together.",
      ending: "They put the checklist down and smile: stop, look, ask.",
    },
  });
}
