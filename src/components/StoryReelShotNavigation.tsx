import type { ReelPlan } from "../studio-story-reel";
import { LocalFrameImage } from "./ShotFramePreview";

/**
 * Visible local shot boundaries for the same deterministic storyboard plan
 * used by the player and by the new-project importer. These are preview-only
 * navigation controls: no scene mutation, audio, image copies or remote files.
 */
export function StoryReelShotNavigation({
  plan, position, activeIndex, disabled = false, onJump,
}: {
  plan: ReelPlan;
  position: number;
  activeIndex: number;
  disabled?: boolean;
  onJump: (time: number) => void;
}) {
  return (
    <nav className="studio-reel-shot-nav" aria-label="Storyboard scene markers">
      <p className="field-hint">
        Scene markers · select a shot to pause and jump to its first original frame.
      </p>
      <ol className="studio-reel-shot-list">
        {plan.shots.map((shot, index) => {
          const elapsed = Math.min(shot.duration, Math.max(0, position - shot.start));
          const played = shot.duration > 0 ? elapsed / shot.duration * 100 : 0;
          const ending = shot.start + shot.duration;
          return (
            <li key={shot.prefix} style={{ flexGrow: shot.duration }}>
              <button type="button" disabled={disabled}
                className="studio-reel-shot-jump"
                aria-current={index === activeIndex ? "step" : undefined}
                aria-label={`Jump to shot ${index + 1}: ${shot.prefix} at ${shot.start.toFixed(2)} seconds`}
                onClick={() => onJump(shot.start)}>
                <span className="studio-reel-shot-progress" aria-hidden="true">
                  <span style={{ width: `${played.toFixed(2)}%` }} />
                </span>
                {/* Only the first ORIGINAL selected PNG is shown. These tiny
                    previews are decorative inside an already-named button,
                    keeping its accessible name and jump action unchanged.
                    LocalFrameImage revokes every temporary blob URL on unmount. */}
                <span className="studio-reel-shot-thumbnail" aria-hidden="true"
                  data-thumbnail-shot={shot.prefix}>
                  <LocalFrameImage file={shot.files[0]}
                    alt={`Original first frame of ${shot.prefix}`} />
                </span>
                <strong>Shot {index + 1}</strong>
                <span className="studio-reel-shot-name">{shot.prefix}</span>
                <span className="studio-reel-shot-time">
                  {shot.start.toFixed(2)}–{ending.toFixed(2)}s
                </span>
                {shot.holdSeconds > 0 && (
                  <span className="studio-reel-shot-hold">+{shot.holdSeconds}s final-frame hold</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
