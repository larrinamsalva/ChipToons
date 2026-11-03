import type { CaptionStyle } from "../media-model";
import { captionLayout } from "../captions";
export function CaptionOverlay({
  text,
  style,
}: {
  text: string;
  style: CaptionStyle;
}) {
  if (!text) return null;
  const { lines, height, y } = captionLayout(text, style);
  return (
    <svg className="caption-overlay" viewBox="0 0 800 450" aria-hidden="true">
      <rect
        x="28"
        y={y}
        width="744"
        height={height}
        fill="#121925"
        opacity=".94"
      />
      {lines.map((line, i) => (
        <text
          key={i}
          x="400"
          y={y + 10 + style.fontSize + i * (style.fontSize + 6)}
          textAnchor="middle"
          fill={style.color}
          fontSize={style.fontSize}
          fontFamily="monospace"
        >
          {line}
        </text>
      ))}
    </svg>
  );
}
