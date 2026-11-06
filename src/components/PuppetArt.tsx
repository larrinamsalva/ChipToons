import { useId } from "react";
import type { Asset, Character, Emotion } from "../model";
import { puppetTransforms } from "../puppet-model";
import type { JointSnapshot, PuppetPart } from "../puppet-model";
import type { Mouth } from "../animation-model";

function Face({
  emotion,
  mouth,
  voiceOpening,
  blink,
  eyes = true,
  lips = true,
  premium = false,
}: {
  emotion: Emotion;
  mouth: Mouth;
  voiceOpening?: number;
  blink: boolean;
  eyes?: boolean;
  lips?: boolean;
  premium?: boolean;
}) {
  const smile =
    mouth === "smile" ||
    (mouth === "auto" && (emotion === "happy" || emotion === "excited"));
  const open =
    mouth === "open" ||
    mouth === "talking" ||
    (mouth === "auto" && emotion === "surprised");
  const sad = emotion === "sad" || emotion === "worried";
  const excited = emotion === "excited";
  const worried = emotion === "worried";
  return (
    <g stroke="#382c34" strokeWidth="2.8" strokeLinecap="round" fill="none">
      {eyes && (
        <>
          {premium && !blink && ([-15, 15].map(x => (
            <ellipse key={`eye-white-${x}`} cx={x} cy="-2" rx="8" ry="10"
              fill="#fffdf8" stroke="#8e5f56" strokeWidth="1.4" />
          )))}
          <path
            d={
              worried
                ? "M-23 -9l12 -7M11 -11q6 -5 12 -1"
                : sad
                  ? "M-23 -9l12 -5M11 -14l12 5"
                  : excited
                    ? "M-24 -16q7 -7 14 -1M10 -17q7 -6 14 1"
                    : "M-23 -13q6 -4 12 0M11 -13q6 -4 12 0"
            }
          />
          {[-15, 15].map((x) =>
            blink ? (
              <path key={x} d={`M${x - 4} -2h8`} />
            ) : (
              <ellipse
                key={x}
                cx={x}
                cy="-2"
                rx={emotion === "surprised" ? 5.5 : premium ? 4.6 : 3.5}
                ry={premium ? 6.7 : 5}
                fill="#382c34"
              />
            ),
          )}
          {premium && !blink && [-15, 15].map(x => (
            <circle key={`catchlight-${x}`} data-eye-highlight="premium" cx={x + 1.8} cy="-4.6" r="1.7"
              fill="#ffffff" stroke="none" />
          ))}
          {premium && <>
            <path data-facial-detail="nose" d="M-1 1q-2 4 2 6q2 1 4-1"
              stroke="#8d625f" strokeWidth="1.4" strokeLinecap="round" opacity=".52" />
            <ellipse cx="-30" cy="13" rx="8" ry="4.2" fill="#f6a0a0" opacity=".34" stroke="none" />
            <ellipse cx="30" cy="13" rx="8" ry="4.2" fill="#f6a0a0" opacity=".34" stroke="none" />
          </>}
        </>
      )}
      {lips &&
        (open ? (
          <ellipse cy="15" rx={voiceOpening === undefined ? 8 : 6 + 5 * voiceOpening}
            ry={voiceOpening === undefined ? 6 : 1 + 9 * voiceOpening} fill="#382c34" />
        ) : (
          <path
            d={
              smile
                ? excited
                  ? "M-13 11q13 18 26 0"
                  : "M-9 12q9 13 18 0"
                : sad
                  ? "M-8 18q8 -9 16 0"
                  : "M-7 14h14"
            }
          />
        ))}
    </g>
  );
}
function Shape({
  part,
  character,
  premium = false,
  gradientPrefix,
}: {
  part: PuppetPart;
  character: Character;
  premium?: boolean;
  gradientPrefix: string;
}) {
  const { role, width: w, height: h } = part;
  // Opt-in, scalable vector workwear for a full-body cartoon performer.
  // The ordinary and photo-cutout puppet looks are unaffected.
  if (character.puppet?.costume === "workshop") {
    if (role === "torso") return (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="15"
          fill={premium ? `url(#${gradientPrefix}-shirt)` : "#277b8b"} />
        {premium && <rect data-material-depth="workshop-shirt" x={-w / 2} y={-h / 2}
          width={w} height={h} rx="15" fill={`url(#${gradientPrefix}-material)`}
          pointerEvents="none" />}
        <rect x={-w / 2 + 7} y={-h / 2 + 5} width={w - 14} height={h - 11}
          rx="10" fill="#3298a2" opacity=".42" />
        <path d={`M0 ${-h / 2 + 8}V${h / 2 - 6}`} stroke="#154c64" strokeWidth="3" />
        <path d={`M${-w / 2 + 8} 0h14m${w - 44} 0h14`}
          stroke="#def3e0" strokeWidth="2.5" strokeLinecap="round" opacity=".8" />
      </g>
    );
    if (role === "leftLeg" || role === "rightLeg" || role === "leftShin" || role === "rightShin" || role === "lowerBody") return (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx="9" fill="#64764d" />
        {premium && <rect data-material-depth="cargo-fabric" x={-w / 2} y={-h / 2}
          width={w} height={h} rx="9" fill={`url(#${gradientPrefix}-material)`}
          pointerEvents="none" />}
        <rect x={-w / 2 + 3} y={-h / 2 + 4} width="7" height={h - 8} rx="3" fill="#91a36d" opacity=".45" />
        <rect x={-w / 2 + 2} y={-h * 0.12} width={Math.max(10, w - 4)}
          height={Math.min(18, h * 0.35)} rx="4" fill="#546442" stroke="#354631" strokeWidth="1" />
        <path d={`M${-w / 2 + 4} ${h * 0.18}h${w - 8}`} stroke="#9daa82" strokeWidth="1.5" />
      </g>
    );
    if (role === "leftFoot" || role === "rightFoot") return (
      <g>
        <rect x={-w / 2} y={-h / 2 - 4} width={w} height={h + 4} rx="7" fill="#25313c" />
        {premium && <rect data-material-depth="work-boot" x={-w / 2} y={-h / 2 - 4}
          width={w} height={h + 4} rx="7" fill={`url(#${gradientPrefix}-material)`}
          pointerEvents="none" />}
        <rect x={-w / 2 - 2} y={h / 2 - 6} width={w + 5} height="8" rx="3" fill="#151c23" />
        <path d={`M${-w / 2 + 5} ${-h / 2 + 3}h${w - 13}`} stroke="#667784" strokeWidth="2" opacity=".75" />
      </g>
    );
    if (role === "accessory") return (
      <g>
        <rect x={-w / 2} y={-h / 2} width={w} height={h * 0.55} rx="5" fill="#5a3829" />
        {premium && <rect data-material-depth="tool-belt" x={-w / 2} y={-h / 2}
          width={w} height={h * 0.55} rx="5"
          fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />}
        <rect x="-10" y={-h / 2 - 2} width="20" height={h * 0.52} rx="3"
          fill="#d4bd86" stroke="#553b2b" strokeWidth="2" />
        <rect x={-w / 2 + 4} y={-h / 2 + 3} width="13" height={h - 2}
          rx="3" fill="#9b663f" stroke="#503324" strokeWidth="1.5" />
        <rect x={w / 2 - 17} y={-h / 2 + 3} width="13" height={h - 2}
          rx="3" fill="#9b663f" stroke="#503324" strokeWidth="1.5" />
      </g>
    );
  }
  if (role === "head")
    return <g>
      <ellipse rx={w / 2} ry={h / 2}
        fill={premium ? `url(#${gradientPrefix}-skin)` : character.skin} />
      {premium && <ellipse cx={-w * 0.16} cy={-h * 0.23} rx={w * 0.18} ry={h * 0.21}
        fill="#ffffff" opacity=".12" />}
    </g>;
  if (role === "hair")
    return (
      <g>
        <path
          d={`M${-w / 2} 6Q${-w / 2} ${-h} 0 ${-h / 2}Q${w / 2} ${-h} ${w / 2} 6Q0 -11 ${-w / 2} 6`}
          fill={character.hair}
        />
        {premium && <path data-material-depth="hair-sheen"
          d={`M${-w * 0.31} ${-h * 0.13}Q${-w * 0.13} ${-h * 0.70} ${w * 0.22} ${-h * 0.45}`}
          stroke="#fff9eb" strokeWidth="5" strokeLinecap="round"
          opacity=".22" fill="none" pointerEvents="none" />}
      </g>
    );
  if (role === "accessory")
    return (
      <path
        d={`M${-w / 2} ${-h / 2}L0 0L${w / 2} ${-h / 2}V${h / 2}L0 0L${-w / 2} ${h / 2}Z`}
        fill="#e56e7a"
      />
    );
  const fill = /Leg|Shin|lowerBody/.test(role)
    ? "#535a86"
    : /Hand|Forearm/.test(role)
      ? character.skin
      : /Foot/.test(role)
        ? "#fff4da"
        : character.shirt;
  return (
    <g>
      <rect
        x={-w / 2} y={-h / 2}
        width={w} height={h}
        rx={Math.min(w, h) * 0.35} fill={fill}
      />
      {premium && <rect data-material-depth={role}
        x={-w / 2} y={-h / 2} width={w} height={h}
        rx={Math.min(w, h) * 0.35}
        fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />}
    </g>
  );
}

