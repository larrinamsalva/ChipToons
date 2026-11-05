import { numberIn, record } from "./art-model";
import type { Emotion } from "./model";
import type { Mouth } from "./animation-model";

export const PART_ROLES = [
  "torso",
  "head",
  "leftArm",
  "rightArm",
  "leftForearm",
  "rightForearm",
  "lowerBody",
  "leftLeg",
  "rightLeg",
  "leftShin",
  "rightShin",
  "leftHand",
  "rightHand",
  "leftFoot",
  "rightFoot",
  "hair",
  "accessory",
  "eyes",
  "mouth",
  "artwork",
] as const;
export type PartRole = (typeof PART_ROLES)[number];
export const EXPRESSIONS = [
  "happy",
  "sad",
  "calm",
  "surprised",
  "worried",
  "excited",
] as const;
export const PUPPET_MOUTHS = [
  "auto",
  "closed",
  "smile",
  "open",
  "talking",
] as const;
export interface Joint {
  x: number;
  y: number;
  angle: number;
}
export type JointSnapshot = Record<string, Joint>;
export interface PuppetPart {
  id: string;
  role: PartRole;
  parentId?: string;
  x: number;
  y: number;
  pivotX: number;
  pivotY: number;
  width: number;
  height: number;
  assetId?: string;
  alternateAssetId?: string;
}
export interface PuppetPose {
  id: string;
  name: string;
  joints: JointSnapshot;
  emotion: Emotion;
  mouth: Mouth;
}
export interface PuppetRig {
  version: 1;
  description: string;
  parts: PuppetPart[];
  poses: PuppetPose[];
  face: boolean;
}
export const MAX_PUPPET_PARTS = 20;
export const MAX_PUPPET_POSES = 24;
export const neutralJoint: Readonly<Joint> = { x: 0, y: 0, angle: 0 };
const idValid = (id: unknown): id is string =>
  typeof id === "string" &&
  /^[A-Za-z0-9_-]{1,80}$/.test(id) &&
  !["__proto__", "constructor", "prototype"].includes(id);

export function validJoints(
  value: unknown,
  parts: ReadonlySet<string>,
): value is JointSnapshot {
  return (
    record(value) &&
    Object.keys(value).length <= MAX_PUPPET_PARTS &&
    Object.entries(value).every(
      ([id, joint]) =>
        parts.has(id) &&
        record(joint) &&
        numberIn(joint.x, -160, 160) &&
        numberIn(joint.y, -160, 160) &&
        numberIn(joint.angle, -180, 180),
    )
  );
}

export function validPuppet(
  value: unknown,
  assets: ReadonlySet<string>,
): value is PuppetRig {
  if (
    !record(value) ||
    value.version !== 1 ||
    typeof value.face !== "boolean" ||
    typeof value.description !== "string" ||
    value.description.length > 500 ||
    !Array.isArray(value.parts) ||
    !value.parts.length ||
    value.parts.length > MAX_PUPPET_PARTS ||
    !Array.isArray(value.poses) ||
    value.poses.length > MAX_PUPPET_POSES
  )
    return false;
  const parts = new Map<string, string | undefined>();
  for (const p of value.parts as unknown[]) {
    if (
      !record(p) ||
      !idValid(p.id) ||
      parts.has(p.id) ||
      !PART_ROLES.includes(p.role as PartRole) ||
      (p.parentId !== undefined && !idValid(p.parentId)) ||
      !numberIn(p.x, -320, 320) ||
      !numberIn(p.y, -320, 320) ||
      !numberIn(p.pivotX, -200, 200) ||
      !numberIn(p.pivotY, -200, 200) ||
      !numberIn(p.width, 8, 320) ||
      !numberIn(p.height, 8, 320) ||
      (p.role === "artwork" && !p.assetId) ||
      (p.alternateAssetId !== undefined && (!["eyes", "mouth"].includes(String(p.role)) || !p.assetId ||
        typeof p.alternateAssetId !== "string" || !assets.has(p.alternateAssetId))) ||
      (p.assetId !== undefined &&
        (typeof p.assetId !== "string" || !assets.has(p.assetId)))
    )
      return false;
    parts.set(p.id, p.parentId);
  }
  for (const id of parts.keys()) {
    const path = new Set<string>();
    let cursor: string | undefined = id;
    while (cursor !== undefined) {
      if (!parts.has(cursor) || path.has(cursor)) return false;
      path.add(cursor);
      cursor = parts.get(cursor);
    }
  }
  const poseIds = new Set<string>();
  const partIds = new Set(parts.keys());
  for (const pose of value.poses as unknown[]) {
    if (
      !record(pose) ||
      !idValid(pose.id) ||
      poseIds.has(pose.id) ||
      typeof pose.name !== "string" ||
      !pose.name.trim() ||
      pose.name.length > 60 ||
      !EXPRESSIONS.includes(pose.emotion as Emotion) ||
      !PUPPET_MOUTHS.includes(pose.mouth as Mouth) ||
      !validJoints(pose.joints, partIds)
    )
      return false;
    poseIds.add(pose.id);
  }
  return true;
}

