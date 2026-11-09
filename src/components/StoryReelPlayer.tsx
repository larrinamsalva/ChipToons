import { useEffect, useRef, useState } from "react";
import { LocalFrameImage } from "./ShotFramePreview";
import { StoryReelShotNavigation } from "./StoryReelShotNavigation";
import { storyReelFrameAt } from "../studio-story-reel";
import type { ReelPlan } from "../studio-story-reel";
import type { ShotBeat } from "../studio-shot-beats";
import { storyboardSubtitleAt } from "../studio-subtitle-drafts";
import type { SubtitleDraftAdjustment } from "../studio-subtitle-drafts";

/** A local-only filmstrip player for original PNG shots prior to import. */
export function StoryReelPlayer({
  plan, beats, adjustments, disabled = false,
}: {
  plan: ReelPlan;
  beats?: readonly ShotBeat[];
  adjustments?: readonly SubtitleDraftAdjustment[];
  disabled?: boolean;
}) {
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const startClock = useRef(0);
  const frame = storyReelFrameAt(plan, position);
  const draftSubtitle = beats
    ? storyboardSubtitleAt(plan, beats, position, adjustments)
    : "";

  useEffect(() => {
    if (!playing || disabled) return;
    let request = 0;
    const tick = (now: number) => {
      const elapsed = Math.max(0, Math.min(plan.duration, (now - startClock.current) / 1000));
      setPosition(elapsed);
      if (elapsed >= plan.duration) {
        setPlaying(false);
        return;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, disabled, plan.duration]);

  useEffect(() => {
    const pauseForHiddenTab = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseForHiddenTab);
    return () => document.removeEventListener("visibilitychange", pauseForHiddenTab);
  }, []);

  const seek = (seconds: number) => {
    const next = Math.max(0, Math.min(plan.duration,
      Number.isFinite(seconds) ? seconds : 0));
    setPosition(next);
    startClock.current = performance.now() - next * 1000;
    if (next >= plan.duration) setPlaying(false);
  };

  const jumpToShot = (start: number) => {
    // A deliberate jump pauses playback. Use the same bounded seek path
    // as the slider, so resume begins at the exact selected scene cut.
    setPlaying(false);
    seek(start);
  };

  const toggle = () => {
    if (disabled) return;
    if (playing) {
      setPlaying(false);
      return;
    }
    const resume = position >= plan.duration ? 0 : position;
    startClock.current = performance.now() - resume * 1000;
    setPosition(resume);
    setPlaying(true);
  };

  return (
    <section className="studio-story-reel" aria-label="Play full storyboard">
      <h4>Watch your shots in order</h4>
      <p className="field-hint">
        This is a local silent preview of the original PNG frames, not a recorded
        WebM. It follows the current shot order, frame speed, cuts and ending holds.
      </p>
      <div className="studio-reel-screen">
        <LocalFrameImage key={frame.frame.name} file={frame.frame}
          alt={`Story reel shot ${frame.shotIndex + 1}: frame ${frame.frameIndex + 1} of ${plan.shots[frame.shotIndex].files.length}, ${frame.frame.name}`} />
      </div>
      {beats && (
        <div className="studio-reel-subtitle-draft" data-subtitle-draft="true">
          <strong>Written subtitle preview · not synchronized to recorded speech</strong>
          <p>{draftSubtitle || "No written narration for this shot."}</p>
        </div>
      )}
      <p className="field-hint" data-reel-frame-status="true"
        aria-live={playing ? "off" : "polite"}>
        Shot {frame.shotIndex + 1}/{plan.shots.length} · {frame.prefix} ·
        frame {frame.frameIndex + 1}/{plan.shots[frame.shotIndex].files.length}
        {frame.holding ? " · holding final frame" : ""}
      </p>
      <StoryReelShotNavigation plan={plan} position={position}
        activeIndex={frame.shotIndex} disabled={disabled} onJump={jumpToShot} />
      <label className="studio-frame-scrubber">
        Seek full storyboard (seconds)
        <input aria-label="Seek full storyboard" type="range" min={0}
          max={plan.duration} step="0.05" value={position}
          disabled={disabled}
          onChange={event => seek(Number(event.target.value))} />
      </label>
      <div className="studio-reel-actions">
        <button type="button" className="button secondary small"
          onClick={toggle} disabled={disabled}
          aria-label={playing ? "Pause storyboard" : "Play storyboard"}>
          {playing ? "Pause" : position >= plan.duration ? "Replay" : "Play"}
        </button>
        <button type="button" className="button secondary small"
          onClick={() => { setPlaying(false); seek(0); }}
          disabled={disabled || (!playing && position === 0)}
          aria-label="Restart storyboard">Restart</button>
        <span className="field-hint" data-reel-clock="true">
          {position.toFixed(2)} / {plan.duration.toFixed(2)} seconds
        </span>
      </div>
    </section>
  );
}
