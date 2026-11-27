import { makeScene } from "../src/model";
import { starterProject } from "../src/planner";
import { elementBase } from "../src/timeline";
import { newWorkshopPuppetStarter } from "../src/workshop-puppet-starter";

/** Intentionally sliding painted foot: a measurable review case, not a polished walk. */
export function paintedFootCartoon(png: string) {
  const project = starterProject("kindness");
  const character = newWorkshopPuppetStarter();
  character.puppet = { ...character.puppet!, costume: undefined,
    parts: character.puppet!.parts.map(part => part.role === "rightFoot"
      ? { ...part, assetId: "painted-shoe" } : part) };
  project.characters = [character];
  project.assets = [{ id: "painted-shoe", name: "Original painted shoe",
    type: "image", mime: "image/png", dataUrl: png }];
  const scene = makeScene([character]);
  scene.title = "Painted foot motion review";
  scene.duration = 4;
  const actor = scene.elements[0];
  actor.x = 250; actor.y = 330; actor.motion = "still";
  actor.animation = { blink: false, idle: "none", keyframes: [
    { ...elementBase(actor), id: "shoe-start", time: 0, x: 250, easing: "linear" },
    { ...elementBase(actor), id: "shoe-end", time: 3, x: 430, easing: "linear" },
  ] };
  project.scenes = [scene];
  return project;
}
