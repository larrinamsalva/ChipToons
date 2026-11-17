import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { newWorkshopPuppetStarter } from "./workshop-puppet-starter";
import { articulatedWorkshopCharacter } from "./little-fixers-articulated-workshop";
import { newLibraryItem, placeLibraryItem, validateLibraryItem } from "./library";
import { starterProject } from "./planner";
import { validPuppet } from "./puppet-model";
import { PuppetArt } from "./components/PuppetArt";

describe("PR #147 independent creator-owned articulated workshop puppet", () => {
  it("creates a fresh valid 15-part performer without inheriting either demo identity", () => {
    const a = newWorkshopPuppetStarter(), b = newWorkshopPuppetStarter();
    const reference = articulatedWorkshopCharacter("scout", true);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(reference.id);
    expect(a.name).toBe("My Workshop Character");
    expect(a.name).not.toBe(reference.name);
    const rig = a.puppet!;
    expect(rig.parts).toHaveLength(15);
    expect(rig.costume).toBe("workshop");
    expect(rig.headStyle).toBe("short-side-part");
    expect(validPuppet(rig, new Set())).toBe(true);
    expect(a.assetId).toBeUndefined();
    for (const side of ["left", "right"] as const) {
      const find = (role: string) => rig.parts.find(p => p.role === role)!;
      expect(find(`${side}Forearm`).parentId).toBe(find(`${side}Arm`).id);
      expect(find(`${side}Hand`).parentId).toBe(find(`${side}Forearm`).id);
      expect(find(`${side}Shin`).parentId).toBe(find(`${side}Leg`).id);
      expect(find(`${side}Foot`).parentId).toBe(find(`${side}Shin`).id);
    }
    expect(b.puppet).toEqual(rig);
  });

  it("saves new creator artwork as a normal portable character library item", () => {
    const actor = newWorkshopPuppetStarter();
    actor.name = "My Fix-It Hero";
    actor.shirt = "#517bac";
    actor.skin = "#b67457";
    actor.hair = "#4d2c2c";
    actor.puppet = { ...actor.puppet!, headStyle: "soft-waves" };
    const originalActor = JSON.stringify(actor);
    const item = validateLibraryItem({
      ...newLibraryItem(actor.name, "character"),
      character: actor, group: "Puppets",
    });
    const saved = JSON.parse(JSON.stringify(item));
    expect(validateLibraryItem(saved)).toEqual(item);
    expect(saved.character.puppet.headStyle).toBe("soft-waves");
    const first = placeLibraryItem(starterProject(), 0, item);
    const second = placeLibraryItem(starterProject(), 0, item);
    const inserted = first.characters.find(c => c.name === actor.name)!;
    expect(inserted.puppet?.parts).toHaveLength(15);
    expect(inserted.puppet?.headStyle).toBe("soft-waves");
    expect(inserted.shirt).toBe("#517bac");
    expect(first.assets).toHaveLength(0);
    expect(first.scenes[0].elements.some(e => e.characterId === inserted.id)).toBe(true);
    expect(JSON.stringify(actor)).toBe(originalActor);
    expect(second.characters.find(c => c.name === actor.name)?.puppet)
      .toEqual(inserted.puppet);
  });

  it("previews the real sculpted workshop silhouette while keeping original Sunny separate", () => {
    const actor = newWorkshopPuppetStarter();
    const svg = renderToStaticMarkup(createElement(PuppetArt, {
      character: actor, assets: [], emotion: "happy", premium: true,
    }));
    expect(svg).toContain('data-puppet-finish="cinematic"');
    expect(svg).toContain('data-workshop-head-contour="cinematic"');
    expect(svg).toContain('data-workshop-hairstyle="short-side-part"');
    expect((svg.match(/data-puppet-part="/g) ?? []).length).toBe(15);
    const plain = renderToStaticMarkup(createElement(PuppetArt, {
      character: actor, assets: [], emotion: "happy", premium: false,
    }));
    expect(plain).not.toContain("data-workshop-hairstyle");
    const wave = { ...actor, puppet: { ...actor.puppet!, headStyle: "soft-waves" as const } };
    const updated = renderToStaticMarkup(createElement(PuppetArt, {
      character: wave, assets: [], emotion: "happy", premium: true,
    }));
    expect(updated).toContain('data-workshop-hairstyle="soft-waves"');
    expect(validPuppet(actor.puppet, new Set())).toBe(true);
  });
});
