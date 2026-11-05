import type { LibraryItem } from "../library";
import { CARD_SOUNDS, seriesPresentation } from "../story-card-model";
import type { SeriesPresentation } from "../story-card-model";
import { StoryCardStyleFields } from "./StoryCardStyleFields";

export function SeriesPresentationFields({ value, library, onChange }: {
  value?: SeriesPresentation; library: LibraryItem[]; onChange: (value?: SeriesPresentation) => void;
}) {
  if (!value) return <button className="button secondary small" type="button"
    onClick={() => onChange(seriesPresentation())}>Set opening and ending defaults</button>;
  return <div className="story-card-defaults">
    <p>Review these suggestions when preparing a linked episode. Earlier cartoons keep their own saved cards.</p>
    <StoryCardStyleFields style={value.style} onChange={style => onChange({ ...value, style })} />
    <label>Default card artwork<select value={value.artId} onChange={event => onChange({ ...value, artId: event.target.value })}>
      <option value="">Use the episode’s own background</option>
      {value.artId && !library.some(item => item.id === value.artId) && <option value={value.artId}>Saved artwork unavailable</option>}
      {library.filter(item => item.kind === "background").map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    <label>Suggested opening sound<select value={value.sound}
      onChange={event => onChange({ ...value, sound: event.target.value as SeriesPresentation["sound"] })}>
      <option value="">Silent</option>
      {Object.entries(CARD_SOUNDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <label>Preferred ending<select value={value.ending}
      onChange={event => onChange({ ...value, ending: event.target.value as SeriesPresentation["ending"] })}>
      <option value="thanks">Thank-you or character goodbye</option><option value="credits">Still credits</option>
      <option value="scroll">Scrolling credits</option>
    </select></label>
    <label>Suggested credit roles (one per line)
      <textarea key={value.roles.join("|")} maxLength={365} defaultValue={value.roles.join("\n")}
        onBlur={event => {
          const roles = event.target.value.split("\n").map(role => role.trim().slice(0, 45)).filter(Boolean).slice(0, 8);
          if (roles.join("\n") !== value.roles.join("\n")) onChange({ ...value, roles });
        }} />
    </label>
    <button className="button text small" type="button" onClick={() => onChange(undefined)}>Clear series presentation defaults</button>
  </div>;
}
