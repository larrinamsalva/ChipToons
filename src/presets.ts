import { neutralJoint } from "./puppet-model";
import type { JointSnapshot, PuppetRig } from "./puppet-model";
import type { SceneElement } from "./model";
import { uid } from "./model";
import type {
  ElementAnimation,
  ElementKeyframe,
  ElementValues,
} from "./animation-model";
import { clamp, elementBase, roundTime } from "./timeline";

export const ACTIONS = [
  ["walk", "Walk across the stage"],
  ["walk-in-place", "Walk in place"],
  ["celebrate", "Celebrate"],
  ["enter-left", "Enter from left"],
  ["enter-right", "Enter from right"],
  ["jump", "Jump"],
  ["bounce", "Bounce"],
  ["wave", "Wave"],
  ["spin", "Spin"],
  ["grow", "Grow"],
  ["shrink", "Shrink"],
  ["fade-in", "Fade in"],
  ["fade-out", "Fade out"],
  ["nod", "Nod"],
  ["shake", "Shake head"],
  ["float", "Float"],
  ["dance", "Gentle dance"],
  ["point", "Point at something"],
  ["sit", "Sit down"],
  ["stand", "Stand up"],
  ["door", "Open a door"],
] as const;
export type Action = (typeof ACTIONS)[number][0];
const ACTING_ACTIONS: Action[] = [
  "wave",
  "nod",
  "shake",
  "point",
  "sit",
  "stand",
];
export function actionsFor(shape: boolean, door = false) {
  return ACTIONS.filter(([id]) =>
    id === "door" ? door : !["walk-in-place", "celebrate"].includes(id) && (shape || !ACTING_ACTIONS.includes(id)),
  );
}
export function actionsForPuppet(rig: PuppetRig) {
  const has = (roles: RegExp) => rig.parts.some(part => roles.test(part.role));
  return ACTIONS.filter(([action]) => {
    if (["wave", "point"].includes(action)) return has(/^(left|right)Arm$/);
    if (["nod", "shake"].includes(action)) return has(/^head$/);
    if (["walk-in-place", "sit", "stand"].includes(action)) return has(/Leg|lowerBody/);
    return ["walk", "jump", "bounce", "float", "dance", "celebrate", "fade-in", "fade-out"].includes(action);
  });
}

// Full seated transitions need an actual torso and two complete limb chains.
const SEATED_ROLES = [
  "torso", "head", "leftArm", "rightArm", "leftForearm", "rightForearm",
  "leftHand", "rightHand", "leftLeg", "rightLeg",
  "leftShin", "rightShin", "leftFoot", "rightFoot",
] as const;
function canArticulateSeating(rig?: PuppetRig): boolean {
  return !!rig && rig.costume === "workshop" &&
    SEATED_ROLES.every(role => rig.parts.some(part => part.role === role));
}

