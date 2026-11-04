import { objectAppearanceAt } from "../transform-motion";
import { sceneryOffset } from "../world-model";
import { PuppetArt } from "./PuppetArt";
import { cameraAt, backgroundAt, sceneFramesAt, sceneStart } from "../timeline";
import { handAt, interactionPaintOrder } from "../interaction-motion";
import type { InteractionFrame } from "../interaction-motion";
import type { Grip, Point } from "../interaction-model";
import { memo, useId, useRef, useState } from "react";
import type { PointerEvent } from "react";
import type {
  Character,
  Emotion,
  Project,
  Scene,
  SceneElement,
} from "../model";
import type { Pose } from "../art-model";
import { resolvedCharacter, elementName } from "../library";
import { BackgroundArt, PropArt, RasterArt } from "./Art";

function Flower({
  x,
  y,
  color = "#fff9ec",
  size = 1,
  sway = 0,
}: {
  x: number;
  y: number;
  color?: string;
  size?: number;
  sway?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size}) rotate(${sway})`}>
      <path
        d="M0 0v18m0-4c-9 0-9-6-9-6s8-1 9 6"
        fill="#4b9b70"
        stroke="#4b9b70"
        strokeWidth="2"
      />
      <g fill={color}>
        <ellipse cy="-7" rx="4" ry="7" />
        <ellipse cx="-7" rx="7" ry="4" />
        <ellipse cx="7" rx="7" ry="4" />
        <ellipse cy="7" rx="4" ry="7" />
      </g>
      <circle r="4" fill="#eab446" />
    </g>
  );
}
function Tree({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-6 0-3-125h8L8 0" fill="#a27b51" />
      <path
        d="m2-57-30-27m31 3 24-22"
        fill="none"
        stroke="#a27b51"
        strokeWidth="7"
      />
      <path
        d="M-60-109c-22-40 12-64 39-56 10-48 65-31 65-5 41-4 56 49 24 63-7 30-46 29-62 16-28 19-65 10-66-18"
        fill="#7caf82"
      />
      <circle cx="-24" cy="-140" r="5" fill="#ebcf84" />
      <circle cx="37" cy="-126" r="5" fill="#ebcf84" />
    </g>
  );
}
export function CartoonCharacter({
  character,
  emotion = "happy",
  blink = false,
  pose = "standing",
  acting,
}: {
  character: Character;
  emotion?: Emotion;
  blink?: boolean;
  pose?: Pose;
  acting?: InteractionFrame;
}) {
  const { shirt, skin, hair, accessory } = character;
  return (
    <g strokeLinejoin="round">
      <g transform={`rotate(${acting?.legAngle ?? 0} 0 -63)`}>
        <path
          d={
            pose === "sitting"
              ? "M-22-63-52-26h39M21-63 51-26H12"
              : pose === "walking"
                ? "m-22-63-25 47m68-47 25 47"
                : "m-22-63-8 47m51-47 8 47"
          }
          stroke="#3f5065"
          strokeWidth="17"
          strokeLinecap="round"
        />
        <path
          d="M-37-14h25v10h-33c0-6 2-10 8-10m49 0h25c6 0 8 4 8 10H12Z"
          fill="#fff5e3"
        />
      </g>
      <g transform={`rotate(${(acting?.armAngle ?? 0) + (acting?.interactionArm?.left ?? 0)} -28 -124)`}>
        <path
          d={
            pose === "waving"
              ? "M-28-124q-35-20-32-66"
              : pose === "walking"
                ? "M-28-124q-37 6-48-3"
                : "M-28-124q-25 7-32 42"
          }
          stroke={skin}
          strokeWidth="15"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      <path
        transform={acting?.interactionArm?.right ? `rotate(${acting.interactionArm.right} 28 -124)` : undefined}
        d={
          pose === "pointing"
            ? "M28-124 98-132"
            : pose === "walking"
              ? "M28-124q35 6 45 23"
              : "M28-124q25 7 32 42"
        }
        stroke={skin}
        strokeWidth="15"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M-28-126q28-13 56 0l9 65q-37 15-74 0Z" fill={shirt} />
      <path
        d="M-9-129q9 16 18 0"
        stroke="#fff6df"
        strokeWidth="5"
        fill="none"
      />
      <g
        transform={`translate(${acting?.gesture === "shake" ? acting.headAngle / 2 : 0} 0) rotate(${acting?.headAngle ?? 0} 0 -140)`}
      >
        <path
          d="M-31-147c-24-2-35-43-24-66 4-31 38-46 61-37 39-8 65 29 53 62l-14 38Z"
          fill={hair}
        />
        <ellipse cx="-45" cy="-164" rx="10" ry="13" fill={skin} />
        <ellipse cx="45" cy="-164" rx="10" ry="13" fill={skin} />
        <path d="M-44-184c0-41 88-41 88 0v28c-2 47-86 47-88 0Z" fill={skin} />
        <path
          d="M-46-184c-4-40 23-56 50-49 28-7 53 14 45 48-16-1-27-12-31-23-11 21-36 28-64 24"
          fill={hair}
        />
        <ellipse
          cx="-29"
          cy="-153"
          rx="9"
          ry="5"
          fill="#e78477"
          opacity=".55"
        />
        <ellipse cx="29" cy="-153" rx="9" ry="5" fill="#e78477" opacity=".55" />
        {blink || emotion === "calm" ? (
          <path
            d="M-26-171q7 7 14 0m24 0q7 7 14 0"
            stroke="#352e32"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        ) : (
          <g fill="#352e32">
            <ellipse
              cx="-19"
              cy="-171"
              rx="3.6"
              ry={emotion === "surprised" ? 7 : 5.8}
            />
            <ellipse
              cx="19"
              cy="-171"
              rx="3.6"
              ry={emotion === "surprised" ? 7 : 5.8}
            />
          </g>
        )}
        {(emotion === "sad" || emotion === "worried") && (
          <path
            d="m-26-182 14-5m24 0 14 5"
            stroke={hair}
            strokeWidth="3"
            fill="none"
          />
        )}
        {acting?.mouth === "closed" ? (
          <path
            d="M-11-148h22"
            stroke="#653f3e"
            strokeWidth="3"
            strokeLinecap="round"
          />
        ) : acting?.mouth === "open" ||
          (emotion === "surprised" && acting?.mouth !== "smile") ? (
          <ellipse cy="-149" rx={acting?.voiceOpening === undefined ? 5 : 5 + 5 * acting.voiceOpening}
            ry={acting?.voiceOpening === undefined ? 7 : 1 + 10 * acting.voiceOpening} fill="#653f3e" />
        ) : (
          <path
            d={
              acting?.mouth === "smile"
                ? "M-12-151q12 17 24 0"
                : emotion === "sad"
                  ? "M-9-145q9-9 18 0"
                  : emotion === "worried"
                    ? "M-12-148q6-5 12 0t12 0"
                    : emotion === "excited"
                      ? "M-17-153q17 30 34 0Z"
                      : "M-12-151q12 17 24 0"
            }
            fill={emotion === "sad" ? "none" : "#fff8ec"}
            stroke="#653f3e"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}
        {accessory === "cap" && (
          <g>
            <path
              d="M-47-207c-6-48 86-58 94-4l-34 4-11-31-7 31Z"
              fill="#77b49f"
            />
            <path d="m-50-209 105 2q14 0 17 8l-119-1Z" fill="#539480" />
          </g>
        )}
        {accessory === "bow" && (
          <g transform="translate(34 -217) rotate(14)">
            <path
              d="M0 0-20-15q-10 14 0 29Zm0 0 20-15q10 14 0 29Z"
              fill="#ed886e"
            />
            <circle r="6" fill="#ce684f" />
          </g>
        )}
      </g>
      {acting && acting.heart !== "off" && (
        <g
          transform={`translate(0 -91) scale(${acting.heartScale})`}
          data-heart={acting.heart}
        >
          <ellipse
            rx={22 + acting.heartStrength * 12}
            ry={18 + acting.heartStrength * 10}
            fill="#ffe3a1"
            opacity={acting.heartOpacity}
          />
          <ellipse
            rx="24"
            ry="21"
            fill="none"
            stroke="#fff6dc"
            strokeWidth="2"
            opacity=".8"
          />
          {acting.heart === "helping" && (
            <path
              d="M-30 0h-7M30 0h7M0-29v-7"
              stroke="#fff5de"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}
          {acting.heart === "together" && (
            <path
              d="M-25-8c-9-10-18 3 0 15 18-12 9-25 0-15m50 0c-9-10-18 3 0 15 18-12 9-25 0-15"
              fill="#fff8e4"
              stroke="#725b60"
              strokeWidth="1.5"
            />
          )}
        </g>
      )}
      <path
        d="M-5-99c-9-8-19 7 5 21 24-14 14-29 5-21l-5 4Z"
        fill={
          {
            happy: "#fff5de",
            sad: "#b5deef",
            calm: "#c8e5ce",
            surprised: "#ffdd8c",
            excited: "#f6c0ce",
            worried: "#d1c5ed",
          }[emotion]
        }
        opacity=".95"
      />
    </g>
  );
}

export const Stage = memo(function Stage({
  project,
  scene,
  progress = 0.5,
  showCaption = false,
  labelled = true,
  selectedId,
  onSelect,
  onMove,
  onResize,
  time,
  calmPreview = false,
  anchorMarkers,
  releaseMarker,
}: {
  project: Project;
  scene: Scene;
  progress?: number;
  time?: number;
  calmPreview?: boolean;
  anchorMarkers?: { actorId: string; grip: Grip }[];
  releaseMarker?: Point;
  showCaption?: boolean;
  labelled?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onResize?: (id: string, scale: number) => void;
}) {
  const root = useRef<SVGSVGElement>(null);
  const clipPrefix = useId();
  const tracks = scene.objectTracks?.length ? new Map(scene.objectTracks.map(track => [track.objectId, track])) : undefined;
  const dragging = useRef<{
    element: SceneElement;
    pointer: { x: number; y: number };
    resize?: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    scale?: number;
  } | null>(null);
  const objects = useRef<SVGGElement>(null);
  const voiceStart = scene.elements.some(element => element.voiceMouth?.length)
    ? sceneStart(project, project.scenes.findIndex(item => item.id === scene.id)) : 0;
  const t = time ?? progress * scene.duration;
  const frames = sceneFramesAt(project, scene, t, voiceStart, calmPreview);
  const camera = cameraAt(scene, t, calmPreview, frames.get(scene.cameraAnimation?.followId ?? ""));
  const paintOrder = scene.interactions?.length ? interactionPaintOrder(scene.elements, frames) : scene.elements;
  const background = backgroundAt(scene, t, calmPreview);
  const night = scene.background === "moonlight";
  const classroom = scene.background === "classroom";
  const cameraTransform = `translate(400 225) scale(${camera.zoom}) translate(${-camera.x} ${-camera.y})`;
  function point(e: PointerEvent<SVGGElement>) {
    const matrix =
      objects.current?.getScreenCTM() ?? root.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      matrix.inverse(),
    );
    return { x: p.x, y: p.y };
  }

  function move(e: PointerEvent<SVGGElement>, finish = false) {
    const d = dragging.current;
    if (!d) return;
    const p = point(e);
    if (d.resize) {
      const scale = Math.max(
        d.element.animation?.keyframes.length ? 0.05 : 0.3,
        Math.min(
          d.element.animation?.keyframes.length ? 4 : 2,
          d.element.scale + (p.x - d.pointer.x + p.y - d.pointer.y) / 300,
        ),
      );
      if (finish) {
        dragging.current = null;
        setDrag(null);
        onResize?.(d.element.id, Math.round(scale * 100) / 100);
      } else setDrag({ id: d.element.id, x: 0, y: 0, scale });
      return;
    }
    const x = Math.max(0, Math.min(800, d.element.x + p.x - d.pointer.x));
    const y = Math.max(50, Math.min(450, d.element.y + p.y - d.pointer.y));
    if (finish) {
      dragging.current = null;
      setDrag(null);
      if (Math.abs(x - d.element.x) + Math.abs(y - d.element.y) > 1)
        onMove?.(d.element.id, Math.round(x), Math.round(y));
    } else
      setDrag({ id: d.element.id, x: x - d.element.x, y: y - d.element.y });
  }
  return (
    <svg
      ref={root}
      style={onSelect ? { touchAction: "none" } : undefined}
      viewBox="0 0 800 450"
      role={onSelect ? "group" : labelled ? "img" : undefined}
      aria-label={labelled ? `${scene.title}: ${scene.action}` : undefined}
      aria-hidden={!labelled || undefined}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        width="800"
        height="450"
        fill={classroom ? "#f1e5cf" : night ? "#343e64" : "#d3eae2"}
      />
      <g
        opacity={
          scene.transition === "fade" && !onSelect && !calmPreview
            ? Math.min(1, t / 0.4)
            : 1
        }
      >
        <g
          data-camera-transform={scene.cameraAnimation ? "animated" : "legacy"}
          transform={scene.cameraAnimation ? cameraTransform : undefined}
        >
          <g
            data-background-motion={
              scene.backgroundAnimation?.enabled
                ? scene.backgroundAnimation.style
                : "off"
            }
            transform={`translate(${background.x} ${background.y}) translate(400 225) scale(${background.scale}) translate(-400 -225)`}
            opacity={background.opacity}
          >
            {classroom ? (
              <g>
                <rect
                  x="87"
                  y="55"
                  width="260"
                  height="180"
                  rx="9"
                  fill="#7fa89b"
                  stroke="#c3a87c"
                  strokeWidth="14"
                />
                <path
                  d="m135 145 25-35 25 35m-10-11h-30m65-15h79m-79 23h60"
                  stroke="#f9f0dc"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                <rect
                  x="506"
                  y="55"
                  width="190"
                  height="180"
                  rx="4"
                  fill="#d1e7df"
                  stroke="#fff8e9"
                  strokeWidth="14"
                />
                <path
                  d="M601 55v180m-95-90h190"
                  stroke="#fff8e9"
                  strokeWidth="9"
                />
                <rect y="290" width="800" height="160" fill="#c9ab83" />
                <ellipse cx="408" cy="366" rx="260" ry="65" fill="#e1ba8e" />
              </g>
            ) : (
              <g>
                {night ? (
                  <g fill="#fff1bb">
                    <path d="M657 59a35 35 0 1 0 35 44 29 29 0 0 1-35-44" />
                    {[70, 230, 490, 590, 730, 380].map((x, i) => (
                      <path
                        key={x}
                        opacity={background.twinkle}
                        d={`m${x} ${35 + (i % 3) * 35} 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z`}
                      />
                    ))}
                  </g>
                ) : (
                  <g>
                    <circle cx="659" cy="75" r="34" fill="#f5cf73" />
                    <path
                      d="M659 25v-7m0 114v-7m50-50h7m-114 0h7m84-35 5-5m-79 79 5-5m69 0 5 5m-79-79 5 5"
                      stroke="#e8be65"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    <path
                      transform={`translate(${background.drift} 0)`}
                      d="M90 88c-1-26 35-34 47-13 19-10 44 1 41 20h-93Z"
                      fill="#f4faf3"
                    />
                    <path
                      transform={`translate(${background.drift * 0.6} 0)`}
                      d="M440 67c0-20 26-25 36-10 15-7 32 1 30 14h-69Z"
                      fill="#f4faf3"
                    />
                  </g>
                )}
                <path
                  d="M0 245Q160 130 336 233q180-144 464-21v238H0Z"
                  fill={night ? "#4f756d" : "#a9cba8"}
                />
                <path
                  d="M0 296Q210 204 459 282q166-68 341-30v198H0Z"
                  fill={night ? "#467362" : "#8db88f"}
                />
                <path
                  d="M800 325q-291-42-294 29t-140 96h215q98-58 76-79t143-26"
                  fill={night ? "#709897" : "#b4d9cf"}
                />
                <path
                  d="M0 385q265-101 480 65H0Z"
                  fill={night ? "#507d61" : "#bad298"}
                />
                <Tree x={80} y={312} scale={0.95} />
                <Tree x={744} y={302} scale={0.8} />
                {scene.background === "playground" && (
                  <g
                    stroke="#c7875b"
                    strokeWidth="10"
                    fill="none"
                    strokeLinecap="round"
                  >
                    <path d="m100 290 30-130 40 130m-40-130h90l35 130m-95-130v80m40-80v80" />
                    <path d="M150 242h60" stroke="#e7b74c" />
                  </g>
                )}
                <Flower sway={background.sway} x={109} y={372} />
                <Flower
                  sway={background.sway}
                  x={150}
                  y={401}
                  color="#f1b0a0"
                  size={0.8}
                />
                <Flower sway={background.sway} x={652} y={399} />
                <Flower
                  sway={background.sway}
                  x={691}
                  y={357}
                  color="#eed68d"
                  size={0.75}
                />
                <Flower sway={background.sway} x={221} y={365} size={0.6} />
                <path
                  d="m400 92 5 13 14 1-11 9 3 14-11-8-12 8 4-14-11-9 14-1Z"
                  fill="#f6de9c"
                />
              </g>
            )}
            <g transform={`rotate(${background.sway} 400 450)`}>
              <BackgroundArt background={scene.background} />
            </g>
          </g>
          <g
            ref={objects}
            transform={scene.cameraAnimation ? undefined : cameraTransform}
          >
            {paintOrder.map((element, i) => {
              const character = resolvedCharacter(project, element);
              const track = tracks?.get(element.id);
              const change = track && objectAppearanceAt(scene, track, t, calmPreview);
              const art = change?.state?.art;
              const assetId = art?.kind === "image" ? art.assetId :
                art?.kind === "prop" ? undefined : element.assetId ?? character?.assetId;
              const appearance = art?.kind === "prop" ? art.appearance : element.propAppearance;
              const asset = project.assets.find(a => a.id === assetId);
              const frame = frames.get(element.id)!;
              const depth = sceneryOffset(scene, element, camera, !!calmPreview);
              const width =
                element.width ?? (character?.puppet ? 230 : asset ? (element.backdrop ? 800 : 190) : 120);
              const height =
                element.height ??
                (asset ? (element.backdrop ? 450 : 245) : 260);
              const clipWidth = asset ? width : 230;
              const clipId = `${clipPrefix}-appearance-${i}`;
              const artwork = character?.puppet ? (
                    <PuppetArt character={character} assets={project.assets} joints={frame.joints}
                      emotion={frame.emotion} mouth={frame.mouth} voiceOpening={frame.voiceOpening} blink={frame.blink}
                      heartOpacity={frame.heartOpacity} heartScale={frame.heartScale} />
                  ) : asset ? (
                    <RasterArt
                      asset={asset}
                      width={width}
                      height={height}
                      crop={art?.kind === "image" ? art.crop : element.crop}
                      cover={element.backdrop}
                    />
                  ) : element.kind === "prop" && element.prop ? (
                    <PropArt name={element.prop} openness={frame.openness} appearance={appearance} />
                  ) : character ? (
                    <CartoonCharacter
                      character={character}
                      emotion={frame.emotion}
                      blink={frame.blink}
                      pose={frame.pose}
                      acting={frame}
                    />
                  ) : null;
              return (
                <g
                  key={element.id}
                  transform={`translate(${frame.x + depth.x + (drag?.id === element.id ? drag.x : 0)} ${frame.y + depth.y + (drag?.id === element.id ? drag.y : 0)}) rotate(${frame.rotation}) scale(${(drag?.id === element.id && drag.scale !== undefined ? drag.scale : frame.scale) * (element.flip ? -1 : 1)} ${(drag?.id === element.id && drag.scale !== undefined ? drag.scale : frame.scale) * (element.flipY ? -1 : 1)})`}
                  opacity={frame.opacity}
                  data-element-id={element.id}
                  data-object-state={change?.state?.name}
                  data-prop-appearance={appearance}
                  data-held-by={frame.heldBy}
                  data-scenery-depth={element.sceneryDepth}
                  data-voice-opening={frame.voiceOpening}
                  role={onSelect ? "button" : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  aria-label={
                    onSelect
                      ? `Select ${elementName(project, element)}`
                      : undefined
                  }
                  className={onSelect ? "stage-object" : undefined}
                  onPointerDown={
                    onSelect
                      ? (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onSelect(element.id);
                          if (frame.interactionPosition) return;
                          e.currentTarget.setPointerCapture(e.pointerId);
                          dragging.current = {
                            element: {
                              ...element,
                              x: frame.x,
                              y: frame.y,
                              scale: frame.scale,
                            },
                            pointer: point(e),
                            resize:
                              (e.target as SVGElement).getAttribute(
                                "data-resize",
                              ) === "yes",
                          };
                        }
                      : undefined
                  }
                  onPointerMove={onSelect ? (e) => move(e) : undefined}
                  onPointerUp={onSelect ? (e) => move(e, true) : undefined}
                  onPointerCancel={() => {
                    dragging.current = null;
                    setDrag(null);
                  }}
                  onKeyDown={
                    onSelect
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(element.id);
                          } else if (
                            !frame.interactionPosition && [
                              "ArrowLeft",
                              "ArrowRight",
                              "ArrowUp",
                              "ArrowDown",
                            ].includes(e.key)
                          ) {
                            e.preventDefault();
                            onSelect(element.id);
                            onMove?.(
                              element.id,
                              Math.max(
                                0,
                                Math.min(
                                  800,
                                  frame.x +
                                    (e.key === "ArrowLeft"
                                      ? -5
                                      : e.key === "ArrowRight"
                                        ? 5
                                        : 0),
                                ),
                              ),
                              Math.max(
                                50,
                                Math.min(
                                  450,
                                  frame.y +
                                    (e.key === "ArrowUp"
                                      ? -5
                                      : e.key === "ArrowDown"
                                        ? 5
                                        : 0),
                                ),
                              ),
                            );
                          }
                        }
                      : undefined
                  }
                >
                  {!frame.heldBy && <ellipse cy="3" rx="48" ry="9" fill="#3b5b45" opacity=".14" />}
                  {change ? <g opacity={change.opacity} clipPath={change.reveal < 1 ? `url(#${clipId})` : undefined}>
                    {change.reveal < 1 && <defs><clipPath id={clipId}><rect
                      x={-clipWidth / 2} y={-height - 15} width={clipWidth * change.reveal} height={height + 38} />
                    </clipPath></defs>}
                    {artwork}
                  </g> : artwork}
                  {!!change?.sparkle && <g data-completion="" opacity={change.sparkle} pointerEvents="none"
                    transform={`translate(${Math.min(width / 2 + 4, 90)} ${asset ? -Math.min(height, 160) : -70})`} aria-hidden="true">
                    <path d="M0-16 4-5 15 0 4 5 0 16-4 5-15 0-4-5Z" fill="#ffde79" stroke="#765436" strokeWidth="2" />
                  </g>}
                  {!!frame.pointing && <g pointerEvents="none" opacity={frame.pointing} aria-hidden="true">
                    <path d="M-12 9H12m-6-5 6 5-6 5m-28-5h-8" stroke="#fff7d9" strokeWidth="8" strokeLinecap="round" fill="none" />
                    <path d="M-12 9H12m-6-5 6 5-6 5m-28-5h-8" stroke="#51416d" strokeWidth="4" strokeLinecap="round" fill="none" />
                  </g>}
                  {onSelect && selectedId === element.id && (
                    <g pointerEvents="none">
                      <rect
                        x={-width / 2 - 8}
                        y={-height - 8}
                        width={width + 16}
                        height={height + 16}
                        fill="none"
                        stroke="#346bba"
                        strokeWidth="3"
                        strokeDasharray="8 5"
                        vectorEffect="non-scaling-stroke"
                      />
                      {!frame.interactionPosition && <rect
                        data-resize="yes"
                        pointerEvents="all"
                        x={width / 2 - 9}
                        y={-9}
                        width="18"
                        height="18"
                        fill="#fff"
                        stroke="#346bba"
                        strokeWidth="2"
                        className="stage-resize"
                      />}
                    </g>
                  )}
                </g>
              );
            })}
            {[...frames].map(([id, frame]) => frame.watering && (
              <g key={id} data-watering="" transform={`translate(${frame.watering.x} ${frame.watering.y})`}
                pointerEvents="none" fill="none" strokeLinecap="round" aria-hidden="true">
                <path d="M0 0Q-19 4-23 22M-3 1Q-33 7-42 34" stroke="#f0fcff" strokeWidth="6" />
                <path d="M0 0Q-19 4-23 22M-3 1Q-33 7-42 34" stroke="#448ca8" strokeWidth="3" strokeDasharray="5 6"
                  strokeDashoffset={calmPreview ? 0 : -t * 18} />
              </g>
            ))}
            {releaseMarker && <g transform={`translate(${releaseMarker.x} ${releaseMarker.y})`}
              pointerEvents="none" aria-hidden="true" data-release-point="">
              <circle r="11" fill="#fff" stroke="#5933a6" strokeWidth="3" strokeDasharray="4 3" />
              <path d="M-4 0h8m-4-4v8" stroke="#5933a6" strokeWidth="2" />
            </g>}
            {anchorMarkers?.map(({ actorId, grip }) => {
              const actor = scene.elements.find(item => item.id === actorId);
              if (!actor) return null;
              const marker = handAt(resolvedCharacter(project, actor), actor, frames.get(actor.id)!, grip);
              return <circle key={actorId} cx={marker.x} cy={marker.y} r="7" fill="#fff" stroke="#5933a6"
                strokeWidth="3" pointerEvents="none" aria-hidden="true" data-hold-point="" />;
            })}
          </g>
        </g>
        {showCaption && (
          <g>
            <rect
              x="30"
              y="388"
              width="740"
              height="45"
              rx="10"
              fill="#242b42"
              opacity=".9"
            />
            <text
              x="400"
              y="416"
              fill="#fffaf1"
              textAnchor="middle"
              fontSize="17"
              fontFamily="Arial, sans-serif"
            >
              {scene.narration.slice(0, 88)}
              {scene.narration.length > 88 ? "…" : ""}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
});
