import type { LibraryItem } from "./library";
import type { SceneElement } from "./model";
import type { LocationLayout } from "./world-model";
import type { PropName, SceneryDepth } from "./art-model";
import { propLabel } from "./art-model";

type Placement = [PropName, x: number, y: number, size: number, depth?: SceneryDepth];
type Starter = [id: string, name: string, description: string, background: LocationLayout["background"], props: Placement[]];
const starters: Starter[] = [
  ["playground", "Kind Hearts Playground", "A slide, swings and a sunny path for making new friends.", "playground", [
    ["swing-set", 185, 298, 1.15, "behind"], ["slide", 625, 315, 1.18, "behind"],
    ["bench", 665, 370, 0.82], ["tree", 55, 319, 0.9, "behind"], ["flower", 101, 433, 0.54, "front"],
    ["toy-wagon", 240, 396, 0.55], ["flower-pot", 751, 437, 0.62, "front"],
  ]],
  ["classroom", "Little Learning Classroom", "A bright learning display, small desks and a reading shelf.", "classroom", [
    ["shelf", 656, 287, 0.95, "behind"], ["table", 155, 347, 0.9], ["chair", 97, 363, 0.72],
    ["book", 162, 293, 0.35], ["table", 584, 389, 0.9], ["book", 577, 329, 0.35], ["flower-pot", 731, 431, 0.75, "front"],
  ]],
  ["neighborhood", "Friendly Neighborhood", "Houses, a sidewalk and a bench where neighbors can meet.", "town", [
    ["tree", 94, 325, 0.86, "behind"], ["traffic-sign", 645, 367, 0.75, "behind"],
    ["bench", 485, 351, 0.72], ["recycling-bin", 729, 388, 0.68],
    ["flower-pot", 55, 435, 0.85, "front"], ["flower", 751, 442, 0.45, "front"],
  ]],
  ["workshop", "Helping Hands Workshop", "A supervised fix-it spot with shelves, a tool bench and toys.", "classroom", [
    ["shelf", 650, 295, 1.15, "behind"], ["table", 172, 354, 1.25],
    ["toolbox", 152, 270, 0.7], ["toy", 217, 270, 0.42], ["chair", 656, 387, 0.9],
    ["toy-wagon", 105, 430, 0.85, "front"], ["recycling-bin", 741, 408, 0.68, "front"],
  ]],
  ["garden", "Community Garden", "Raised beds, spring seedlings and a watering spot.", "garden", [
    ["garden-bed", 178, 315, 1.05, "behind"], ["garden-bed", 636, 322, 1.18, "behind"],
    ["watering-can", 606, 388, 0.76], ["flower-pot", 97, 384, 0.72],
    ["garden-bed", 129, 434, 0.76, "front"], ["flower", 745, 449, 0.65, "front"],
  ]],
  ["home", "Cozy Family Home", "A warm room for reading, putting things away and helping out.", "bedroom", [
    ["shelf", 689, 297, 0.95, "behind"], ["chair", 577, 359, 0.96], ["table", 668, 385, 0.76],
    ["book", 674, 331, 0.33], ["picnic-basket", 142, 405, 0.68],
    ["flower-pot", 751, 435, 0.8, "front"], ["toy", 109, 433, 0.4, "front"],
  ]],
];

export function starterLocations(): LibraryItem[] {
  return starters.map(([id, name, description, background, props]) => {
    const elements: SceneElement[] = props.map(([prop, x, y, scale, sceneryDepth = "alongside"], index) => ({
      id: `${id}-scenery-${index}`, kind: "prop", prop, x, y, scale, sceneryDepth,
      name: propLabel(prop), characterId: "", rotation: 0, flip: false, emotion: "calm", motion: "still",
    }));
    return { version: 1, id: `starter-location-${id}`, kind: "location", name, group: "Original locations",
      tags: [id], assets: [], pose: "standing", emotion: "calm", transform: {}, updatedAt: "2026-01-01T00:00:00.000Z",
      location: { description, background, camera: "wide", gentleDepth: false, elements } };
  });
}