function puppetAction(rig: PuppetRig, action: Action, phase: number): JointSnapshot {
  const joints: JointSnapshot = {};
  const arm = rig.parts.find(p => p.role === "rightArm") ?? rig.parts.find(p => p.role === "leftArm");
  const wave = Math.sin(phase * Math.PI * 6);
  const walk = Math.sin(phase * Math.PI * 4);
  const envelope = Math.sin(phase * Math.PI);
  const fullWorkshop = rig.costume === "workshop" &&
    ["leftForearm", "rightForearm", "leftShin", "rightShin",
      "leftHand", "rightHand", "leftFoot", "rightFoot"]
      .every(role => rig.parts.some(p => p.role === role));
  for (const part of rig.parts) {
    let angle = 0;
    const side = part.role.startsWith("left") ? -1 : 1;
    if ((action === "walk" || action === "walk-in-place") && /Arm|Leg|lowerBody/.test(part.role))
      angle = walk * side * (/Arm/.test(part.role) ? 16 : -27);
    // #148: Only completed original 15-part workshop performers get
    // authored secondary elbow / knee / wrist / ankle poses. Simple Sunny
    // rigs and separately drawn or incomplete rigs retain their presets.
    // Keyframe evaluation below shares the SAME joint data with the
    // actual timeline, Stage and genuine video exporter (not CSS motion).
    const stride = walk * side;
    const walking = action === "walk" || action === "walk-in-place";
    if (fullWorkshop && walking && /Shin$/.test(part.role))
      angle = envelope * 30 * Math.max(0, stride);
    // #149: Let the whole workshop actor transfer a little weight as the
    // feet alternate, while the head counter-leans so faces stay readable.
    // No stage x/y, source rig, or authored motion path is rewritten.
    if (fullWorkshop && walking && part.role === "torso")
      angle = -3 * envelope * walk;
    if (fullWorkshop && walking && part.role === "head")
      angle = 2 * envelope * walk;
    if (fullWorkshop && walking && /Foot$/.test(part.role)) {
      // During stance the leg swings backward: counter-rotate the boot
      // against the upper leg and tiny torso lean. During swing, lift the
      // toe gently instead. This improves sole angle, but is not IK or a
      // guarantee of zero slide on every user-edited rig.
      const swing = Math.max(0, stride);
      const stance = Math.min(0, stride);
      angle = envelope * (-15 * swing + 27 * stance + 3 * walk);
    }
    if (fullWorkshop && walking && /Forearm$/.test(part.role))
      angle = -side * envelope * (6 + 13 * Math.max(0, -stride));
    if (fullWorkshop && walking && /Hand$/.test(part.role))
      angle = -side * envelope * 6 * stride;
    if (fullWorkshop && action === "point" && /Forearm$/.test(part.role))
      angle = -side * 23 * envelope;
    if (fullWorkshop && action === "point" && /Hand$/.test(part.role))
      angle = -side * 8 * envelope;
    if (fullWorkshop && action === "wave" && /Forearm$/.test(part.role))
      angle = -side * (24 + 7 * wave) * envelope;
    if (fullWorkshop && action === "wave" && /Hand$/.test(part.role))
      angle = -side * 9 * wave * envelope;
    // #151: A real crouch -> flight -> soft landing on the existing
    // parented knees, ankles and arms. Sampling is deterministic and
    // shared by the Puppet Maker preview, timeline, Stage and export.
    if (fullWorkshop && action === "jump") {
      const crouch = phase < 0.2
        ? Math.sin(Math.PI * phase / 0.2)
        : phase > 0.8
          ? Math.sin(Math.PI * (phase - 0.8) / 0.2)
          : 0;
      const airborne = phase > 0.2 && phase < 0.8
        ? Math.sin(Math.PI * (phase - 0.2) / 0.6) : 0;
      const bend = Math.min(1, 0.9 * crouch + 0.45 * airborne);
      if (/Leg$/.test(part.role)) angle = side * 9 * bend;
      if (/Shin$/.test(part.role)) angle = -side * 28 * bend;
      if (/Foot$/.test(part.role)) angle = side * 17 * bend;
      if (/Arm$/.test(part.role)) angle = -side * 32 * airborne;
      if (/Forearm$/.test(part.role)) angle = side * 15 * airborne;
      if (/Hand$/.test(part.role)) angle = -side * 6 * airborne;
      if (part.role === "torso") angle = -3 * airborne;
      if (part.role === "head") angle = 2 * airborne;
    }
    if (action === "wave" && part.id === arm?.id) angle = -side * (115 + wave * 16) * Math.min(1, envelope * 3);
    if (action === "point" && part.id === arm?.id) angle = -side * 75 * Math.min(1, envelope * 3);
    if (part.role === "head" && (action === "nod" || action === "shake")) angle = wave * (action === "nod" ? 8 : 14);
    // #154: New 15-part Workshop Characters actually fold their knees and
    // bring their hands in as the body sits; standing reverses exactly the
    // same saved-keyframe motion. Compensating shin and ankle angles keep
    // the boots close to level while head counters the torso lean.
    if (action === "sit" || action === "stand") {
      if (canArticulateSeating(rig)) {
        const eased = phase * phase * (3 - 2 * phase);
        const seated = action === "sit" ? eased : 1 - eased;
        if (part.role === "torso") angle = 7 * seated;
        if (part.role === "head") angle = -6 * seated;
        if (/Leg$/.test(part.role)) angle = -55 * seated;
        if (/Shin$/.test(part.role)) angle = 63 * seated;
        if (/Foot$/.test(part.role)) angle = -15 * seated;
        if (/Arm$/.test(part.role)) angle = side * 17 * seated;
        if (/Forearm$/.test(part.role)) angle = -side * 24 * seated;
        if (/Hand$/.test(part.role)) angle = side * 6 * seated;
      } else if (/Leg|lowerBody/.test(part.role)) {
        angle = side * 55 * (action === "sit" ? phase : 1 - phase);
      }
    }
    if (/Arm/.test(part.role) && action === "celebrate" && !fullWorkshop)
      angle = -side * 110 * envelope;
    // #152: New full-body workshop puppets perform a genuine articulated
    // victory cheer, including both shoulders, elbows, hands, knees and
    // grounded boots. This uses existing editable keyframe joints.
    if (fullWorkshop && action === "celebrate") {
      const cheer = envelope * (0.75 + 0.25 * Math.cos(phase * Math.PI * 4));
      const kneeBend = envelope * (0.65 + 0.35 * Math.cos(phase * Math.PI * 4));
      if (/Arm$/.test(part.role)) angle = -side * 82 * cheer;
      if (/Forearm$/.test(part.role)) angle = side * 27 * cheer;
      if (/Hand$/.test(part.role)) angle = -side * 13 * cheer;
      if (/Leg$/.test(part.role)) angle = side * 7 * kneeBend;
      if (/Shin$/.test(part.role)) angle = -side * 17 * kneeBend;
      if (/Foot$/.test(part.role)) angle = side * 11 * kneeBend;
      if (part.role === "torso") angle = 3 * envelope * Math.sin(phase * 2 * Math.PI);
      if (part.role === "head") angle = -2 * envelope * Math.sin(phase * 2 * Math.PI);
    }
    // #153: Complete original workshop rigs get genuine alternating
    // knees, ankles, shoulders, elbows and wrists while dancing in place.
    // The torso and head counter-sway; all joints return to neutral.
    if (action === "dance") {
      if (fullWorkshop) {
        const beat = Math.sin(phase * Math.PI * 4);
        const sway = Math.sin(phase * Math.PI * 2);
        const flex = Math.max(0, beat * side);
        if (/Arm$/.test(part.role))
          angle = -side * envelope * (28 + 10 * Math.max(0, -beat * side));
        if (/Forearm$/.test(part.role))
          angle = side * envelope * (12 + 9 * flex);
        if (/Hand$/.test(part.role)) angle = -side * 10 * envelope * beat;
        if (/Leg$/.test(part.role)) angle = side * 7 * envelope * beat;
        if (/Shin$/.test(part.role)) angle = -side * 22 * envelope * flex;
        if (/Foot$/.test(part.role)) angle = side * 12 * envelope * flex;
        if (part.role === "torso") angle = 3 * envelope * sway;
        if (part.role === "head") angle = -2 * envelope * sway;
      } else if (/Arm|Leg/.test(part.role)) {
        angle = walk * side * 25;
      }
    }
    if (angle) joints[part.id] = { ...neutralJoint, angle };
  }
  return joints;
}

