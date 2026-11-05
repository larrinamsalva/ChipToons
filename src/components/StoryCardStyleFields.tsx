import { STORY_CARD_FONTS, STORY_CARD_MOTIONS } from "../story-card-model";
import type { StoryCardStyle } from "../story-card-model";
import { MediaNumber } from "./MediaNumber";

export function StoryCardStyleFields({ style, onChange }: { style: StoryCardStyle; onChange: (style: StoryCardStyle) => void }) {
  const set = (patch: Partial<StoryCardStyle>) => onChange({ ...style, ...patch });
  return <fieldset className="interaction-fields story-card-fields">
    <legend>Card appearance</legend>
    <label>Title animation<select value={style.motion} onChange={event => set({ motion: event.target.value as StoryCardStyle["motion"] })}>
      {Object.entries(STORY_CARD_MOTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <label>Title font<select value={style.font} onChange={event => set({ font: event.target.value as StoryCardStyle["font"] })}>
      {Object.entries(STORY_CARD_FONTS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    <MediaNumber label="Title text size" value={style.size} min={28} max={54} step={1} onChange={size => set({ size: Math.round(size) })} />
    <label>Text alignment<select value={style.align} onChange={event => set({ align: event.target.value as StoryCardStyle["align"] })}>
      <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
    </select></label>
    <label>Title text color<input type="color" value={style.ink} onChange={event => set({ ink: event.target.value })} /></label>
    <label>Card background color<input type="color" value={style.paper} onChange={event => set({ paper: event.target.value })} /></label>
    <label className="world-check"><input type="checkbox" checked={style.border} onChange={event => set({ border: event.target.checked })} /> Decorative border</label>
  </fieldset>;
}
