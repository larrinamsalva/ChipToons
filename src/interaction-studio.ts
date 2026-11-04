import { PROPS } from "./art-model";
import type { PropName } from "./art-model";
import { elementName, placeLibraryItem, starterLibrary } from "./library";
import { uid } from "./model";
import type { Project, Scene, SceneElement } from "./model";
import { clamp } from "./timeline";
import { presetAnimation } from "./presets";
import { canBecomeStoryObject, interactionCharacter, needsRelease, passesObject, storyObject } from "./interaction-model";
import type { Interaction, InteractionKind } from "./interaction-model";

export function storyPropOptions() {
  return starterLibrary().filter(item => item.kind === "prop" && canBecomeStoryObject({
    kind: "prop", prop: item.prop, characterId: "",
  }));
}

export function addStoryProp(project: Project, scene: Scene, prop: PropName): Scene {
  const item = storyPropOptions().find(choice => choice.prop === prop);
  if (!item) throw new Error("Choose a small story prop from the list.");
  const index = project.scenes.findIndex(choice => choice.id === scene.id);
  const copy = { ...project, scenes: project.scenes.map(choice => choice.id === scene.id ? scene : choice) };
  const placed = placeLibraryItem(copy, index, item).scenes[index];
  placed.elements.at(-1)!.scale = 0.62;
  return placed;
}

export function newInteraction(scene: Scene, kind: InteractionKind, time: number, actorId = "", objectId = "",
  receiverId = ""): Interaction {
  const start = Math.round(clamp(time, 0, Math.max(0, scene.duration - 2)) * 100) / 100;
  const finish = Math.min(scene.duration, start + 4);
  const span = finish - start;
  const prop = scene.elements.find(item => item.id === objectId);
  const table = kind === "table" ? scene.elements.find(item => item.prop === "table") : undefined;
  return {
    id: uid(), kind, start, finish, actorId, objectId, attach: kind === "point" || kind === "hold" ? start : start + span * 0.2,
    grip: { hand: "right", x: 0, y: kind === "show" ? -26 : 18 },
    transfer: passesObject(kind) ? { time: start + span * 0.57, actorId: receiverId,
      grip: { hand: "left", x: 0, y: 18 } } : undefined,
    release: (needsRelease(kind) || passesObject(kind)) ? { time: start + span * 0.9, position: {
      x: table?.x ?? clamp((prop?.x ?? 400) + 95, 45, 755),
      y: table ? clamp(table.y - 68 * table.scale, 0, 450) : prop?.y ?? 340,
    } } : undefined,
  };
}

export const canWalkForAction = (actor?: SceneElement) => !!actor && actor.motion === "still" && !actor.animation?.keyframes.length;

// A short walk is offered only for still characters. It becomes ordinary editable timeline keys.
export function walkForAction(project: Project, actor: SceneElement, scene: Scene, action: Interaction): SceneElement {
  if (!canWalkForAction(actor)) return actor;
  const end = action.transfer?.time ?? action.release?.time ?? action.finish;
  const destination = action.transfer ? scene.elements.find(item => item.id === action.transfer?.actorId)?.x :
    action.release?.position.x;
  const x = clamp(destination !== undefined
    ? destination + (destination > actor.x ? -54 : 54)
    : actor.x > 560 ? actor.x - 145 : actor.x + 145, 60, 740);
  const finishWalk = end - Math.min(0.35, (end - action.attach) / 3);
  const span = finishWalk - action.attach;
  if (span < 0.1) return actor;
  const rig = project.characters.find(item => item.id === actor.characterId)?.puppet;
  const animation = presetAnimation(actor, scene.duration, "walk", action.attach, span, rig);
  return { ...actor, animation: { ...animation,
    blink: actor.animation?.blink ?? animation.blink, idle: actor.animation?.idle ?? animation.idle,
    keyframes: animation.keyframes.map(key => ({
    ...key,
    x: actor.x + (x - actor.x) * clamp((key.time - action.attach) / span, 0, 1),
    ...(key.time >= finishWalk - 0.001 ? { x, pose: actor.pose ?? "standing" } : {}),
    // The walk preset supplies the legs. Leave the selected arm available for the reach.
    joints: key.joints && Object.fromEntries(Object.entries(key.joints).filter(([id]) =>
      !rig?.parts.some(part => part.id === id && part.role.startsWith(action.grip.hand) && /Arm|Hand|Forearm/.test(part.role)))),
  })) } };
}

export function interactionSuggestion(project: Project, scene: Scene) {
  const text = [scene.action, scene.narration, scene.script?.acting, project.idea].filter(Boolean).join("\n").toLowerCase();
  const actions: [RegExp, InteractionKind][] = [
    [/\bwaters?\s+(?:a |the )?(?:plant|seedling)\b/, "water"],
    [/\b(?:pick(?:s|ed)? up|lift(?:s|ed)?)\b/, "pickup"],
    [/\b(?:give(?:s)?|hand(?:s)? over|share(?:s)?)\b/, "give"],
    [/\b(?:carr(?:y|ies)|bring(?:s)?)\b/, "carry"],
    [/\b(?:put(?:s)? away|set(?:s)? down|put(?:s)? down)\b/, "put"],
    [/\bpoint(?:s)? (?:at|to)\b/, "point"],
    [/\bshow(?:s)?\b/, "show"],
  ];
  const lines = text.split("\n");
  for (const line of lines) {
    for (const [pattern, kind] of actions) {
      const match = pattern.exec(line);
      if (!match) continue;
      const after = line.slice(match.index);
      const prop: PropName | undefined = kind === "water" ? "watering-can" : PROPS.find(item =>
        new RegExp(`\\b${item.replaceAll("-", "[- ]")}s?\\b`).test(after));
      if (!prop || !storyPropOptions().some(item => item.prop === prop)) continue;
      const actors = scene.elements.filter(interactionCharacter);
      const named = actors.filter(item => line.slice(0, match.index).includes(elementName(project, item).toLowerCase()));
      const choices = scene.elements.filter(item => storyObject(item) && item.prop === prop);
      return { kind, prop, actorId: named.length === 1 ? named[0].id : undefined,
        objectId: choices.length === 1 ? choices[0].id : undefined, alreadyPresent: choices.length > 0 };
    }
  }
}

export type InteractionSuggestion = NonNullable<ReturnType<typeof interactionSuggestion>>;
