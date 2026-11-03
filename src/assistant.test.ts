import { describe, expect, it } from "vitest";
import {
  applyDirections,
  createAssistantDraft,
  directScene,
  PLAYGROUND_BRIEF,
  START_BRIEF,
  suggestDirection,
  suggestPattern,
  suggestScript,
} from "./assistant";
import { freshCharacter, newLibraryItem } from "./library";
import { validateProject } from "./model";
import { cameraAt, elementAt } from "./timeline";

const cast = [{ name: "Shine" }, { name: "Sunny" }, { name: "Sam" }];

describe("local cartoon assistant", () => {
  it("plans deterministically and uses different story patterns and supplied story details", () => {
    const names = cast.map((c) => c.name);
    const script = suggestScript(PLAYGROUND_BRIEF, names);
    expect(suggestScript(PLAYGROUND_BRIEF, names)).toEqual(script);
    expect(script[2].narration).toContain("unsure how to join");
    const idea =
      "A stranger asks for private information. Shine decides to tell a trusted adult.";
    const safety = {
      ...START_BRIEF,
      ...{ idea, setting: "the library", lesson: "Ask a trusted adult." },
      pattern: suggestPattern(idea),
    };
    const alternate = suggestScript(safety, names);
    expect(safety.pattern).toBe("safety");
    expect(alternate[3].narration).toContain(
      "Shine decides to tell a trusted adult",
    );
    expect(alternate[3].dialogue).toContain("trusted grown-up");
    expect(alternate[2].narration).not.toEqual(script[2].narration);
    expect(
      suggestScript({ ...safety, growing: true, episode: 12 }, names).at(-1)
        ?.question,
    ).toMatch(/another choice/);
  });

  it("requests a goal for vague input and preserves explicitly supplied details over cues", () => {
    expect(() =>
      suggestScript({ ...PLAYGROUND_BRIEF, idea: "Friends", goal: "" }, [
        "Shine",
      ]),
    ).toThrow(/main character want/);
    const script = suggestScript(
      {
        ...PLAYGROUND_BRIEF,
        idea: "Shine wants to race. Sam decides to wait.",
        goal: "Wait for Sam",
      },
      ["Shine"],
    );
    expect(script[1].narration).toBe("Wait for Sam.");
    expect(script[2].dialogue.split("\n")).toHaveLength(1);
    expect(() =>
      createAssistantDraft({ ...PLAYGROUND_BRIEF, count: 121 }, cast),
    ).toThrow(/scene count/);
    expect(() =>
      createAssistantDraft(PLAYGROUND_BRIEF, [
        { name: "Sam" },
        { name: "sam" },
      ]),
    ).toThrow(/different name/);
  });

  it("creates schema-4 drafts with editable movement, valid references, unique keys and supported camera shots", () => {
    const draft = createAssistantDraft(PLAYGROUND_BRIEF, cast, "tree");
    const project = applyDirections(draft.project, draft.directions);
    expect(validateProject(project)).toEqual(project);
    expect(project.scenes).toHaveLength(6);
    expect(project.scenes[0].elements.at(-1)?.prop).toBe("tree");
    expect(project.scenes[0].background).toBe("playground");
    for (const scene of project.scenes)
      expect(
        scene.elements.filter((e) => e.characterId).map((e) => e.characterId),
      ).toEqual(project.characters.map((c) => c.id));
    const scene = project.scenes[3],
      acting = scene.elements.find((e) => e.animation)!;
    expect(acting.animation?.keyframes).toHaveLength(13);
    expect(elementAt(acting, 3, scene.duration).x).not.toBe(acting.x);
    expect(scene.cameraAnimation?.followId).toBe(acting.id);
    expect(cameraAt(scene, 3).x).not.toBe(cameraAt(scene, 0).x);
    expect(
      project.scenes[2].elements.at(-1)?.animation?.keyframes[0].heart,
    ).toBe("sad");
    expect(project.scenes[4].elements[0].animation?.keyframes[0].heart).toBe(
      "together",
    );
    expect(
      project.scenes.every((s) => s.duration >= 2 && s.duration <= 120),
    ).toBe(true);
  });

  it("copies saved character artwork without changing the source and limits raster actions to whole images", () => {
    const character = freshCharacter("Mira");
    const asset = {
      id: "my-image",
      name: "Original art",
      type: "image" as const,
      mime: "image/png" as const,
      dataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6GxkAAAAASUVORK5CYII=",
    };
    const library = {
      ...newLibraryItem("character"),
      name: "Mira",
      character: { ...character, assetId: asset.id },
      assets: [asset],
    };
    const before = structuredClone(library);
    const draft = createAssistantDraft(PLAYGROUND_BRIEF, [
      { name: "Shine", library },
      ...cast.slice(1),
    ]);
    const project = applyDirections(draft.project, draft.directions);
    expect(library).toEqual(before);
    expect(project.assets[0].dataUrl).toBe(asset.dataUrl);
    expect(
      project.scenes[3].elements[0].animation?.keyframes.length,
    ).toBeGreaterThan(2);
    const direction = { ...draft.directions[3], action: "wave" as const };
    expect(() =>
      directScene(draft.project, draft.project.scenes[3], direction, false),
    ).toThrow(/supported/);
  });

  it("rejects overfull animation tracks and avoids suggesting a walk against an explicit cue", () => {
    const draft = createAssistantDraft(
      {
        ...PLAYGROUND_BRIEF,
        idea: "Shine does not walk over. The child asks for help.",
      },
      cast,
    );
    expect(draft.directions[3].action).not.toBe("walk");
    const project = applyDirections(draft.project, draft.directions);
    const scene = project.scenes[4];
    const track = scene.elements[0].animation!;
    track.keyframes = Array.from({ length: 121 }, (_, i) => ({
      ...track.keyframes[0],
      id: `extra-key-${i}`,
      time: i / 50,
    }));
    expect(() => applyDirections(project, [])).toThrow();
  });

  it("previews and approves only selected tracks without changing source, audio, artwork or existing animation", () => {
    const draft = createAssistantDraft(PLAYGROUND_BRIEF, cast);
    const protectedScene = directScene(
      draft.project,
      draft.project.scenes[3],
      draft.directions[3],
      false,
    );
    const source = {
      ...draft.project,
      scenes: draft.project.scenes.map((s, i) =>
        i === 3 ? protectedScene : s,
      ),
    };
    const before = structuredClone(source);
    const directions = source.scenes.map((s) =>
      suggestDirection(source, s, true),
    );
    expect(directions[3].shot).toBe("none");
    expect(directions[3].actorId).not.toBe(protectedScene.elements[0].id);
    const proposal = applyDirections(
      source,
      directions.map((d, i) => ({ ...d, enabled: i === 2 })),
      true,
    );
    expect(source).toEqual(before);
    expect(proposal.scenes[3]).toEqual(protectedScene);
    expect(proposal.scenes[2].cameraAnimation).toBeTruthy();
    expect(proposal.audioClips).toEqual(source.audioClips);
    expect(proposal.captions).toEqual(source.captions);
    expect(proposal.assets).toEqual(source.assets);
    expect(() =>
      applyDirections(
        source,
        [{ ...directions[3], enabled: true, shot: "wide" }],
        true,
      ),
    ).toThrow(/already has a camera/);
    expect(() =>
      applyDirections(
        source,
        [{ ...directions[2], enabled: true, seconds: 999 }],
        true,
      ),
    ).toThrow(/timing/);
    expect(() =>
      applyDirections(source, [{ ...directions[2], sceneId: "missing" }], true),
    ).toThrow(/storyboard changed/);
    expect(() =>
      applyDirections(
        { ...source, scenes: [{ ...source.scenes[0], duration: 121 }] },
        [],
      ),
    ).toThrow();
    expect(() =>
      validateProject({
        ...source,
        assets: Array.from({ length: 41 }, (_, i) => ({ id: String(i) })),
      }),
    ).toThrow();
  });
});
