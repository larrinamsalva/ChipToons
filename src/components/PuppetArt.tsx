import { useId } from "react";
import type { Asset, Character, Emotion } from "../model";
import { puppetTransforms } from "../puppet-model";
import type { JointSnapshot, PuppetPart } from "../puppet-model";
import type { Mouth } from "../animation-model";
import type { CinematicFace } from "../cinematic-face";

function Face({
  emotion,
  mouth,
  voiceOpening,
  blink,
  eyes = true,
  lips = true,
  premium = false,
  gaze,
}: {
  emotion: Emotion;
  mouth: Mouth;
  voiceOpening?: number;
  blink: boolean;
  eyes?: boolean;
  lips?: boolean;
  premium?: boolean;
  gaze?: CinematicFace;
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
  const brows = worried
    ? ["M-23 -9l12 -7","M11 -11q6 -5 12 -1"]
    : sad
      ? ["M-23 -9l12 -5","M11 -14l12 5"]
      : excited
        ? ["M-24 -16q7 -7 14 -1","M10 -17q7 -6 14 1"]
        : ["M-23 -13q6 -4 12 0","M11 -13q6 -4 12 0"];
  const squint = premium ? Math.max(0,Math.min(1,gaze?.squint??0)) : 0;
  // Classic/artist-authored blink keeps its original exact closed-eye art.
  const eyelidClosure = premium && gaze
    ? Math.max(0,Math.min(1,gaze.eyelidClosure??0)) : 0;
  const cheekLift = premium ? Math.max(-0.8,Math.min(1.8,gaze?.cheekLift??0)) : 0;
  const cheekWarmth = premium ? Math.max(-0.12,Math.min(0.28,gaze?.cheekWarmth??0)) : 0;
  return (
    <g stroke="#382c34" strokeWidth="2.8" strokeLinecap="round" fill="none">
      {eyes && (
        <>
          {premium && !blink && ([-15, 15].map(x => (
            <ellipse key={`eye-white-${x}`} cx={x} cy="-2" rx="8"
              fill="#fffdf8" stroke="#8e5f56" strokeWidth="1.4"
              ry={10 * (1 - .87 * eyelidClosure)} />
          )))}
          {brows.map((d,i)=><path key={i}
            data-cinematic-reaction-brow={premium && gaze && Math.abs(gaze.browAsymmetry??0)>0.01
              ? "true" : undefined}
            transform={premium && gaze
              ? `translate(0 ${-gaze.brow + (i===0?-1:1)*(gaze.browAsymmetry??0)})`
              : undefined}
            d={d}
          />)}
          {[-15, 15].map((x) =>
            blink ? (
              <path key={x} d={`M${x - 4} -2h8`} />
            ) : (
              <ellipse
                key={x}
                data-cinematic-pupil={premium && gaze ? "true" : undefined}
                cx={x + (premium ? gaze?.x ?? 0 : 0)}
                cy={-2 + (premium ? gaze?.y ?? 0 : 0)}
                rx={emotion === "surprised" ? 5.5 : premium ? 4.6 : 3.5}
                ry={premium ? 6.7*(1-0.22*squint)*(1-.91*eyelidClosure) : 5}
                fill="#382c34"
              />
            ),
          )}
          {premium && !blink && eyelidClosure>.025 && [-15,15].map(x=>(
            <path key={`natural-blink-${x}`}
              data-cinematic-blink-transition="true"
              d={`M${x-8} ${-12+10*eyelidClosure}q8 ${-3+3*eyelidClosure} 16 0`}
              stroke="#8e5f56" strokeWidth="1.7"
              fill="none" pointerEvents="none"/>
          ))}
          {premium && !blink && squint>0.02 && [-15,15].map(x=>(
            <path key={`reaction-lid-${x}`} data-cinematic-reaction-lid="true"
              d={`M${x-7} ${-10+4*squint}q7 ${-2+3*squint} 14 0`}
              stroke="#7e5856" strokeWidth="1.7" fill="none"
              pointerEvents="none"/>
          ))}
          {premium && !blink && [-15, 15].map(x => (
            <circle key={`catchlight-${x}`} data-eye-highlight="premium" cx={x + 1.8 + (gaze?.x ?? 0)} cy={-4.6 + (gaze?.y ?? 0)} r="1.7"
              fill="#ffffff" stroke="none" opacity={1-eyelidClosure} />
          ))}
          {premium && <>
            <path data-facial-detail="nose" d="M-1 1q-2 4 2 6q2 1 4-1"
              stroke="#8d625f" strokeWidth="1.4" strokeLinecap="round" opacity=".52" />
            {[-30, 30].map(x => (
              <ellipse key={x}
                data-cinematic-cheek={Math.abs(cheekLift) > .06 ? "animated" : undefined}
                cx={x} cy={13 - cheekLift}
                rx={8 + Math.max(0,cheekLift) * .35}
                ry={4.2 + Math.max(0,cheekLift) * .2}
                fill="#f6a0a0" opacity={.34 + cheekWarmth} stroke="none" />
            ))}
            {lips && !open && cheekLift > .35 &&
              (emotion === "happy" || emotion === "excited") && (
                <path data-cinematic-smile-crease="true"
                  d="M-38 10q-3 2-1 5M38 10q3 2 1 5"
                  stroke="#8d625f" strokeWidth="1.2"
                  strokeLinecap="round" opacity={Math.min(.45,cheekLift*.2)}
                  fill="none" pointerEvents="none"/>
              )}
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
  gripCurl,
}: {
  part: PuppetPart;
  character: Character;
  premium?: boolean;
  gradientPrefix: string;
  gripCurl?: number;
}) {
  const { role, width: w, height: h } = part;
  // Opt-in, scalable vector workwear for a full-body cartoon performer.
  // The ordinary and photo-cutout puppet looks are unaffected.
  if (character.puppet?.costume === "workshop") {
    // The shoulder and elbow are real puppet joints. Draw the short
    // workshop sleeves *inside* each existing upper-arm shape so their
    // seam and rolled cuff travel with authored IK and gestures.
    if (premium && (role === "leftArm" || role === "rightArm")) return (
      <g data-workshop-shirt-sleeve="cinematic">
        <rect x={-w / 2} y={-h / 2} width={w} height={h}
          rx={Math.min(9, w * .36)} fill={character.shirt}
          stroke="#294758" strokeWidth="1" />
        <path d={`M${-w / 2 + 2} ${-h * .28}
          Q${-w / 2 + 2} ${-h * .53} 0 ${-h / 2 + 2}
          Q${w / 2 - 1} ${-h / 2 + 1} ${w / 2 - 2} ${-h * .24}`}
          stroke="#d3edf0" strokeWidth="1.5" fill="none" opacity=".75" />
        <rect data-material-depth="workshop-sleeve" x={-w / 2}
          y={-h / 2} width={w} height={h}
          rx={Math.min(9, w * .36)}
          fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />
        <path data-workshop-arm-fold="true"
          d={`M${-w * .34} ${-h * .03}Q0 ${h * .08} ${w * .35} ${-h * .01}
             M${-w * .25} ${h * .21}Q0 ${h * .12} ${w * .31} ${h * .18}`}
          stroke="#26526a" strokeWidth="1.3" strokeLinecap="round"
          opacity=".65" fill="none" />
        <rect data-workshop-sleeve-cuff="true" x={-w / 2 + .5}
          y={h / 2 - 11} width={w - 1} height="9" rx="3"
          fill="#286f83" stroke="#194f60" strokeWidth="1" />
        <path d={`M${-w / 2 + 3} ${h / 2 - 8}H${w / 2 - 3}`}
          stroke="#9ad5dd" strokeWidth="1.3" opacity=".85" />
      </g>
    );
    // Distinguish the forearm beneath its real elbow joint from the
    // shirt sleeve above. The wrist/hand children keep their own pivots.
    if (premium && (role === "leftForearm" || role === "rightForearm")) return (
      <g data-workshop-forearm="cinematic">
        <path
          d={`M${-w * .42} ${-h / 2 + 2}
              Q${-w * .58} ${-h * .16} ${-w * .38} ${h / 2 - 3}
              Q0 ${h / 2 + 2} ${w * .37} ${h / 2 - 3}
              Q${w * .53} ${-h * .17} ${w * .42} ${-h / 2 + 2}
              Q0 ${-h / 2 - 4} ${-w * .42} ${-h / 2 + 2}Z`}
          fill={character.skin} stroke="#986e60" strokeWidth=".85" />
        <path data-workshop-elbow-crease="true"
          d={`M${-w * .30} ${-h * .35}Q0 ${-h * .25} ${w * .28} ${-h * .34}`}
          fill="none" stroke="#986e60" strokeWidth="1.1" opacity=".7" />
        <path
          d={`M${-w * .23} ${-h * .13}Q${-w * .31} ${h * .12} ${-w * .16} ${h * .37}`}
          fill="none" stroke="#fff1d8" strokeWidth="2.4"
          strokeLinecap="round" opacity=".26" />
        <path d={`M${-w * .28} ${h / 2 - 4}Q0 ${h / 2 - 1} ${w * .28} ${h / 2 - 4}`}
          fill="none" stroke="#9b6c5e" strokeWidth="1" opacity=".6" />
      </g>
    );
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
    // Real shin parts on newly articulated workshop characters deserve
    // separate pant folds and a shaped knee, not a duplicate thigh pocket.
    // These forms travel with the EXISTING knee joint transform: no CSS
    // motion, new bones, altered poses or foot-contact geometry.
    if (premium && (role === "leftShin" || role === "rightShin")) return (
      <g data-workshop-knee-sleeve="cinematic">
        <rect x={-w / 2} y={-h / 2} width={w} height={h}
          rx={Math.min(8, w * .35)} fill="#63764f"
          stroke="#42513b" strokeWidth="1" />
        <path d={`M${-w / 2 + 2} ${-h / 2 + 7}Q${-w / 2 + 1} 0 ${-w / 2 + 4} ${h / 2 - 4}L${-w / 2 + w * .39} ${h / 2 - 4}Q${-w / 2 + w * .28} 0 ${-w / 2 + w * .39} ${-h / 2 + 7}Z`}
          fill="#94a872" opacity=".46" />
        <rect data-material-depth="knee-fabric" x={-w / 2} y={-h / 2}
          width={w} height={h} rx={Math.min(8, w * .35)}
          fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />
        <ellipse data-workshop-knee-panel="true" cx="0" cy={-h / 2 + 8}
          rx={w * .39} ry={Math.min(6.5, h * .20)}
          fill="#78895e" stroke="#41533d" strokeWidth="1.2" />
        <path d={`M${-w * .28} ${-h / 2 + 8}Q0 ${-h / 2 + 3} ${w * .28} ${-h / 2 + 8}`}
          stroke="#d3dfae" strokeWidth="1.2" opacity=".75" fill="none" />
        <path data-workshop-knee-folds="true"
          d={`M${-w * .34} ${-h * .03}Q0 ${h * .07} ${w * .3} ${-h * .07}
             M${-w * .28} ${h * .17}Q0 ${h * .22} ${w * .36} ${h * .12}`}
          fill="none" stroke="#3e5137" strokeWidth="1.2"
          strokeLinecap="round" opacity=".7" />
        <rect data-workshop-boot-cuff="true" x={-w / 2 + 1}
          y={h / 2 - 8} width={w - 2} height="7" rx="2.5"
          fill="#506348" stroke="#374936" strokeWidth=".8" />
        <path d={`M${-w / 2 + 4} ${h / 2 - 5}H${w / 2 - 4}`}
          stroke="#b4c49a" strokeWidth="1" opacity=".65" />
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
    // Shaped boot upper, separate toe cap, laces and outsole. Keep the
    // exact original sole bottom (h/2 + 2), so existing floor grounding
    // and authored foot placement do not change when premium art is on.
    if (premium && (role === "leftFoot" || role === "rightFoot")) {
      const outline = `M${-w / 2 + 2} ${h / 2 - 6}
        L${-w / 2 + 2} ${-h / 2 + 1}
        Q${-w / 2 + 2} ${-h / 2 - 4} ${-w / 2 + 9} ${-h / 2 - 4}
        L${w / 2 - 12} ${-h / 2 - 4}
        Q${w / 2 - 7} ${-h / 2 - 3} ${w / 2 - 7} ${-h / 2 + 2}
        Q${w / 2 + 4} ${-h / 2 + 4} ${w / 2 + 2} ${h / 2 - 6}Z`;
      return (
        <g data-workshop-boot-profile="cinematic">
          <path d={outline} fill="#2b3945" stroke="#172631"
            strokeWidth="1.1" strokeLinejoin="round" />
          <path d={outline} data-material-depth="work-boot"
            fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />
          <path data-workshop-boot-toe="true"
            d={`M${w * .11} ${-h * .15}Q${w * .43} ${-h * .11} ${w / 2} ${h / 2 - 6}
              L${w * .12} ${h / 2 - 6}Z`}
            fill="#40505f" stroke="#182630" strokeWidth=".85" />
          <path d={`M${-w / 2 + 6} ${-h / 2 + 3}V${h / 2 - 8}`}
            stroke="#7b8d9c" strokeWidth="1.5" opacity=".65" />
          {[0, 1, 2].map(i => (
            <path key={i} data-workshop-boot-lace="true"
              d={`M${-w * .29} ${-h / 2 + 4 + i * 4}
                L${-w * .02} ${-h / 2 + 6 + i * 4}
                M${-w * .03} ${-h / 2 + 4 + i * 4}
                L${-w * .28} ${-h / 2 + 6 + i * 4}`}
              fill="none" stroke="#c2b8a1" strokeWidth="1.1"
              strokeLinecap="round" />
          ))}
          <rect data-workshop-boot-sole="true" x={-w / 2 - 2}
            y={h / 2 - 6} width={w + 5} height="8" rx="3"
            fill="#151c23" stroke="#070e14" strokeWidth=".65" />
          <path d={`M${-w / 2 + 1} ${h / 2 - 3}H${w / 2 + 1}`}
            stroke="#71808b" strokeWidth="1" opacity=".7" />
        </g>
      );
    }
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
  if (premium && (role === "leftHand" || role === "rightHand") &&
      typeof gripCurl === "number") {
    const curl = Math.max(0, Math.min(1, gripCurl));
    return <g data-cinematic-hand-grip="true" data-hand-curl={curl.toFixed(2)}>
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.35}
        fill={character.skin} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.35}
        fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />
      {[-0.26, 0, 0.26].map((x, i) =>
        <path key={i} d={`M${w * x} ${h * 0.02}q${w * 0.03} ${h * (0.22 - 0.13 * curl)} 0 ${h * (0.31 - 0.13 * curl)}`}
          fill="none" stroke="#925e50" strokeWidth="1.55" strokeLinecap="round" opacity=".72" />)}
      <path d={`M${-w * 0.32} ${-h * 0.11}q${w * (0.07 + 0.09 * curl)} ${h * 0.09} ${w * (0.20 + 0.1 * curl)} ${h * 0.23}`}
        stroke="#925e50" strokeWidth="1.9" strokeLinecap="round" fill="none" />
    </g>;
  }
  // Relaxed hands get a palm/thumb silhouette with finger creases,
  // while the existing GRIPPING hand renderer above remains the only
  // owner of an animated prop grip and authored wrist motion.
  if (premium && character.puppet?.costume === "workshop" &&
      (role === "leftHand" || role === "rightHand")) return (
    <g data-workshop-open-hand="cinematic">
      <rect x={-w / 2 + 1} y={-h / 2} width={w - 2} height={h - 1}
        rx={Math.min(w * .38, h * .36)}
        fill={character.skin} stroke="#936a5e" strokeWidth=".85" />
      <rect x={-w / 2 + 1} y={-h / 2} width={w - 2} height={h - 1}
        rx={Math.min(w * .38, h * .36)}
        fill={`url(#${gradientPrefix}-material)`} pointerEvents="none" />
      <path data-workshop-palm-thumb="true"
        d={`M${-w * .31} ${-h * .15}
             Q${-w * .62} ${-h * .04} ${-w * .43} ${h * .20}
             Q${-w * .17} ${h * .12} ${-w * .09} ${-h * .04}`}
        fill="none" stroke="#94685d" strokeWidth="1.3"
        strokeLinecap="round" />
      {[-.23, 0, .23].map((x, i) => (
        <path key={i} data-workshop-finger-line="true"
          d={`M${w * x} ${h * .11}Q${w * (x + .04)} ${h * .24} ${w * x} ${h * .36}`}
          fill="none" stroke="#9e7667" strokeWidth="1"
          strokeLinecap="round" opacity=".8" />
      ))}
    </g>
  );
  // New, explicitly styled workshop heads keep the same original
  // 86×80 head and unaltered face/eye/mouth anchor coordinates. Their
  // ears and shaded jaw travel WITH the existing real head joint.
  if (premium && character.puppet?.costume === "workshop" &&
      character.puppet.headStyle && role === "head") return (
    <g data-workshop-head-contour="cinematic">
      <ellipse cx={-w / 2 - 1} cy="2" rx="6" ry="10"
        fill={character.skin} stroke="#956963" strokeWidth="1" />
      <ellipse cx={w / 2 + 1} cy="2" rx="6" ry="10"
        fill={character.skin} stroke="#956963" strokeWidth="1" />
      <ellipse rx={w / 2} ry={h / 2}
        fill={`url(#${gradientPrefix}-skin)`}
        stroke="#9b7771" strokeWidth="1.2" />
      <path data-workshop-jaw-highlight="true"
        d={`M${-w * .31} ${h * .25}
             Q0 ${h * .53} ${w * .31} ${h * .25}`}
        fill="none" stroke="#fff5df" strokeWidth="2"
        opacity=".32" strokeLinecap="round" />
      <path d={`M${-w * .38} ${-h * .03}Q${-w * .34} ${h * .29} ${-w * .17} ${h * .42}`}
        fill="none" stroke="#fff5df" strokeWidth="2.5" opacity=".25" />
    </g>
  );
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
  gaze,
  gripCurl,
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
  gaze?: CinematicFace;
  gripCurl?: { left?: number; right?: number };
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
                  gaze={premium ? gaze : undefined}
                  lips={false}
                />
              ) : part.role === "mouth" ? (
                <Face
                  emotion={emotion}
                  mouth={mouth}
                  voiceOpening={voiceOpening}
                  blink={blink}
                  premium={premium}
                  gaze={premium ? gaze : undefined}
                  eyes={false}
                />
              ) : (
                <Shape part={part} character={character} premium={premium}
                  gripCurl={part.role === "leftHand" ? gripCurl?.left :
                    part.role === "rightHand" ? gripCurl?.right : undefined}
                  gradientPrefix={gradientPrefix} />
              )}
              {part.role === "head" && rig.face && (
                <>
                  {!asset && !rig.parts.some((p) => p.role === "hair") && (
                    premium && rig.costume === "workshop" && rig.headStyle ? (
                      rig.headStyle === "soft-waves" ? (
                        <g data-workshop-hairstyle="soft-waves">
                          <path data-workshop-hair-silhouette="true"
                            d="M-43 -22Q-45 -54 -10 -49Q11 -57 32 -39Q47 -38 46 -14
                               Q53 2 45 21Q43 28 34 27Q40 14 36 -4
                               Q31 -22 20 -27Q3 -18 -12 -28
                               Q-34 -17 -36 -3Q-35 14 -33 25Q-46 23 -46 9
                               Q-52 -3 -43 -22Z"
                            fill={character.hair} stroke="#261c2f" strokeWidth="1.15" />
                          <path data-workshop-hair-lock="true"
                            d="M-29 -32Q-10 -52 7 -36Q19 -45 34 -28
                               M-40 -14Q-45 -2 -41 13M39 -14Q45 1 39 16"
                            stroke="#977eaa" strokeWidth="2.4" opacity=".48"
                            fill="none" strokeLinecap="round" />
                          <path data-material-depth="hair-sheen"
                            d="M-27 -36Q-8 -47 4 -36"
                            stroke="#fff6ed" strokeWidth="2.4" opacity=".23"
                            fill="none" strokeLinecap="round" pointerEvents="none" />
                        </g>
                      ) : (
                        <g data-workshop-hairstyle="short-side-part">
                          <path data-workshop-hair-silhouette="true"
                            d="M-42 -18Q-49 -38 -33 -44Q-19 -54 -1 -48
                               Q22 -53 38 -36Q45 -26 41 -15
                               Q33 -19 29 -30Q12 -23 5 -21
                               Q-10 -17 -25 -24Q-32 -17 -42 -18Z"
                            fill={character.hair} stroke="#261e1d" strokeWidth="1.1" />
                          <path data-workshop-hair-part="true"
                            d="M9 -45Q9 -34 5 -21M-36 -23Q-18 -37 4 -31"
                            stroke="#a78b76" strokeWidth="2"
                            opacity=".62" fill="none" strokeLinecap="round" />
                          <path data-material-depth="hair-sheen"
                            d="M-30 -39Q-16 -47 -1 -41"
                            stroke="#fff4e8" strokeWidth="2.5"
                            opacity=".22" fill="none" strokeLinecap="round"
                            pointerEvents="none" />
                        </g>
                      )
                    ) : (
                      <g>
                        <path
                          d="M-38 -18Q-43 -47 0 -40Q36 -44 42 -15Q20 -20 14 -28Q-10 -10 -38 -18"
                          fill={character.hair}
                        />
                        {premium && <path data-material-depth="hair-sheen"
                          d="M-30 -21Q-21 -41 -3 -37Q15 -39 27 -30"
                          stroke="#fff8ec" strokeWidth="3.1" strokeLinecap="round"
                          opacity=".23" fill="none" pointerEvents="none" />}
                      </g>
                    )
                  )}
                  <Face
                    emotion={emotion}
                    mouth={mouth}
                  voiceOpening={voiceOpening}
                    blink={blink}
                    premium={premium}
                    gaze={premium ? gaze : undefined}
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
