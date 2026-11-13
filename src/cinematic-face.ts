import type { Project, Scene, SceneElement } from "./model";
import type { ElementFrame } from "./timeline";
import { handoffAcknowledgementAt } from "./cinematic-handoff-acknowledgement";
import { cinematicEmotionReactionAt } from "./cinematic-emotion-reaction";
import { cinematicEyelidClosureAt } from "./cinematic-eyelid-motion";
import { cinematicConversationListeningAt } from "./cinematic-conversation-listening";
import { cinematicSpeakingEyelineAt } from "./cinematic-conversation-speaking";
import { cinematicPairAttentionAt } from "./cinematic-pair-attention";
import { cinematicFinaleAttentionAt } from "./cinematic-finale-attention";

export interface CinematicFace {
  /** Small pupil offsets in the existing authored face coordinate system. */
  x: number;
  y: number;
  /** Subtle extra eyebrow lift in SVG units. */
  brow: number;
  /** A short anticipatory blink as attention changes. */
  blink: boolean;
  /** Animated eye closure (0=open, 1=closed) on a deterministic blink clock. */
  eyelidClosure?: number;
  /** Optional authored-emotion accent; classic art ignores both values. */
  browAsymmetry?:number;
  squint?:number;
  /** Cheek pose/accent only when an authored emotion changes. */
  cheekLift?:number;
  cheekWarmth?:number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const smooth = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * A quiet, deterministic attention pass for generated vector puppet faces.
 * Characters glance toward nearby collaborators or workshop props, then back
 * to the viewer. It never edits the scene, voice tracks or authored joints.
 *
 * Asset-backed eyes are excluded: a painted/raster gaze cannot be repositioned
 * as independent pupils without corrupting the artist's intended expression.
 */
export function cinematicFaceAt(
  project: Project,
  scene: Pick<Scene, "elements" | "interactions"> & Partial<Pick<Scene, "id" | "duration">>,
  element: SceneElement,
  frame: ElementFrame,
  frames: ReadonlyMap<string, ElementFrame>,
  localTime: number,
  calm: boolean,
): CinematicFace | undefined {
  if (project.visualStyle !== "storybook-cinematic" || calm ||
      !element.characterId || !Number.isFinite(localTime)) return;
  const character = project.characters.find(c => c.id === element.characterId);
  const rig = character?.puppet;
  if (!rig?.face || !rig.parts.some(part => part.role === "head") ||
      rig.parts.some(part => part.role === "eyes" && part.assetId)) return;

  // A performed pickup, point, handoff or put-down temporarily draws the
  // performer's attention to the ACTUAL moving story object, rather than the
  // other actor's body. Look at the prop through the moving handoff frame so
  // pupil direction follows the same deterministic Stage/export positions.
  const action = scene.interactions?.find(item => {
    const isGiver = item.actorId === element.id;
    const isReceiver = item.transfer?.actorId === element.id;
    const from = isReceiver
      ? Math.max(item.attach, item.transfer!.time - 0.55) : item.start;
    const until = isReceiver ? (item.release?.time ?? item.finish)
      : (item.transfer?.time ?? item.release?.time ?? item.finish);
    return (isGiver || isReceiver) && localTime >= from && localTime <= until;
  });
  const active = action && (() => {
    const object = frames.get(action.objectId);
    if (!object || object.opacity < 0.1) return undefined;
    const dx = object.x - frame.x, dy = object.y - frame.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10 || distance > 370) return undefined;
    const from = action.transfer?.actorId === element.id
      ? Math.max(action.attach, action.transfer!.time - 0.55) : action.start;
    const until = action.transfer?.actorId === element.id
      ? (action.release?.time ?? action.finish)
      : (action.transfer?.time ?? action.release?.time ?? action.finish);
    const focus = smooth((localTime - from) / 0.32) *
      (1 - smooth((localTime - (until - 0.3)) / 0.3));
    return { dx, dy, focus };
  })();

