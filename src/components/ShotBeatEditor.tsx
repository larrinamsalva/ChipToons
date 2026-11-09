import {
  SHOT_BEAT_ACTION_LIMIT, SHOT_BEAT_NARRATION_LIMIT, SHOT_BEAT_TITLE_LIMIT,
} from "../studio-shot-beats";
import type { ShotBeat } from "../studio-shot-beats";

/** Optional original story text for a locally selected shot, not a voice generator. */
export function ShotBeatEditor({
  beat, onChange, disabled = false,
}: {
  beat: ShotBeat;
  onChange: (next: ShotBeat) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="studio-shot-beat-editor" disabled={disabled}
      aria-label={`Story beat for ${beat.prefix}`}>
      <legend>Story beat · optional</legend>
      <label>
        Scene title
        <input type="text" maxLength={SHOT_BEAT_TITLE_LIMIT}
          aria-label={`Scene title for ${beat.prefix}`}
          placeholder="e.g. Scout finds a loose bicycle wheel"
          value={beat.title}
          onChange={event => onChange({ ...beat, title: event.target.value })} />
      </label>
      <label>
        What happens in this shot?
        <textarea maxLength={SHOT_BEAT_ACTION_LIMIT} rows={2}
          aria-label={`Scene action for ${beat.prefix}`}
          placeholder="Describe the visible action and the lesson..."
          value={beat.action}
          onChange={event => onChange({ ...beat, action: event.target.value })} />
      </label>
      <label>
        Written narration (not recorded speech)
        <textarea maxLength={SHOT_BEAT_NARRATION_LIMIT} rows={2}
          aria-label={`Written narration for ${beat.prefix}`}
          placeholder="e.g. First, we check whether the bike is safe."
          value={beat.narration}
          onChange={event => onChange({ ...beat, narration: event.target.value })} />
      </label>
      <p className="field-hint">
        Your text becomes editable scene notes in the new cartoon.
        Narration is a script, not an automatic voice recording.
        Keep spoken lines short enough for this shot's duration.
      </p>
    </fieldset>
  );
}
