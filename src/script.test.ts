import { describe, expect, it } from "vitest";
import { clone, uid, validateProject } from "./model";
import { planStory, DEFAULT_IDEA } from "./planner";
import { builtInSound } from "./sounds";
import {
  blankLine, chooseScriptTake, duplicateScript, editScriptLine, findScriptLine, lineStatus,
  reconcileScriptClips, scriptCaptions, scriptFor, scriptText, scriptTiming, selectedTake,
  setLineApproval, withScript,
} from "./script";
import { directionFromScript, directScene, scriptSuggestions } from "./assistant";
import { sunnyLibraryItem } from "./puppet-project";
import { placeLibraryItem } from "./library";
import { duplicateSceneMedia } from "./production";
import { duplicateAnimatedScene } from "./timeline";

const make = () => planStory({ ...DEFAULT_IDEA, idea: "Two friends make room for a new neighbor.", names: "Sunny,Sunny", title: "A fresh episode" });

function scripted() {
  const project = make(), scene = project.scenes[0];
  const line = { ...blankLine("dialogue", "Welcome to the little park."), speakerId: project.characters[1].id };
  project.scenes[0] = withScript(scene, { acting: "", emotion: "", lines: [line] });
  return { project, line };
}

describe("numbered episode scripts", () => {
  it("keeps legacy scene fields exactly until explicitly organized and keeps them synchronized afterwards", () => {
    const project = make(), scene = project.scenes[0];
    scene.dialogue = "Sunny: Hello!\n\nSunny: Good morning.  ";
    expect(validateProject(project)).toEqual(project);
    const structured = withScript(scene, scriptFor(scene));
    expect(structured.narration).toBe(scene.narration);
    expect(structured.dialogue).toBe(scene.dialogue);
    project.scenes[0] = structured;
    expect(validateProject(project).scenes[0].script).toBeDefined();
    project.scenes[0] = { ...structured, dialogue: "A conflicting legacy change" };
    expect(() => validateProject(project)).toThrow();
  });

  it("uses stable episode identities for same-name characters and retains the speaker after a rename", () => {
    const { project, line } = scripted();
    expect(project.characters.map(character => character.name)).toEqual(["Sunny", "Sunny"]);
    project.characters[1].name = "Second Sunny";
    expect(validateProject(project).scenes[0].script?.lines[0].speakerId).toBe(project.characters[1].id);
    expect(scriptText(project)).toContain("1. Second Sunny: Welcome to the little park.");
    expect(() => validateProject(editScriptLine(project, project.scenes[0].id, { ...line, speakerId: uid() }))).toThrow();
  });

  it("assigns one clip, keeps alternate sources and marks edited speech for review", () => {
    const { project, line } = scripted();
    const first = builtInSound("sparkle");
    const second = { ...first, id: uid(), name: "Second take" };
    const one = chooseScriptTake(project, line.id, first, true);
    const two = chooseScriptTake(one, line.id, second, true);
    expect(two.audioAssets).toHaveLength(2);
    expect(two.audioClips).toHaveLength(1);
    expect(two.audioClips[0]).toMatchObject({ assetId: second.id, sceneId: project.scenes[0].id, characterId: line.speakerId });
    expect(two.audioClips[0].id).toBe(one.audioClips[0].id);
    const approved = setLineApproval(two, line.id, true);
    const assigned = findScriptLine(approved, line.id)!.line;
    expect(lineStatus(approved, assigned)).toBe("Approved");
    expect(lineStatus(approved, assigned, new Set([second.id]))).toBe("Needs review");
    const edited = editScriptLine(approved, project.scenes[0].id, { ...assigned, text: "Hello again." });
    expect(lineStatus(edited, findScriptLine(edited, line.id)!.line)).toBe("Needs review");
    const switched = chooseScriptTake(edited, line.id, first);
    expect(selectedTake(switched, findScriptLine(switched, line.id)!.line).clip?.assetId).toBe(first.id);
    expect(validateProject(switched).audioAssets).toHaveLength(2);
    expect(lineStatus(approved, assigned)).toBe("Approved"); // prior immutable snapshot remains usable by Undo
  });

  it("retains takes when a clip is moved or removed and rejects invalid or duplicate references", () => {
    const { project, line } = scripted();
    const linked = chooseScriptTake(project, line.id, builtInSound("sparkle"), true);
    const detached = reconcileScriptClips({ ...linked, audioClips: [] });
    expect(lineStatus(detached, findScriptLine(detached, line.id)!.line)).toBe("Needs review");
    expect(validateProject(detached).audioAssets).toHaveLength(1);
    const scene = linked.scenes[0], script = scene.script!, assigned = script.lines[0];
    for (const bad of [
      { ...assigned, takes: [assigned.takes[0], assigned.takes[0]] },
      { ...assigned, takes: [{ ...assigned.takes[0], assetId: uid() }] },
      { ...assigned, clipId: uid() },
      { ...assigned, pause: 21 },
    ]) {
      const invalid = { ...linked, scenes: [withScript(scene, { ...script, lines: [bad] }), ...linked.scenes.slice(1)] };
      expect(() => validateProject(invalid)).toThrow();
    }
    const repeated = { ...linked, scenes: [withScript(scene, { ...script,
      lines: [assigned, { ...assigned, id: uid() }],
    }), ...linked.scenes.slice(1)] };
    expect(() => validateProject(repeated)).toThrow();
  });

  it("fits a late line’s first take into the scene when possible", () => {
    const { project, line } = scripted();
    const scene = project.scenes[0];
    project.scenes[0] = withScript(scene, { acting: "", emotion: "", lines: [
      blankLine("narration", "The other characters practice listening. ".repeat(20)), line,
    ] });
    const asset = builtInSound("sparkle");
    const recorded = chooseScriptTake(project, line.id, asset, true);
    expect(recorded.audioClips[0].start).toBeCloseTo(scene.duration - asset.duration);
    expect(recorded.audioClips[0].duration).toBeCloseTo(asset.duration);
    expect(validateProject(recorded)).toEqual(recorded);
  });

  it("duplicates scene IDs and clip links independently while reusing the original audio", () => {
    const { project, line } = scripted();
    const linked = chooseScriptTake(project, line.id, builtInSound("sparkle"), true);
    const scene = linked.scenes[0], animated = duplicateAnimatedScene(scene);
    const media = duplicateSceneMedia(linked, scene, animated);
    const copy = duplicateScript(animated, linked.audioClips, media.audioClips.slice(1));
    const next = validateProject({ ...linked, ...media, scenes: [scene, copy] });
    expect(copy.script?.lines[0].id).not.toBe(line.id);
    expect(copy.script?.lines[0].clipId).toBe(media.audioClips[1].id);
    expect(next.audioAssets).toHaveLength(1);
  });

  it("estimates speech and pauses separately and keeps manual captions unchanged", () => {
    const { project, line } = scripted();
    project.scriptOptions = { pace: 60, pause: 2 };
    expect(scriptTiming(project, project.scenes[0])).toEqual({ starts: [0], words: 5, speech: 5, pauses: 2, total: 7 });
    const scene = withScript(project.scenes[0], { acting: "", emotion: "", lines: [
      line, { ...blankLine("narration", "A quiet pause."), pause: 0.5 },
    ] });
    scene.duration = 20;
    project.scenes[0] = scene;
    const manual = { id: uid(), sceneId: scene.id, text: "Handwritten caption", start: 0, end: 3 };
    project.captions = [manual];
    const captions = scriptCaptions(project, scene);
    expect(captions).toHaveLength(2);
    expect(captions[0]).toBe(manual);
    expect(captions[1]).toMatchObject({ text: "A quiet pause.", start: 7 });
    expect(validateProject({ ...project, captions }).captions).toEqual(captions);
  });

  it("uses episode-specific cues and only previews supported new puppet actions", () => {
    const fixture = make();
    fixture.idea = "Sunny wants to greet a new neighbor.";
    fixture.scenes[0].chapter = "introduction";
    expect(scriptSuggestions(fixture, fixture.scenes[0], 0)[1].text).toContain("greet a new neighbor");
    const project = placeLibraryItem(fixture, 0, sunnyLibraryItem());
    const scene = project.scenes[0], actor = scene.elements.at(-1)!;
    const line = { ...blankLine("dialogue", "Hello, neighbor!"), speakerId: actor.characterId, delivery: "Waves hello and smiles." };
    const scripted = withScript(scene, { acting: "Waves hello", emotion: "Happy", lines: [line] });
    const direction = directionFromScript(project, scripted, line)!;
    expect(direction).toMatchObject({ action: "wave", actorId: actor.id, shot: "none" });
    const before = clone(scripted);
    const proposed = directScene(project, scripted, direction, true);
    expect(proposed.elements.at(-1)?.animation?.keyframes.length).toBeGreaterThan(2);
    expect(scripted).toEqual(before);
    expect(directionFromScript(project, proposed, line)).toBeUndefined();
  });
});
