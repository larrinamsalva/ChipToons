import { articulatedWorkshopCharacter } from "./little-fixers-articulated-workshop";
import type { Character } from "./model";

/**
 * A new, INDEPENDENT original full-body workshop performer for Puppet Maker.
 *
 * Starts with the proven fifteen-part shoulders/elbows/hands/knees/shins/boots
 * from the Little Fixers pilot, but isn't Scout or Jo and isn't a saved
 * episode: creators own this fresh character, name and appearance.
 *
 * Never mutates an existing cartoon, library item, keyframe or cast record.
 */
export function newWorkshopPuppetStarter(): Character {
  const actor = articulatedWorkshopCharacter("scout", true);
  return {
    ...actor,
    name: "My Workshop Character",
    puppet: {
      ...actor.puppet!,
      description:
        "Original customizable 15-part workshop cartoon puppet with real shoulders, elbows, hands, knees, shins and boots. Its poses and original face are yours to edit.",
    },
  };
}
