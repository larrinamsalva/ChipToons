import {
  SUBTITLE_DRAFT_TEXT_LIMIT,
  suggestedSubtitleAdjustment,
} from "../studio-subtitle-drafts";
import type { SubtitleDraftAdjustment } from "../studio-subtitle-drafts";

/**
 * Optional preview-only caption edits. Changing these words NEVER changes
 * Story Beats narration, the actual movie, the source PNGs or saved projects.
 */
export function SubtitleCueEditor({
  prefix, narration, shotSeconds, adjustment, disabled = false, onChange,
}: {
  prefix: string;
  narration: string;
  shotSeconds: number;
  adjustment?: SubtitleDraftAdjustment;
  disabled?: boolean;
  onChange: (next?: SubtitleDraftAdjustment) => void;
}) {
  return (
    <fieldset className="studio-subtitle-cue-editor" disabled={disabled}
      aria-label={`Subtitle cues for ${prefix}`}>
      <legend>Subtitle cue review · optional</legend>
      {!adjustment ? (
        <>
          <p className="field-hint">
            By default, your written narration becomes one subtitle covering
            the entire shot. Customize only if you want shorter caption cues.
          </p>
          <button type="button" className="button secondary small"
            aria-label={`Customize subtitles for ${prefix}`}
            onClick={() => onChange(suggestedSubtitleAdjustment(prefix, narration))}>
            Customize subtitles
          </button>
        </>
      ) : (
        <>
          <p className="field-hint">
            These captions are separate from your narration script. You can
            enter a second caption to split this shot into two timed cues.
            Blank captions are omitted from the .srt file.
          </p>
          <label>
            First subtitle
            <textarea rows={2} maxLength={SUBTITLE_DRAFT_TEXT_LIMIT}
              aria-label={`First subtitle for ${prefix}`}
              value={adjustment.first}
              onChange={event => onChange({
                ...adjustment, first: event.target.value,
              })} />
          </label>
          <label>
            Second subtitle · optional
            <textarea rows={2} maxLength={SUBTITLE_DRAFT_TEXT_LIMIT}
              aria-label={`Second subtitle for ${prefix}`}
              placeholder="What should appear after the first caption?"
              value={adjustment.second}
              onChange={event => onChange({
                ...adjustment, second: event.target.value,
              })} />
          </label>
          {!!adjustment.second.trim() && (
            <label>
              Second subtitle begins at {adjustment.splitPercent}% of this shot
              <input type="range" min={20} max={80} step={5}
                aria-label={`Second subtitle timing for ${prefix}`}
                value={adjustment.splitPercent}
                onChange={event => onChange({
                  ...adjustment, splitPercent: Number(event.target.value),
                })} />
              <span className="field-hint">
                {((shotSeconds * adjustment.splitPercent) / 100).toFixed(2)}s into
                this {shotSeconds.toFixed(2)}s shot.
              </span>
            </label>
          )}
          <button type="button" className="button secondary small"
            aria-label={`Use original narration for subtitles of ${prefix}`}
            onClick={() => onChange(undefined)}>
            Use original narration
          </button>
        </>
      )}
    </fieldset>
  );
}
