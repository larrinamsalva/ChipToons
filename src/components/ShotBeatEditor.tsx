import {
  SHOT_BEAT_ACTION_LIMIT, SHOT_BEAT_NARRATION_LIMIT, SHOT_BEAT_TITLE_LIMIT,
} from "../studio-shot-beats";
import type { ShotBeat } from "../studio-shot-beats";
import { narrationTiming } from "../studio-voice-cues";

/** Optional original story text for a locally selected shot, not a voice generator. */
export function ShotBeatEditor({
  beat, onChange, shotSeconds, disabled = false,
}: {
  beat: ShotBeat;
  onChange: (next: ShotBeat) => void;
  shotSeconds: number;
  disabled?: boolean;
}) {
  const pacing = narrationTiming(beat.narration, shotSeconds);
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
      <p className={pacing.estimatedOverrun
        ? "studio-voice-timing-warning" : "field-hint"}
        data-narration-timing={beat.prefix}>
        {pacing.words} spoken word{pacing.words === 1 ? "" : "s"} · about
        {" "}{pacing.estimatedSeconds.toFixed(1)}s at 120 words/minute,
        for a {shotSeconds.toFixed(1)}s shot.
        {pacing.estimatedOverrun
          ? " The script may run past this scene. Shorten it or adjust its duration after importing."
          : " Rehearse your narration—actual speaking time may vary."}
      </p>
      <p className="field-hint">
        Your text becomes editable scene notes, not an automatic voice recording.
      </p>
    </fieldset>
  );
}
