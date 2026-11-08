import { describe, expect, it } from "vitest";
import { handoffAcknowledgementAt, cinematicHandoffNodAt } from "./cinematic-handoff-acknowledgement";
import { cinematicFaceAt } from "./cinematic-face";
import { littleFixersArticulatedWorkshop } from "./little-fixers-articulated-workshop";
import { sceneElementAt, sceneFramesAt } from "./timeline";

function fixture() {
  const project = littleFixersArticulatedWorkshop();
  const scene = project.scenes[0];
  const share = scene.interactions![0];
  const scout = scene.elements.find(item => item.id === share.actorId)!;
  const jo = scene.elements.find(item => item.id === share.transfer!.actorId)!;
  return { project, scene, share, scout, jo };
}

describe("Cinematic mutual acknowledgement after a safe handoff", () => {
  it("gives Scout and Jo small staggered nods after the checklist is released", () => {
    const { project, scene, share, scout, jo } = fixture();
    const snapshot = JSON.stringify(project);
    const moment = 12.55;
    const frames = sceneFramesAt(project, scene, moment);
    expect(frames.get(share.objectId)?.heldBy).toBeUndefined();
    const scoutCue = handoffAcknowledgementAt(project, scene, scout, moment, false)!;
    const joCue = handoffAcknowledgementAt(project, scene, jo, moment, false)!;
    expect(scoutCue.partnerId).toBe(jo.id);
    expect(joCue.partnerId).toBe(scout.id);
    expect(scoutCue.attention).toBeGreaterThan(0.85);
    expect(joCue.attention).toBeGreaterThan(0.6);
    expect(scoutCue.nod).toBeLessThan(-2);
    expect(joCue.nod).toBeGreaterThan(-2.3);
    for (const [actor, cue] of [[scout, scoutCue], [jo, joCue]] as const) {
      const authored = sceneElementAt(project, scene, actor, moment, 0);
      const after = frames.get(actor.id)!;
      expect(after.joints?.head?.angle ?? 0)
        .toBeCloseTo((authored.joints?.head?.angle ?? 0) + cue.nod, 7);
      expect(Math.abs(cue.nod)).toBeLessThanOrEqual(2.8);
      expect(sceneFramesAt(project, scene, moment).get(actor.id)).toEqual(after);
    }
    expect(JSON.stringify(project)).toBe(snapshot);
  });

  it("makes the performers briefly look at each other, then restores normal gaze", () => {
    const { project, scene, scout, jo } = fixture();
    const at = (actor: typeof scout, time: number) => {
      const frames = sceneFramesAt(project, scene, time);
      return cinematicFaceAt(project, scene, actor, frames.get(actor.id)!, frames,
        time, false)!;
    };
    const scoutLook = at(scout, 12.55), joLook = at(jo, 12.55);
    expect(scoutLook.x).toBeGreaterThan(1.3);
    expect(joLook.x).toBeLessThan(-1);
    expect(at(scout, 12.55)).toEqual(scoutLook);
    expect(at(jo, 12.55)).toEqual(joLook);
    expect(handoffAcknowledgementAt(project, scene, scout, 13.5, false)).toBeUndefined();
    expect(handoffAcknowledgementAt(project, scene, jo, 13.5, false)).toBeUndefined();
  });

  it("starts at zero, ends at zero and never invents new keyframes or changes the real prop", () => {
    const { project, scene, share, scout, jo } = fixture();
    for (const time of [0, 7, 9.8, 12, 13.5, 20, 29.8]) {
      const frames = sceneFramesAt(project, scene, time);
      const prop = frames.get(share.objectId)!;
      expect(handoffAcknowledgementAt(project, scene, scout, time, false)).toBeUndefined();
      expect(handoffAcknowledgementAt(project, scene, jo, time, false)).toBeUndefined();
      expect(prop.x).toBeCloseTo(time >= 12 ? 464 : prop.x, 6);
      const baseline = sceneElementAt(project, scene, scout, time, 0);
      if (time >= 13.5) expect(frames.get(scout.id)?.joints?.head?.angle)
        .toBeCloseTo(baseline.joints?.head?.angle ?? 0, 6);
    }
  });

  it("does not override Classic, calm editing, painted heads or other authored actions", () => {
    const { project, scene, scout } = fixture();
    const time = 12.55;
    const base = sceneElementAt(project, scene, scout, time, 0);
    expect(handoffAcknowledgementAt(project, scene, scout, time, true)).toBeUndefined();
    expect(cinematicHandoffNodAt(project, scene, scout, base, time, true)).toEqual(base);
    project.visualStyle = undefined;
    expect(handoffAcknowledgementAt(project, scene, scout, time, false)).toBeUndefined();
    expect(cinematicHandoffNodAt(project, scene, scout, base, time, false)).toEqual(base);
    project.visualStyle = "storybook-cinematic";
    const character = project.characters[0];
    project.characters[0] = { ...character, puppet: {
      ...character.puppet!, parts: character.puppet!.parts.map(part =>
        part.role === "head" ? { ...part, assetId: "painted-head" } : part),
    } };
    expect(cinematicHandoffNodAt(project, scene, scout, base, time, false)).toEqual(base);
    project.characters[0] = character;

    const noTransfer = { ...scene, interactions: undefined };
    expect(cinematicHandoffNodAt(project, noTransfer, scout, base, time, false))
      .toEqual(base);
    const noRelease = { ...scene, interactions: [{
      ...scene.interactions![0], release: undefined,
    }] };
    expect(cinematicHandoffNodAt(project, noRelease, scout, base, time, false))
      .toEqual(base);
    const busy = { ...scene, interactions: [...scene.interactions!, {
      ...scene.interactions![0], id: "other-action", start: 12.3, finish: 13.1,
    }] };
    expect(cinematicHandoffNodAt(project, busy, scout, base, time, false)).toEqual(base);
  });
});
