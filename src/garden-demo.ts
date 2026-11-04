import { createAssistantDraft } from "./assistant";
import type { ElementKeyframe } from "./animation-model";
import { placeLibraryItem } from "./library";
import { uid, validateProject } from "./model";
import type { SceneElement } from "./model";
import { episodeBrief } from "./series";
import { kindHeartsCrew } from "./series-starter";
import { keyAt } from "./timeline";
import { starterLocations } from "./world-starters";

export const GARDEN_DEMO_TITLE = "Helping Hands Waters a Little Garden";

export function gardenInteractionDemo() {
  const { plan, artwork } = kindHeartsCrew();
  const cast = ["Helping Hands", "Shine"].map(name => {
    const i = plan.cast.findIndex(member => member.name === name);
    return { name, library: artwork[i], seriesCastId: plan.cast[i].id };
  });
  const { project: base } = createAssistantDraft({
    ...episodeBrief(plan.episodes[13], 1), title: GARDEN_DEMO_TITLE,
  }, cast);
  const project = placeLibraryItem({ ...base, scenes: base.scenes.slice(0, 1) }, 0,
    starterLocations().find(item => item.id === "starter-location-garden")!);
  const scene = project.scenes[0];
  const actor = scene.elements.find(item => item.characterId === project.characters[0].id)!;
  const shine = scene.elements.find(item => item.characterId === project.characters[1].id)!;
  const wateringCan = scene.elements.find(item => item.prop === "watering-can")!;
  const duration = 12;
  const hero: SceneElement = { ...actor, x: 704, y: 354, scale: 1.04, flip: true, emotion: "calm" };
  const friend: SceneElement = { ...shine, x: 422, y: 341, scale: 0.91, emotion: "calm" };
  const key = (element: SceneElement, time: number, values: Partial<ElementKeyframe>) => ({
    ...keyAt(element, time, duration), ...values,
  });
  const stride = (angle: number) => ({
    leftLeg: { x: 0, y: 0, angle }, rightLeg: { x: 0, y: 0, angle: -angle },
    leftArm: { x: 0, y: 0, angle: angle / 2 },
  });
  hero.animation = { idle: "none", blink: true, keyframes: [
    key(hero, 0, { x: 704 }),
    key(hero, 0.55, { x: 704, joints: stride(0) }),
    key(hero, 0.95, { x: 686, joints: stride(17) }),
    key(hero, 1.35, { x: 672, joints: stride(-16) }),
    key(hero, 1.75, { x: 658, joints: stride(0) }),
    key(hero, 2.5, { x: 658, joints: stride(0) }),
    ...[600, 542, 484, 426, 368, 310, 265].map((x, i) =>
      key(hero, 2.85 + i * 0.39, { x, easing: "linear", joints: stride(i === 6 ? 0 : i % 2 ? -19 : 19) })),
    key(hero, 8.7, { x: 265, emotion: "happy", mouth: "smile" }),
  ] };
  friend.animation = { idle: "none", blink: true, keyframes: [
    key(friend, 0, {}),
    key(friend, 6.55, { emotion: "happy", mouth: "smile", heart: "helping", heartStrength: 0.9 }),
  ] };
  const can = { ...wateringCan, sceneryDepth: undefined, scale: 0.67 };
  const question = "How can we help a thirsty plant?";
  return validateProject({
    ...project, lesson: "Notice what plants need and care for them gently.",
    scenes: [{
      ...scene, duration, title: "A little drink for the garden", transition: "cut", question,
      action: "Helping Hands waters the seedling after carrying the watering can across the garden, then sets it down. Shine smiles.",
      narration: "Helping Hands notices a thirsty seedling. A little water can help it grow.",
      dialogue: "", gentleDepth: true,
      elements: scene.elements.map(item => item === actor ? hero : item === shine ? friend : item === wateringCan ? can : item),
      cameraAnimation: { keyframes: [
        { id: uid(), time: 0, easing: "linear", x: 439, y: 234, zoom: 1.09 },
        { id: uid(), time: 5.4, easing: "ease-in-out", x: 359, y: 238, zoom: 1.08 },
      ] },
      interactions: [{
        id: uid(), kind: "water", actorId: hero.id, objectId: can.id, start: 1.75, attach: 2.42,
        grip: { hand: "right", x: 5, y: 18 },
        release: { time: 8.35, position: { x: 236, y: 393 } }, finish: 8.7,
      }],
    }],
    captions: [{ id: uid(), sceneId: scene.id, start: 8.8, end: duration, text: question }],
  });
}
