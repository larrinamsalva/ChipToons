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
}: {
  emotion: Emotion;
  mouth: Mouth;
  voiceOpening?: number;
  blink: boolean;
  eyes?: boolean;
  lips?: boolean;
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
                rx={emotion === "surprised" ? 4.8 : 3.5}
                ry={5}
                fill="#382c34"
              />
            ),
          )}
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
}: {
  part: PuppetPart;
  character: Character;
}) {
  const { role, width: w, height: h } = part;
  if (role === "head")
    return <ellipse rx={w / 2} ry={h / 2} fill={character.skin} />;
  if (role === "hair")
    return (
      <path
        d={`M${-w / 2} 6Q${-w / 2} ${-h} 0 ${-h / 2}Q${w / 2} ${-h} ${w / 2} 6Q0 -11 ${-w / 2} 6`}
        fill={character.hair}
      />
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
    <rect
      x={-w / 2}
      y={-h / 2}
      width={w}
      height={h}
      rx={Math.min(w, h) * 0.35}
      fill={fill}
    />
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
}) {
  const rig = character.puppet;
  if (!rig) return null;
  const transforms = puppetTransforms(rig, joints);
  const separateEyes = rig.parts.some((p) => p.role === "eyes");
  const separateMouth = rig.parts.some((p) => p.role === "mouth");
  return (
    <g data-puppet={character.id}>
      {rig.parts.map((part, i) => {
        const joint = transforms[i];
        const asset = assets.find((a) => a.id === part.assetId);
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
                  lips={false}
                />
              ) : part.role === "mouth" ? (
                <Face
                  emotion={emotion}
                  mouth={mouth}
                  voiceOpening={voiceOpening}
                  blink={blink}
                  eyes={false}
                />
              ) : (
                <Shape part={part} character={character} />
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
