import { describe, expect, it } from "vitest";
import { setWorkshopHairstyle } from "./workshop-hairstyle";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { handAt } from "./interaction-motion";
import { validateProject } from "./model";
import { sceneFramesAt } from "./timeline";
import { sunnyRig } from "./puppet-model";

describe("PR #146 original workshop hairstyle choice", () => {
  it("changes only one performer and preserves all authored scenes and sound", () => {
    const project = littleFixersArticulatedWorkshop();
    const [scout, jo] = project.characters;
    const previous = JSON.stringify(project);
    const updated = setWorkshopHairstyle(project, scout.id, "soft-waves");
    expect(validateProject(updated)).toBeTruthy();
    expect(updated).not.toBe(project);
    expect(updated.characters[0].puppet?.headStyle).toBe("soft-waves");
    // validateProject normalizes/clones returned records: compare actual
    // content, not shared JavaScript identity. Jo's data stays unchanged.
    expect(updated.characters[1]).toStrictEqual(jo);
    expect(updated.scenes).toStrictEqual(project.scenes);
    expect(updated.audioAssets).toStrictEqual(project.audioAssets);
    expect(updated.audioClips).toStrictEqual(project.audioClips);
    expect(updated.scenes[0].interactions).toStrictEqual(project.scenes[0].interactions);
    expect(JSON.stringify(project)).toBe(previous);
    const restored = JSON.parse(JSON.stringify(updated));
    expect(restored.characters[0].puppet.headStyle).toBe("soft-waves");
    const originalRig = updated.characters[0].puppet!;
    const back = setWorkshopHairstyle(updated, scout.id, "original");
    expect(back.characters[0].puppet?.headStyle).toBeUndefined();
    expect(back.characters[0].puppet?.parts).toEqual(originalRig.parts);
    expect(back.characters[1].puppet?.headStyle).toBe("soft-waves");
    expect(setWorkshopHairstyle(back, scout.id, "short-side-part")
      .characters[0].puppet?.headStyle).toBe("short-side-part");
  });

  it("keeps the prop anchored at its original position and leaves frames unchanged", () => {
    const project = littleFixersArticulatedWorkshop();
    const scene = project.scenes[0], action = scene.interactions![0];
    const first = sceneFramesAt(project, scene, 7);
    const updated = setWorkshopHairstyle(project, project.characters[1].id, "short-side-part");
    const next = sceneFramesAt(updated, updated.scenes[0], 7);
    expect(next).toEqual(first);
    const actor = scene.elements.find(e => e.id === action.actorId)!;
    const held = next.get(action.objectId)!;
    const attached = handAt(updated.characters[0], actor, next.get(actor.id)!, action.grip);
    expect(held.x).toBeCloseTo(attached.x, 7);
    expect(held.y).toBeCloseTo(attached.y, 7);
    expect(setWorkshopHairstyle(updated, project.characters[1].id, "short-side-part")).toBe(updated);
  });

  it("refuses nonworkshop, image-backed and painted-head performers", () => {
    const project = littleFixersArticulatedWorkshop();
    const id = project.characters[0].id;
    expect(() => setWorkshopHairstyle(project, "missing", "soft-waves")).toThrow();
    const nonWorkshop = { ...project, characters: project.characters.map(c =>
      c.id === id ? { ...c, puppet: sunnyRig() } : c) };
    expect(() => setWorkshopHairstyle(nonWorkshop, id, "soft-waves")).toThrow();
    const photo = { ...project, characters: project.characters.map(c =>
      c.id === id ? { ...c, assetId: "a-reference-image" } : c) };
    expect(() => setWorkshopHairstyle(photo, id, "soft-waves")).toThrow();
    const painted = { ...project, characters: project.characters.map(c =>
      c.id === id ? { ...c, puppet: { ...c.puppet!,
        parts: c.puppet!.parts.map(p => p.role === "head"
          ? { ...p, assetId: "painted" } : p) } } : c) };
    expect(() => setWorkshopHairstyle(painted, id, "soft-waves")).toThrow();
  });
});
