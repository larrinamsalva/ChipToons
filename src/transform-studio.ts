import { copyArtworkAssets, libraryItemFromElement, validateLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { uid } from "./model";
import type { Asset, Project, SceneElement } from "./model";
import { appearancesFor } from "./transform-model";
import type { ObjectState, ObjectTrack, StateArt } from "./transform-model";

export function newObjectTrack(object: SceneElement): ObjectTrack {
  const choices = appearancesFor(object.prop);
  const states: ObjectState[] = choices.length
    ? choices.map(([appearance, name]) => ({ id: uid(), name, art: { kind: "prop", appearance } }))
    : [{ id: uid(), name: "Original", art: { kind: "original" } },
       { id: uid(), name: "Finished", art: { kind: "original" } }];
  return { objectId: object.id, initial: states[0].id, states, changes: [] };
}

export function stateArtworkFromLibrary(item: LibraryItem, destination: Asset[]) {
  const source = validateLibraryItem(item);
  if (source.assetId) {
    const id = copyArtworkAssets(destination, source.assets.filter(asset => asset.id === source.assetId)).get(source.assetId)!;
    return { kind: "image", assetId: id, crop: source.transform.crop } satisfies StateArt;
  }
  if (source.propAppearance) return { kind: "prop", appearance: source.propAppearance } satisfies StateArt;
  return { kind: "original" } satisfies StateArt;
}

export function libraryArtworkFromState(project: Project, object: SceneElement, state: ObjectState) {
  const art = state.art;
  const variant = art.kind === "image"
    ? { ...object, kind: "art" as const, prop: undefined, propAppearance: undefined, assetId: art.assetId, crop: art.crop }
    : art.kind === "prop" ? { ...object, kind: "prop" as const, assetId: undefined, propAppearance: art.appearance } : object;
  return libraryItemFromElement(project, { ...variant, name: state.name });
}
