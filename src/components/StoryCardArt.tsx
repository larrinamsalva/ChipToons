import { useId } from "react";
import type { Project, Scene } from "../model";
import type { StoryCard } from "../story-card-model";
import { storyCardFrame, storyCardLayout, STORY_FONTS } from "../story-card-layout";

export function StoryCardArt({ project, scene, card, time, calm }: {
  project: Project; scene: Scene; card: StoryCard; time: number; calm: boolean;
}) {
  const clip = useId();
  const layout = storyCardLayout(project, scene, card);
  const { x, y, width, height, length, contentHeight } = layout;
  const frame = storyCardFrame(card, time, scene.duration, calm, length, contentHeight);
  const align = card.style.align;
  const textX = align === "left" ? x + 32 : align === "right" ? x + width - 32 : 400;
  const anchor = align === "left" ? "start" : align === "right" ? "end" : "middle";
  const firstY = y + 18 + (card.scroll ? frame.lead : Math.max(0, (contentHeight - length) / 2));
  return <g data-story-card={card.kind} aria-hidden="true" pointerEvents="none">
    <defs><clipPath id={clip}><rect x={x + 10} y={y + 17} width={width - 20} height={contentHeight * frame.reveal} /></clipPath></defs>
    <rect x={x + 3} y={y + 7} width={width} height={height} rx="25" fill="#31233b" opacity=".24" />
    <rect x={x} y={y} width={width} height={height} rx="24" fill={card.style.paper}
      stroke={card.style.border ? card.style.ink : undefined} strokeWidth="2.5" />
    {card.style.border && <path d={`M${x + 27} ${y + 12}h54m${width - 162} 0h54`}
      stroke={card.style.ink} strokeWidth="2" strokeLinecap="round" opacity=".58" />}
    {frame.glow > 0 && <g transform={`translate(${x + width - 30} ${y + 24})`}>
      <ellipse rx="24" ry="21" fill="#ffba70" opacity={frame.glow} />
      <path d="M-3-8c-9-8-19 7 5 21 24-14 14-29 5-21l-5 4Z" fill="#a03864" />
    </g>}
    <g clipPath={`url(#${clip})`} fill={card.style.ink} opacity={frame.opacity}
      fontFamily={STORY_FONTS[card.style.font]} textAnchor={anchor}>
      {layout.lines.map((line, index) => <text key={index} x={textX + (align === "right" ? -frame.slide : frame.slide)}
        y={firstY + line.offset + line.size - frame.scroll} fontSize={line.size}
        fontWeight={line.strong ? 700 : 500}>{line.text}</text>)}
    </g>
  </g>;
}