export function PuppetArt({
  character,
  assets,
  joints,
  emotion,
  mouth = "auto",
  voiceOpening,
  blink = false,
  heartOpacity = 0,
  heartScale = 1,
  premium = false,
}: {
  character: Character;
  assets: Asset[];
  joints?: JointSnapshot;
  emotion: Emotion;
  mouth?: Mouth;
  voiceOpening?: number;
  blink?: boolean;
  heartOpacity?: number;
  heartScale?: number;
  premium?: boolean;
}) {
  const gradientPrefix = useId();
  const rig = character.puppet;
  if (!rig) return null;
  const transforms = puppetTransforms(rig, joints);
  const separateEyes = rig.parts.some((p) => p.role === "eyes");
  const separateMouth = rig.parts.some((p) => p.role === "mouth");
  return (
    <g data-puppet={character.id} data-puppet-finish={premium ? "cinematic" : "classic"}>
      {premium && <defs>
        <linearGradient id={`${gradientPrefix}-shirt`} x1="0%" y1="0%" x2="100%" y2="90%">
          <stop offset="0%" stopColor="#eafcff" />
          <stop offset="23%" stopColor={character.shirt} />
          <stop offset="100%" stopColor="#27394c" />
        </linearGradient>
        <radialGradient id={`${gradientPrefix}-skin`} cx="32%" cy="23%" r="82%">
          <stop offset="0%" stopColor="#fff7eb" />
          <stop offset="33%" stopColor={character.skin} />
          <stop offset="100%" stopColor={character.skin} stopOpacity=".84" />
        </radialGradient>
        <linearGradient id={`${gradientPrefix}-material`} x1="0%" y1="20%" x2="100%" y2="45%">
          <stop offset="0%" stopColor="#fffdf7" stopOpacity=".37" />
          <stop offset="23%" stopColor="#fff9ed" stopOpacity=".13" />
          <stop offset="52%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#17243b" stopOpacity=".31" />
        </linearGradient>
      </defs>}
      {rig.parts.map((part, i) => {
        const joint = transforms[i];
        const useAlternate = part.role === "eyes" ? blink : part.role === "mouth" &&
          (mouth === "open" || mouth === "talking" || (mouth === "auto" && emotion === "surprised"));
        const assetId = useAlternate && part.alternateAssetId ? part.alternateAssetId : part.assetId;
        const asset = assets.find(a => a.id === assetId);
        return (
          <g
            key={part.id}
            data-puppet-part={part.id}
            transform={`translate(${joint.x} ${joint.y}) rotate(${joint.angle})`}
          >
            <g transform={`translate(${-part.pivotX} ${-part.pivotY})`}>
              {asset ? (
                <image
                  href={asset.dataUrl}
                  x={-part.width / 2}
                  y={-part.height / 2}
                  width={part.width}
                  height={part.height}
                />
              ) : part.role === "eyes" ? (
                <Face
                  emotion={emotion}
                  mouth={mouth}
                  voiceOpening={voiceOpening}
                  blink={blink}
                  premium={premium}
                  lips={false}
                />
              ) : part.role === "mouth" ? (
                <Face
                  emotion={emotion}
                  mouth={mouth}
                  voiceOpening={voiceOpening}
                  blink={blink}
                  premium={premium}
                  eyes={false}
                />
              ) : (
                <Shape part={part} character={character} premium={premium}
                  gradientPrefix={gradientPrefix} />
              )}
              {part.role === "head" && rig.face && (
                <>
                  {!asset && !rig.parts.some((p) => p.role === "hair") && (
                    <path
                      d="M-38 -18Q-43 -47 0 -40Q36 -44 42 -15Q20 -20 14 -28Q-10 -10 -38 -18"
                      fill={character.hair}
                    />
                  )}
                  <Face
                    emotion={emotion}
                    mouth={mouth}
                  voiceOpening={voiceOpening}
                    blink={blink}
                    premium={premium}
                    eyes={!separateEyes}
                    lips={!separateMouth}
                  />
                </>
              )}
              {part.role === "torso" && heartOpacity > 0 && (
                <g transform={`scale(${heartScale})`} opacity={heartOpacity}>
                  <circle r="26" fill="#fff5ac" opacity=".7" />
                  <path
                    d="M0 14C-36 -6 -10 -23 0 -9C10 -23 36 -6 0 14"
                    fill="#fff7d9"
                    stroke="#f39c51"
                    strokeWidth="2"
                  />
                </g>
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