export function presetAnimation(
  element: SceneElement,
  sceneDuration: number,
  action: Action,
  start = 0,
  length = 3,
  rig?: PuppetRig,
): ElementAnimation {
  const base = elementBase(element);
  const from = clamp(start, 0, sceneDuration - 0.1),
    span = clamp(length, 0.1, sceneDuration - from);
  const keys = new Map<number, ElementKeyframe>();
  function at(
    fraction: number,
    patch: Partial<ElementValues> = {},
    easing: ElementKeyframe["easing"] = "ease-in-out",
  ) {
    const time = roundTime(from + span * fraction);
    const value = { ...base, ...patch };
    keys.set(time, {
      ...value,
      x: clamp(value.x, -800, 1600),
      y: clamp(value.y, -450, 900),
      scale: clamp(value.scale, 0.05, 4),
      rotation: clamp(value.rotation, -1440, 1440),
      id: uid(),
      time,
      easing,
    });
  }
  keys.set(0, { ...base, id: uid(), time: 0, easing: "linear" });
  at(0);
  at(1);
  const articulatedSeating = (action === "sit" || action === "stand") &&
    canArticulateSeating(rig);
  switch (action) {
    case "walk": {
      // #150: A newly made complete Workshop Character eases into a walk
      // and settles naturally at the end. Retain the exact historical
      // travel and bob for old/partial rigs and imported character art.
      const fullWorkshopWalk = rig?.costume === "workshop" &&
        ["leftForearm", "rightForearm", "leftHand", "rightHand",
          "leftShin", "rightShin", "leftFoot", "rightFoot"]
          .every(role => rig.parts.some(part => part.role === role));
      const travel = (base.x < 400 ? 720 : 80) - base.x;
      for (let i = 0; i <= 12; i++) {
        const phase = i / 12;
        // Smoothstep slows entry and exit without changing total travel.
        const arrived = fullWorkshopWalk
          ? phase * phase * (3 - 2 * phase)
          : phase;
        // Continuous, subtly eased body bob replaces 5px step toggles
        // only for full workshop rigs; start and finish at source height.
        const bounce = fullWorkshopWalk
          ? 4 * Math.sin(Math.PI * phase) *
            Math.sin(4 * Math.PI * phase) ** 2
          : (i % 2 ? 5 : 0);
        at(
          phase,
          {
            x: base.x + travel * arrived,
            y: base.y - bounce,
            pose: "walking",
            gesture: i === 12 ? "none" : "walk",
          },
          "linear",
        );
      }
      break;
    }
    case "enter-left":
    case "enter-right":
      at(0, { x: action === "enter-left" ? -140 : 940 });
      at(1);
      break;
    case "celebrate":
    case "jump": {
      // Fully articulated original workshop characters get anticipation,
      // an actual arc and a soft compression on landing. All older rigs
      // preserve the exact historical up/down animation.
      const jumpReady = action === "jump" && rig?.costume === "workshop" &&
        ["leftForearm", "rightForearm", "leftHand", "rightHand",
          "leftShin", "rightShin", "leftFoot", "rightFoot"]
          .every(role => rig.parts.some(part => part.role === role));
      const celebrateReady = action === "celebrate" && rig?.costume === "workshop" &&
        ["leftForearm", "rightForearm", "leftHand", "rightHand",
          "leftShin", "rightShin", "leftFoot", "rightFoot"]
          .every(role => rig.parts.some(part => part.role === role));
      if (jumpReady) {
        for (let i = 0; i <= 12; i++) {
          const phase = i / 12;
          const airborne = phase > 0.2 && phase < 0.8
            ? Math.sin(Math.PI * (phase - 0.2) / 0.6) : 0;
          const crouch = phase < 0.2
            ? Math.sin(Math.PI * phase / 0.2)
            : phase > 0.8
              ? Math.sin(Math.PI * (phase - 0.8) / 0.2)
              : 0;
          at(phase, { y: base.y - 42 * airborne + 4 * crouch }, "linear");
        }
      } else if (celebrateReady) {
        // Twelve short interpolated steps make the double cheer visible
        // in Puppet Maker, the Stage timeline and exported media.
        for (let i = 0; i <= 12; i++) {
          const phase = i / 12;
          const envelope = Math.sin(Math.PI * phase);
          const doubleBeat = 0.75 + 0.25 * Math.cos(phase * Math.PI * 4);
          at(phase, {
            y: base.y - 15 * envelope * doubleBeat,
            emotion: "excited",
          }, "linear");
        }
      } else {
        at(0.5, { y: base.y - (action === "celebrate" || rig ? 32 : 80) }, "ease-out");
        at(1, {}, "ease-in");
      }
      break;
    }
    case "bounce":
      for (let i = 0; i <= 8; i++)
        at(
          i / 8,
          { y: base.y - (i % 2 ? 42 : 0) },
          i % 2 ? "ease-out" : "bounce",
        );
      break;
    case "wave":
      at(0, { pose: "waving", gesture: "wave", mouth: "smile" });
      at(1, { pose: "standing", gesture: "none", mouth: "smile" });
      break;
    case "spin":
      at(1, { rotation: base.rotation + 360 }, "linear");
      break;
    case "grow":
      at(0, { scale: Math.max(0.05, base.scale * 0.3) });
      at(1);
      break;
    case "shrink":
      at(1, { scale: Math.max(0.05, base.scale * 0.3) });
      break;
    case "fade-in":
      at(0, { opacity: 0 });
      at(1);
      break;
    case "fade-out":
      at(1, { opacity: 0 });
      break;
    case "nod":
    case "shake":
      at(0, { gesture: action });
      at(1);
      break;
    case "float":
      for (let i = 0; i <= 8; i++)
        at(i / 8, { y: base.y + Math.sin((i * Math.PI) / 2) * 15 });
      break;
    case "dance": {
      const articulatedDance = rig?.costume === "workshop" &&
        ["leftForearm", "rightForearm", "leftHand", "rightHand",
          "leftShin", "rightShin", "leftFoot", "rightFoot"]
          .every(role => rig.parts.some(part => part.role === role));
      if (articulatedDance) {
        // A rhythmic, continuous in-place dance: subtle lift and sway,
        // actual joint keys at every beat and a neutral finish.
        for (let i = 0; i <= 12; i++) {
          const phase = i / 12;
          const envelope = Math.sin(Math.PI * phase);
          const sway = Math.sin(Math.PI * 2 * phase);
          const pulse = (1 + Math.cos(Math.PI * 4 * phase)) / 2;
          at(phase, {
            y: base.y - 7 * envelope * pulse,
            rotation: base.rotation + 3 * envelope * sway,
            emotion: "excited",
          }, "linear");
        }
      } else {
        for (let i = 0; i <= 8; i++)
          at(i / 8, {
            rotation: base.rotation + (i % 2 ? (i % 4 === 1 ? -8 : 8) : 0),
            y: base.y - (i % 2 ? 8 : 0),
            emotion: "excited",
          });
      }
      break;
    }
    case "point":
      at(0, { pose: "pointing" });
      at(1, { pose: "pointing" });
      break;
    case "sit":
    case "stand":
      if (articulatedSeating) {
        // Save real, reversible intermediate poses, not just endpoints.
        // Both motions use the same smooth seating fraction.
        for (let i = 0; i <= 12; i++) {
          const phase = i / 12;
          const eased = phase * phase * (3 - 2 * phase);
          const seated = action === "sit" ? eased : 1 - eased;
          at(phase, {
            y: base.y + 20 * seated,
            pose: seated >= 0.5 ? "sitting" : "standing",
          }, "linear");
        }
      } else if (action === "sit") {
        at(1, { pose: "sitting", y: base.y + 20 });
      } else {
        at(0, { pose: "sitting", y: base.y + 20 });
        at(1, { pose: "standing" });
      }
      break;
    case "door":
      at(0, { openness: 0 });
      at(1, { openness: 1 });
      break;
  }
  if (from > 0) {
    const first = keys.get(roundTime(from))!;
    const hold = {
      ...base,
      x: first.x,
      y: first.y,
      scale: first.scale,
      rotation: first.rotation,
      opacity: first.opacity,
    };
    keys.set(0, { ...hold, id: uid(), time: 0, easing: "linear" });
  }
  if (rig && ["wave", "nod", "shake", "point", "walk-in-place", "sit", "stand"].includes(action) &&
      !articulatedSeating)
    for (let i = 0; i <= 12; i++) at(i / 12);
  const keyframes = [...keys.values()].sort((a, b) => a.time - b.time);
  return {
    keyframes: rig ? keyframes.map(key => ({
      ...key,
      ...(key.time >= roundTime(from) ? {
        joints: puppetAction(rig, action, clamp((key.time - from) / span, 0, 1)),
        ...(action === "celebrate" ? { emotion: "excited" as const, heart: "together" as const } : {}),
      } : {}),
    })) : keyframes,
    blink: true,
    idle: "none",
  };
}