  // Outside a performed action, prefer another performer over props. With no
  // companion, allow a nearby workshop object to be the point of attention.
  const available = scene.elements.flatMap(other => {
    if (other.id === element.id || other.backdrop || other.id === "") return [];
    const otherFrame = frames.get(other.id);
    if (!otherFrame || otherFrame.opacity < 0.1) return [];
    const dx = otherFrame.x - frame.x, dy = otherFrame.y - frame.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 10 || distance > 370) return [];
    return [{ other, dx, dy, distance }];
  });
  const friends = available.filter(item => item.other.characterId);
  const target = (friends.length ? friends : available)
    .sort((left, right) => left.distance - right.distance ||
      left.other.id.localeCompare(right.other.id))[0];

  // All timing is based on saved scene time and saved IDs. Seeking to an exact
  // frame (or exporting it twice) yields exactly the same facial performance.
  const seed = [...element.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 37;
  const phase = (Math.max(0, localTime) + seed * 0.041) % 5.4;
  const attention = smooth((phase - 1.7) / 0.4) *
    (1 - smooth((phase - 4.3) / 0.4));
  // A completed safe handoff deserves a tiny moment of mutual attention.
  // Prefer the real collaborator's sampled position, then gently return to
  // ordinary gaze. This does not override the active prop-focused gesture.
  const acknowledgement = handoffAcknowledgementAt(
    project, scene, element, localTime, calm,
  );
  const partnerFrame = acknowledgement && frames.get(acknowledgement.partnerId);
  const shared = acknowledgement && partnerFrame && partnerFrame.opacity >= 0.1
    ? { dx: partnerFrame.x - frame.x, dy: partnerFrame.y - frame.y,
      focus: acknowledgement.attention } : undefined;
  // Real recorded conversations outrank incidental scanning when the
  // listener is free; authored actions and safe handoffs still take priority.
  // Partial synthetic test scenes simply use the previous gaze behavior.
  const conversation = scene.id && scene.duration !== undefined
    ? cinematicConversationListeningAt(
        project, scene as Scene, element, frames, localTime, calm,
      )
    : undefined;
  const speaking = scene.id && scene.duration !== undefined
    ? cinematicSpeakingEyelineAt(
        project, scene as Scene, element, frames, localTime, calm,
      )
    : undefined;
  // During an explicitly authored two-performer camera shot, hold a gentle
  // mutual eyeline between recorded speech and reaction close-ups. Real
  // voice focus, scene actions and handoff acknowledgements still win.
  const pair = scene.id && scene.duration !== undefined
    ? cinematicPairAttentionAt(
        project, scene as Scene, element, frames, localTime, calm,
      )
    : undefined;
  // A gentle audience-facing closing beat is allowed only in an explicit
  // final wide shot, after the authored camera has settled. It never
  // overrides handoffs, real speaker/listener cues or shared-pair looks.
  const finale = scene.id && scene.duration !== undefined
    ? cinematicFinaleAttentionAt(
        project, scene as Scene, element, frames, localTime, calm,
      )
    : undefined;
  const direction = shared ?? active ?? conversation ?? speaking ?? pair ?? finale ?? target;
  const targetX = direction ? clamp(direction.dx / 130, -1, 1) : 0;
  const targetY = direction ? clamp(direction.dy / 150, -1, 1) : 0;
  const focus = shared ? shared.focus : active ? active.focus
    : conversation ? conversation.focus : speaking ? speaking.focus
    : pair ? pair.focus : finale ? finale.focus : target ? attention : 0;

  const x = clamp(2.35 * targetX * focus +
    0.23 * Math.sin(localTime * 1.12 + seed * 0.3) * (1 - focus), -2.6, 2.6);
  const y = clamp(1.35 * targetY * focus +
    0.12 * Math.sin(localTime * 0.86 + seed * 0.4) * (1 - focus), -1.6, 1.6);
  const reaction=cinematicEmotionReactionAt(element,localTime);
  const brow = clamp(
    (frame.emotion === "surprised" ? 1.55 :
      frame.emotion === "worried" ? 0.95 :
      frame.emotion === "excited" ? 0.75 : 0.2) +
      (frame.voiceOpening ?? 0) * 0.32 +
      0.25 * Math.sin(localTime * 1.1 + seed * 0.19) +
      (reaction?.browLift ?? 0) +
      (conversation?.reaction ?? 0) * .24 +
      (finale?.focus ?? 0) * .18,
    0, 2.8,
  );
  // The same original blink cycles now have smooth closing/opening
  // transitions instead of a one-frame pop; no wall-clock animation.
  const eyelidClosure = cinematicEyelidClosureAt(element, localTime);
  const blink = eyelidClosure >= 0.985;
  return { x, y, brow, blink, eyelidClosure,
    browAsymmetry: reaction?.browAsymmetry ?? 0,
    squint: clamp((reaction?.squint ?? 0) +
      (conversation?.reaction ?? 0) * .12, 0, .8),
    cheekLift: (reaction?.cheekLift ?? 0) +
      (conversation?.reaction ?? 0) * .15 +
      (finale?.focus ?? 0) * .16,
    cheekWarmth: reaction?.cheekWarmth ?? 0,
  };
}
