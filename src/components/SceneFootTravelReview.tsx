import { useState } from "react";
import type { Project, Scene } from "../model";
import { sceneFootTravel } from "../scene-foot-travel";
import type { FootSide } from "../workshop-foot-travel";
import { alignPictureFootFrame } from "../scene-foot-fix";

/** A creator can inspect saved motion without changing any keys or media. */
export function SceneFootTravelReview({ project, scene, actorId, time, onSeek, onApply }: {
  project: Project; scene: Scene; actorId: string; time: number;
  onSeek: (seconds: number) => void;
  onApply: (next: Scene) => boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [side, setSide] = useState<FootSide>("right");
  const [startAt, setStartAt] = useState(0);
  const [message, setMessage] = useState("");
  const review = opened ? sceneFootTravel(project, scene, actorId, startAt, side) : undefined;
  const actor = scene.elements.find(item => item.id === actorId);
  const editable = actor?.motion === "still" && actor.animation?.idle === "none" &&
    (actor.animation.keyframes.length ?? 0) >= 2;
  const selected = review?.points.findIndex(point => point.seconds + 0.0005 >= time) ?? -1;
  const after = review && time >= review.start && time <= review.end
    ? review.points[Math.max(1, selected)] : undefined;
  const before = after && review?.points[after.index - 1];

  return <section className="workshop-joint-motion-curve" aria-label="Character foot travel review">
    <button type="button" className="button secondary small" aria-expanded={opened}
      onClick={() => { if (!opened) setStartAt(time); setOpened(!opened); }}>
      {opened ? "Close Character Foot Review" : "Review Character Feet"}
    </button>
    {opened && <>
      <p className="field-hint">Inspect up to three seconds of the selected character's real Stage motion at 24 samples per second. A near-floor sideways finding asks you to check the frames; it does not prove a slip or change the cartoon.</p>
      <label>Foot to review
        <select aria-label="Character foot to review" value={side}
          onChange={event => setSide(event.target.value as FootSide)}>
          <option value="left">Left foot</option>
          <option value="right">Right foot</option>
        </select>
      </label>
      <button type="button" className="button secondary small" onClick={() => setStartAt(time)}>
        Review From Current Frame
      </button>
      {review ? <>
        <output className="workshop-joint-motion-curve-summary" aria-label="Character foot summary">
          {side === "left" ? "Left" : "Right"} foot: {review.points.length} Stage samples
          {" · "}{review.start.toFixed(2)}–{review.end.toFixed(2)}s
          {" · "}{review.possibleSlides.length} possible near-floor travel intervals.
        </output>
        {review.paintedFoot && <p className="field-hint">{review.markedSole
          ? "Using your painted foot's marked sole point. Check the Stage if the picture or shoe shape changes."
          : "The estimated sole is the bottom center of the foot's image box. Transparent padding or an unusual shoe shape can move the visible contact point. Mark the sole in Puppet Maker for a closer estimate."}</p>}
        {before && after && <p role="status" className="field-hint">
          Samples {before.index + 1}–{after.index + 1}
          {" · "}sole X {before.x.toFixed(1)} → {after.x.toFixed(1)} stage pixels
          {" · "}sole Y {before.y.toFixed(1)} → {after.y.toFixed(1)}
          {" · "}estimated floor gap {after.floorGap.toFixed(1)} pixels.
        </p>}
        <p className="field-hint">The floor estimate follows the character's neutral feet, not the scenery. Inspect the main Stage at each suggested time for actual ground contact or overlap.</p>
        {review.paintedFoot && <p className="field-hint">
          You can hold one picture foot at a suggested frame when this movement has editable timeline keys.
          The change adds one foot key within a linear motion interval, up to 12 stage pixels,
          and can affect nearby frames. Timed gestures, talking cycles and authored keys need manual editing.
          Preview the whole step afterward. Undo restores the original movement.
        </p>}
        {message && <p role="status" className="field-hint">{message}</p>}
        {review.possibleSlides.length ? <ol aria-label="Character near-floor travel intervals">
          {review.possibleSlides.map(item => <li key={item.afterIndex}>
            {item.seconds.toFixed(3)}s · {item.horizontalPixels.toFixed(1)} stage pixels sideways{" "}
            <button type="button" className="button secondary small"
              onClick={() => onSeek(item.seconds)}>
              Show Foot Frame {item.afterIndex + 1}
            </button>
            {review.paintedFoot && <button type="button" className="button secondary small"
              disabled={!editable}
              onClick={() => {
                const next = alignPictureFootFrame(
                  project, scene, actorId, review.start, side, item.afterIndex,
                );
                if (!next || !onApply(next)) {
                  setMessage("This frame could not be safely aligned. Try another suggested frame or adjust its timeline key.");
                  return;
                }
                setMessage(`Aligned this ${side} foot at ${item.seconds.toFixed(3)}s. Preview nearby frames; Undo restores the original movement.`);
                onSeek(item.seconds);
              }}>
              Hold {side} Foot at Frame {item.afterIndex + 1}
            </button>}
          </li>)}
        </ol> : <p role="status" className="field-hint">
          No interval crossed this review threshold. Check the Stage visually; contact is not guaranteed.
        </p>}
      </> : <p role="status" className="field-hint">
        This character needs separate left and right foot parts, each attached to a parent joint. Upside-down characters are not supported by this review.
      </p>}
    </>}
  </section>;
}
