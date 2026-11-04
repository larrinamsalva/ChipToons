import type { Point } from "../interaction-model";
import type { FocusGraphic } from "../focus-model";
import type { focusLayout, Rectangle } from "../focus-motion";

export function FocusArt({ graphic, point, layout, opacity, progress }: {
  graphic: FocusGraphic; point: Point; layout: ReturnType<typeof focusLayout>; opacity: number; progress: number;
}) {
  const { radius, box, lines, marker, arrow } = layout;
  const { kind, ink, paper, textSize } = graphic;
  const stroke = { fill: "none", pathLength: 1, strokeDasharray: progress < 1 ? `${progress} 1` : undefined };
  return <g pointerEvents="none" aria-hidden="true" opacity={opacity}
    data-focus-id={graphic.id} data-focus-kind={kind} data-focus-x={point.x} data-focus-y={point.y}>
    {kind === "spotlight" && <path fill="#101728" fillOpacity=".18" fillRule="evenodd"
      d={`M0 0H800V450H0Z M${point.x - radius} ${point.y}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`} />}
    {(kind === "circle" || kind === "spotlight") && <>
      <circle {...stroke} cx={point.x} cy={point.y} r={radius} stroke={paper} strokeWidth={7} />
      <circle {...stroke} cx={point.x} cy={point.y} r={radius} stroke={ink} strokeWidth={3} />
    </>}
    {kind === "arrow" && <g strokeLinecap="round" strokeLinejoin="round">
      <path {...stroke} d={arrow} stroke={paper} strokeWidth="9" />
      <path {...stroke} d={arrow} stroke={ink} strokeWidth="4" />
    </g>}
    {kind === "number" && <>
      <circle cx={marker.x} cy={marker.y} r={radius} fill={paper} stroke={ink} strokeWidth="3" />
      <text x={marker.x} y={marker.y} dy=".35em" textAnchor="middle" fill={ink}
        fontFamily="Arial, sans-serif" fontWeight="700" fontSize={Math.min(textSize, radius * 1.2)}>{graphic.number}</text>
    </>}
    {box && <>
      <rect {...box} rx={kind === "card" ? 13 : 9} fill={paper} stroke={ink} strokeWidth="2" />
      {lines.map((line, index) => <text key={index} x={box.x + box.width / 2} y={box.y + textSize + 7 + index * (textSize + 4)}
        textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize={textSize} fill={ink}
        textLength={Math.min(box.width - 20, [...line].length * textSize * 0.61)} lengthAdjust="spacingAndGlyphs">{line}</text>)}
    </>}
  </g>;
}

export function CaptionGuide({ band }: { band?: Rectangle }) {
  const box = band ?? { x: 28, y: 373, width: 744, height: 61 };
  return <g pointerEvents="none" aria-hidden="true" data-caption-guide="">
    <rect x={box.x - 3} y={box.y - 3} width={box.width + 6} height={box.height + 6} rx="6"
      fill="none" stroke="#fff" strokeWidth="6" />
    <rect x={box.x - 3} y={box.y - 3} width={box.width + 6} height={box.height + 6} rx="6"
      fill="none" stroke="#25468c" strokeWidth="3" strokeDasharray="8 6" />
    <text x="35" y={box.y < 225 ? box.y + box.height + 20 : box.y - 10}
      stroke="#fff" paintOrder="stroke" strokeWidth="4" fill="#203e78" fontFamily="Arial, sans-serif" fontWeight="bold"
      fontSize="15">Keep captions clear</text>
  </g>;
}
