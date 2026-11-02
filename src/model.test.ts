import { describe, expect, it, vi } from "vitest";
import {
  clone,
  duplicateProject,
  MAX_PROJECT_BYTES,
  parseBackup,
  totalDuration,
  uid,
  validateProject,
} from "./model";
import { DEFAULT_IDEA, planStory, STARTERS, starterProject } from "./planner";

describe("local story planning and project backups", () => {
  it("creates unique project IDs on local HTTP previews without randomUUID", () => {
    const nativeCrypto = globalThis.crypto;
    try {
      vi.stubGlobal("crypto", {
        getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto),
      });
      const first = uid();
      expect(first).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(uid()).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("makes complete, independent, editable starter stories with an honest one-minute duration", () => {
    for (const starter of STARTERS) {
      const p = starterProject(starter.id);
      expect(validateProject(p)).toEqual(p);
      expect(p.scenes).toHaveLength(6);
      expect(totalDuration(p)).toBe(60);
      expect(
        p.scenes.every(
          (s) => s.narration && s.dialogue && s.elements.length === 2,
        ),
      ).toBe(true);
      expect(p.scenes[0].background).toBe(starter.background);
    }
  });
  it("keeps the creator’s idea and planning choices without claiming full-length generation", () => {
    const p = planStory({
      ...DEFAULT_IDEA,
      idea: "A small cloud learns to share rain",
      title: "Cloud friends",
      names: "Dot, Rain",
      plannedMinutes: 20,
      artStyle: "Clay",
      mood: "funny",
    });
    expect(p.title).toBe("Cloud friends");
    expect(p.characters.map((c) => c.name)).toEqual(["Dot", "Rain"]);
    expect(p.outline.beginning).toContain("A small cloud learns to share rain");
    expect(p.scenes[0].narration).toContain(p.idea);
    expect(p.plannedMinutes).toBe(20);
    expect(totalDuration(p)).toBe(60);
    expect(() => planStory({ ...DEFAULT_IDEA, idea: "  " })).toThrow();
  });
  it("round trips the entire project, edits and original assets", () => {
    const p = starterProject();
    p.scenes[2].narration = "My revised scene.";
    p.assets.push({
      id: "original",
      type: "image",
      name: "my-art.png",
      mime: "image/png",
      dataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });
    p.characters[0].assetId = "original";
    expect(parseBackup(JSON.stringify(p))).toEqual(p);
    const copied = duplicateProject(p);
    expect(copied.id).not.toBe(p.id);
    expect(copied.assets).toEqual(p.assets);
    copied.scenes[0].title = "Changed copy";
    expect(p.scenes[0].title).not.toBe("Changed copy");
  });
  it.each([
    (p: ReturnType<typeof starterProject>) => {
      p.schemaVersion = 99 as 1;
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes = [];
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes[0].duration = 0;
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes[0].elements[0].x = Infinity;
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes[0].elements[0].characterId = "missing";
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes[1].id = p.scenes[0].id;
    },
    (p: ReturnType<typeof starterProject>) => {
      p.characters[0].shirt = "url(javascript:alert(1))";
    },
    (p: ReturnType<typeof starterProject>) => {
      p.characters[0].assetId = "missing";
    },
    (p: ReturnType<typeof starterProject>) => {
      p.scenes[0].elements[0].motion = "execute-script" as "still";
    },
  ])(
    "rejects malformed graphs before changing any existing work (%#)",
    (corrupt) => {
      const original = starterProject();
      const p = clone(original);
      corrupt(p);
      expect(() => validateProject(p)).toThrow(/invalid or unsupported/);
      expect(validateProject(original)).toEqual(original);
    },
  );
  it("rejects active SVG/remote assets, oversized imports and malformed JSON", () => {
    const p = starterProject();
    p.assets.push({
      id: "bad",
      name: "evil.svg",
      type: "image",
      mime: "image/png",
      dataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
    });
    expect(() => parseBackup(JSON.stringify(p))).toThrow();
    p.assets[0].dataUrl = "https://example.com/tracking.png";
    expect(() => validateProject(p)).toThrow();
    expect(() => parseBackup("{invalid")).toThrow(/not valid/);
    expect(() => parseBackup(" ".repeat(MAX_PROJECT_BYTES + 1))).toThrow(
      /too large/,
    );
  });
});
