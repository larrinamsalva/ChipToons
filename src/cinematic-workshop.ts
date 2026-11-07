import type { SceneryDepth } from "./art-model";
import { stagePoint } from "./interaction-motion";
import type { InteractionFrame } from "./interaction-motion";
import type { Character, SceneElement } from "./model";
import { puppetTransforms } from "./puppet-model";
import type { ElementFrame } from "./timeline";
import { sceneryParallax } from "./world-model";

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function workshopLayerTransform(depth: SceneryDepth, camera: { x: number; y: number; zoom: number }, calm: boolean) {
  const offset = calm ? { x: 0, y: 0 } : sceneryParallax(depth, camera);
  const rate = depth === "behind" ? -0.035 : depth === "front" ? 0.025 : 0;
  const scale = calm ? 1 : 1 + clamp(camera.zoom - 1, -0.5, 2) * rate;
  return `translate(${offset.x} ${offset.y}) translate(400 290) scale(${scale}) translate(-400 -290)`;
}

export interface GroundShadow {
  id: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  opacity: number;
}

const groundedProps = new Set<SceneElement["prop"]>([
  "chair", "table", "toolbox", "toy-wagon", "recycling-bin", "flower-pot", "watering-can", "toy", "picnic-basket", "sign",
]);

// Use the same final actor/interaction frame as Stage, with the authored floor
// position kept separate from secondary body bob and airborne foot movement.
export function workshopGroundShadows(element: SceneElement, frame: InteractionFrame,
  floor: Pick<ElementFrame, "y" | "scale">, character?: Character): GroundShadow[] {
  if (frame.heldBy || element.backdrop || element.flipY || frame.opacity <= 0 ||
      (!character && !groundedProps.has(element.prop))) return [];
  const rig = character?.puppet;
  if (rig) {
    const rest = puppetTransforms(rig);
    const animated = puppetTransforms(rig, frame.joints);
    const feet = rig.parts.flatMap((part, index) => {
      if (part.role !== "leftFoot" && part.role !== "rightFoot") return [];
      const sole = part.height / 2 - part.pivotY + (rig.costume === "workshop" && !part.assetId ? 2 : 0);
      const angle = animated[index].angle * Math.PI / 180;
      const x = -part.pivotX;
      const point = stagePoint(element, frame, {
        x: animated[index].x + x * Math.cos(angle) - sole * Math.sin(angle),
        y: animated[index].y + x * Math.sin(angle) + sole * Math.cos(angle),
      });
      return [{ id: part.id, point, width: part.width * frame.scale,
        restY: rest[index].y + sole }];
    });
    if (feet.length) {
      const groundY = Math.max(floor.y + Math.max(...feet.map(foot => foot.restY)) * floor.scale,
        ...feet.map(foot => foot.point.y));
      const left = Math.min(...feet.map(foot => foot.point.x - foot.width * 0.45));
      const right = Math.max(...feet.map(foot => foot.point.x + foot.width * 0.45));
      return [
        { id: "body", x: (left + right) / 2, y: groundY + 1, rx: (right - left) / 2 + 13 * frame.scale,
          ry: 7 * frame.scale, opacity: 0.18 * frame.opacity },
        ...feet.map(foot => {
          const contact = clamp(1 - (groundY - foot.point.y) / (34 * frame.scale), 0.15, 1);
          return { id: foot.id, x: foot.point.x, y: groundY, rx: foot.width * 0.62,
            ry: 4 * frame.scale, opacity: 0.55 * contact * frame.opacity };
        }),
      ];
    }
  }
  const lift = character ? Math.max(0, floor.y - frame.y) : 0;
  const radius = character ? 45 : element.prop === "table" ? 63 : element.prop === "chair" ? 36 : 28;
  return [{ id: "base", x: frame.x, y: (character ? floor.y : frame.y) + 2 * frame.scale,
    rx: radius * frame.scale, ry: (character ? 8 : 6) * frame.scale,
    opacity: 0.42 * clamp(1 - lift / 60, 0.15, 1) * frame.opacity }];
}
