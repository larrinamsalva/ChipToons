import type { CameraShot, ShotStyle } from "./camera-shots";
import { shotIssue } from "./camera-shots";
import { uid, validateProject } from "./model";
import { littleFixersVoicedListeningShowcase } from "./little-fixers-voiced-listening-showcase";

export const SCOUT_JO_CAMERA_TITLE =
  "Little Fixers Club — Scout & Jo's Cinematic Conversation (34-second voiced cartoon)";

/**
 * Standalone, editable real-cartoon camera coverage of the already-approved
 * Scout/Jo listening scene. Camera cuts are authored from ORIGINAL three
 * recorded take positions, not fabricated dialogue or frame-time heuristics.
 * Shot boundaries stay locked to the original recording start times, while
 * the existing Stage camera sampler eases briefly between compositions.
 * Never change the existing Scout-only or #101 voiced-listening examples.
 */
export async function littleFixersCinematicConversation() {
  const original = await littleFixersVoicedListeningShowcase();
  const scene = original.scenes[0];
  const scout = scene.elements.find(element =>
    element.characterId === original.characters[0].id)!;
  const jo = scene.elements.find(element =>
    element.characterId === original.characters[1].id)!;
  const tracks = scout.voiceMouth ?? [];
  const starts = tracks.map(track => original.audioClips.find(
    clip => clip.id === track.clipId && clip.assetId === track.sourceId &&
      !clip.muted && clip.category === "dialogue")?.start);
  if (starts.length !== 3 || starts.some(start =>
    start === undefined || !Number.isFinite(start)) ||
    !((starts[0] as number) < (starts[1] as number) &&
      (starts[1] as number) < (starts[2] as number))) {
    throw new Error("The original three Scout recordings need timing review before adding camera coverage.");
  }
  const [one, two, three] = starts as number[];
  const shot = (style: ShotStyle, start: number, end: number, note: string,
    targets: string[] = [], zoom = 1, offsetY = 0,
    extra: Partial<CameraShot> = {}): CameraShot => ({
    id: uid(), style, start, end, note, targets,
    // The first establishing shot is steady. Each later, fully editable
    // camera record briefly eases out of its predecessor's real framing,
    // instead of snapping between faces. This uses the existing native
    // Shot Director `move` field, shared by preview and WebM.
    move: start === 0 ? 0 : Math.min(end - start,
      style === "wide" ? .82 :
      style === "pair" ? .68 :
      style === "reaction" ? .60 : .48),
    frame: { x: 400, y: 225, zoom },
    follow: false, offset: { x: 0, y: offsetY },
    placement: "center", overlays: true, ...extra,
  });
  // Preserve conversation screen direction in the ORIGINAL authored
  // camera records: Scout stays to frame-left (looking toward Jo), and Jo
  // stays to frame-right (toward Scout). The space between them is the
  // visual "look room" that makes a shot/reverse-shot feel connected.
  // Pair/wide views stay centered; timing and actor animation are untouched.
  const shots: CameraShot[] = [
    shot("pair", 0, one, "Establish Scout and Helper Jo together.", [scout.id, jo.id], 1.4, -90),
    shot("close", one, one + 3.8, "Scout speaks the first approved greeting.", [scout.id], 2.05, -125,
      { lineId: scene.script?.lines[0]?.id, placement: "left" }),
    shot("pair", one + 3.8, two, "Return to both original characters in the pause.", [scout.id, jo.id], 1.4, -95),
    shot("close", two, two + 3.8, "Stay with Scout for his second original recorded line.", [scout.id], 2.05, -125,
      { lineId: scene.script?.lines[1]?.id, placement: "left" }),
    shot("reaction", two + 3.8, two + 8.3,
      "Show Helper Jo's actual eye/head listening reaction, without creating a Jo voice.",
      [jo.id], 1.85, -115, { placement: "right" }),
    shot("pair", two + 8.3, three,
      "Let the real silent pause and the workshop setting breathe.", [scout.id, jo.id], 1.4, -92),
    shot("close", three, three + 3.8,
      "Scout shares the third and final approved recording.", [scout.id], 2, -125,
      { lineId: scene.script?.lines[2]?.id, placement: "left" }),
    shot("reaction", three + 3.8, three + 7.8,
      "Hold on Helper Jo responding gently to the closing message.", [jo.id], 1.85, -115,
      { placement: "right" }),
    shot("wide", three + 7.8, scene.duration,
      "Close with the full, safe workshop and both performers."),
  ];
  const covered = shots[0].start === 0 &&
    Math.abs(shots.at(-1)!.end - scene.duration) < 1e-8 &&
    shots.every((item, index) => item.end > item.start &&
      (index === 0 || Math.abs(shots[index - 1].end - item.start) < 1e-8));
  if (!covered || shotIssue(shots, { ...scene, cameraShots: shots })) {
    throw new Error("Cinematic coverage needs review: original voice times do not fit the scene.");
  }
  return validateProject({
    ...original, title: SCOUT_JO_CAMERA_TITLE,
    templateId: "little-fixers-cinematic-conversation",
    idea: "Real edited cartoon coverage: paired dialogue views, Scout's existing recorded lines, Helper Jo's genuine silent listening reactions, and an ending wide shot.",
    scenes: [{
      ...scene,
      title: "Scout and Jo — editable cinematic coverage of three genuine recordings",
      cameraShots: shots,
    }],
  });
}
