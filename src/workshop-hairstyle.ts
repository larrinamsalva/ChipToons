import { validateProject } from "./model";
import type { Project } from "./model";
import type { PuppetRig } from "./puppet-model";

/** The visible choices in the original workshop character editor. */
export type WorkshopHairstyleChoice =
  | "original"
  | NonNullable<PuppetRig["headStyle"]>;

/**
 * Return a new, validated project with only the selected workshop
 * performer's HAIRSTYLE updated. The choice belongs to the character rig,
 * not an individual scene's color overlay, so it survives save/restore
 * and follows the performer across their own authored scenes.
 *
 * Never edit source projects, custom photo parts, other characters,
 * animation keys, dialogue, audio, motion or original handoff positions.
 */
export function setWorkshopHairstyle(
  source: Project,
  characterId: string,
  choice: WorkshopHairstyleChoice,
): Project {
  const original = source.characters.find(c => c.id === characterId);
  if (!original?.puppet || original.puppet.costume !== "workshop" ||
      !!original.assetId || original.puppet.parts.some(part =>
        (part.role === "hair" || part.role === "head") && !!part.assetId))
    throw new Error("Choose an original editable workshop character to change its hairstyle.");
  const style = choice === "original" ? undefined : choice;
  if (original.puppet.headStyle === style) return source;
  return validateProject({
    ...source,
    characters: source.characters.map(c =>
      c.id === characterId
        ? { ...c, puppet: { ...c.puppet!, headStyle: style } }
        : c),
  });
}