export function puppetAssetIds(rig: PuppetRig): string[] {
  return [...new Set(rig.parts.flatMap(part => [part.assetId, part.alternateAssetId].filter((id): id is string => !!id)))];
}
export function remapPuppetAssets(
  rig: PuppetRig,
  assets: ReadonlyMap<string, string>,
): PuppetRig {
  return {
    ...rig,
    parts: rig.parts.map((p) =>
      p.assetId ? { ...p, assetId: assets.get(p.assetId),
        alternateAssetId: p.alternateAssetId ? assets.get(p.alternateAssetId) : undefined } : p,
    ),
  };
}

export interface WorldJoint {
  x: number;
  y: number;
  angle: number;
}

// Resolve parents by ID, then return the original paint order.
export function puppetTransforms(
  rig: PuppetRig,
  joints: JointSnapshot = {},
): WorldJoint[] {
  const parts = new Map(rig.parts.map((part) => [part.id, part]));
  const done = new Map<string, WorldJoint>();
  const resolve = (part: PuppetPart): WorldJoint => {
    const cached = done.get(part.id);
    if (cached) return cached;
    const parentPart = part.parentId ? parts.get(part.parentId) : undefined;
    const parent = parentPart ? resolve(parentPart) : neutralJoint;
    const offset = joints[part.id] ?? neutralJoint;
    const radians = (parent.angle * Math.PI) / 180;
    const x = part.x + offset.x,
      y = part.y + offset.y;
    const result = {
      x: parent.x + x * Math.cos(radians) - y * Math.sin(radians),
      y: parent.y + x * Math.sin(radians) + y * Math.cos(radians),
      angle: parent.angle + offset.angle,
    };
    done.set(part.id, result);
    return result;
  };
  return rig.parts.map(resolve);
}

export function interpolateJoints(
  a: JointSnapshot | undefined,
  b: JointSnapshot | undefined,
  progress: number,
): JointSnapshot | undefined {
  if (!a && !b) return undefined;
  return Object.fromEntries(
    [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])].map(
      (id) => {
        const left = a?.[id] ?? neutralJoint,
          right = b?.[id] ?? neutralJoint;
        return [
          id,
          {
            x: left.x + (right.x - left.x) * progress,
            y: left.y + (right.y - left.y) * progress,
            angle: left.angle + (right.angle - left.angle) * progress,
          },
        ];
      },
    ),
  );
}

const dimensions: Record<PartRole, [number, number]> = {
  torso: [78, 78],
  head: [86, 80],
  leftArm: [25, 57],
  rightArm: [25, 57],
  leftForearm: [21, 38],
  rightForearm: [21, 38],
  lowerBody: [62, 66],
  leftLeg: [28, 57],
  rightLeg: [28, 57],
  leftShin: [22, 35],
  rightShin: [22, 35],
  leftHand: [22, 25],
  rightHand: [22, 25],
  leftFoot: [35, 18],
  rightFoot: [35, 18],
  hair: [86, 35],
  accessory: [45, 30],
  eyes: [46, 20],
  mouth: [28, 20],
  artwork: [120, 130],
};

export function defaultPivot(role: PartRole) {
  const [, height] = dimensions[role];
  return {
    pivotX: 0,
    pivotY:
      role === "head" ? height * 0.39 : role === "torso" ? 0 : -height * 0.38,
  };
}

export function newPart(
  role: PartRole,
  id: string,
  parent?: PuppetPart,
): PuppetPart {
  const [width, height] = dimensions[role];
  const side = role.startsWith("left") ? -1 : role.startsWith("right") ? 1 : 0;
  const x = /Arm/.test(role) ? side * 43 : /Leg/.test(role) ? side * 21 : 0;
  const y =
    role === "head"
      ? -37
      : role === "torso"
        ? -88
        : /Leg|lowerBody/.test(role)
          ? 31
          : role === "hair"
            ? -63
            : role === "eyes"
              ? -42
              : role === "mouth"
                ? -22
                : /Forearm|Hand|Shin|Foot/.test(role)
                  ? 35
                  : role === "artwork"
                    ? -125
                    : -20;
  return {
    id,
    role,
    parentId: parent?.id,
    x,
    y,
    width,
    height,
    ...defaultPivot(role),
  };
}

export function sunnyRig(): PuppetRig {
  const torso = newPart("torso", "torso");
  const parts = [
    "leftLeg",
    "rightLeg",
    "leftArm",
    "rightArm",
    "torso",
    "head",
  ].map((role) =>
    role === "torso" ? torso : newPart(role as PartRole, role, torso),
  );
  return {
    version: 1,
    description: "Sunny welcomes new friends and shares a little kindness.",
    parts,
    face: true,
    poses: [
      {
        id: "standing",
        name: "Standing",
        joints: {},
        emotion: "calm",
        mouth: "smile",
      },
      {
        id: "waving",
        name: "Waving",
        joints: {
          rightArm: { ...neutralJoint, angle: -125 },
          head: { ...neutralJoint, angle: -7 },
        },
        emotion: "happy",
        mouth: "smile",
      },
      {
        id: "thinking",
        name: "Thinking",
        joints: {
          head: { ...neutralJoint, angle: 12 },
          leftArm: { ...neutralJoint, angle: 38 },
        },
        emotion: "worried",
        mouth: "closed",
      },
    ],
  };
}
