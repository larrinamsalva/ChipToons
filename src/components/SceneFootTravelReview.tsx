import { useState } from "react";
import type { Project, Scene, SceneGroundPoint } from "../model";
import { validGroundSlope } from "../model";
import { sceneFootGroundPointAt, sceneGroundYAt, sceneFootTravel } from "../scene-foot-travel";
import type { FootSide } from "../workshop-foot-travel";
import { alignPuppetFootFrame, holdPuppetFootForFrames } from "../scene-foot-fix";

/** A creator can inspect saved motion without changing any keys or media. */
export function SceneFootTravelReview({ project, scene, actorId, time, onSeek, onApply, onGroundChange }: {
  project: Project; scene: Scene; actorId: string; time: number;
  onSeek: (seconds: number) => void;
  onApply: (next: Scene) => boolean;
  onGroundChange: (y: number | undefined, points?: SceneGroundPoint[]) => boolean;
}) {
  const [opened, setOpened] = useState(false);
  const [side, setSide] = useState<FootSide>("right");
  const [startAt, setStartAt] = useState(0);
  const [holdFrames, setHoldFrames] = useState(3);
  const [message, setMessage] = useState("");
  const review = opened ? sceneFootTravel(project, scene, actorId, startAt, side) : undefined;
  const currentSole = opened ? sceneFootGroundPointAt(project, scene, actorId, time, side) : undefined;
  const firstGroundPoint = scene.footGroundPoints?.[0];
  const canSetSlope = !!firstGroundPoint && !!currentSole &&
    validGroundSlope(firstGroundPoint, currentSole);
  const actor = scene.elements.find(item => item.id === actorId);
  const editable = actor?.motion === "still" && actor.animation?.idle === "none" &&
    (actor.animation.keyframes.length ?? 0) >= 2;
  const selected = review?.points.findIndex(point => point.seconds + 0.0005 >= time) ?? -1;
  const after = review && time >= review.start && time <= review.end
    ? review.points[Math.max(1, selected)] : undefined;
  const before = after && review?.points[after.index - 1];
  const afterGroundY = after && sceneGroundYAt(scene, after.x);

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
          {" · "}{review.possibleSlides.length} possible near-floor travel intervals
          {" · "}{review.possibleDepth.length} possible below-neutral intervals.
        </output>
        <div className="assistant-fields" aria-label="Scene ground reference controls">
          <p className="field-hint">Pause where a foot touches the floor and set the first point. This makes a flat guide. For a gentle slope, move to another grounded frame at least 80 Stage pixels sideways and set the second point. The guide is shared by all feet in this scene.</p>
          <button type="button" className="button secondary small" disabled={!currentSole}
            onClick={() => {
              if (currentSole && onGroundChange(currentSole.y, [currentSole]))
                setMessage(`Saved flat scene ground at Stage Y ${currentSole.y.toFixed(1)}. Undo restores the previous guide.`);
            }}>Set Scene Ground From This Foot</button>
          {scene.footGroundY !== undefined && <>
            <p role="status" className="field-hint">Scene ground guide: Stage Y {scene.footGroundY.toFixed(1)}{scene.footGroundPoints?.length === 2 &&
              <> at X {scene.footGroundPoints[0].x.toFixed(1)} → Y {scene.footGroundPoints[1].y.toFixed(1)} at X {scene.footGroundPoints[1].x.toFixed(1)} (between points only)</>}.
              Editor preview only; hidden while playing and absent from exported video.</p>
            {firstGroundPoint && <>
              <button type="button" className="button secondary small" disabled={!canSetSlope}
                onClick={() => {
                  if (currentSole && canSetSlope && onGroundChange(firstGroundPoint.y, [firstGroundPoint, currentSole]))
                    setMessage("Saved a sloped ground guide between two planted points. Undo restores the previous guide.");
                }}>Set Second Slope Point From This Foot</button>
              {!canSetSlope && <p className="field-hint">The second point needs to be visible, at least 80 Stage pixels sideways, with a gentle slope (no more than 1 pixel up or down per 2 sideways).</p>}
            </>}
            {!firstGroundPoint && <p className="field-hint">This older flat guide has no first X position. Set the first point again to add a slope.</p>}
            <button type="button" className="button secondary small"
              onClick={() => { if (onGroundChange(undefined, undefined)) setMessage("Scene ground guide removed. Undo restores it."); }}>
              Clear Scene Ground Guide
            </button>
          </>}
          {!currentSole && <p className="field-hint">This sole is outside the Stage or unavailable at the playhead. Choose a visible grounded frame.</p>}
        </div>
        {review.paintedFoot && <p className="field-hint">{review.markedSole
          ? "Using your painted foot's marked sole point. Check the Stage if the picture or shoe shape changes."
          : "The estimated sole is the bottom center of the foot's image box. Transparent padding or an unusual shoe shape can move the visible contact point. Mark the sole in Puppet Maker for a closer estimate."}</p>}
        {before && after && <p role="status" className="field-hint">
          Samples {before.index + 1}–{after.index + 1}
          {" · "}sole X {before.x.toFixed(1)} → {after.x.toFixed(1)} stage pixels
          {" · "}sole Y {before.y.toFixed(1)} → {after.y.toFixed(1)}
          {" · "}estimated floor gap {after.floorGap.toFixed(1)} pixels.
          {afterGroundY !== undefined && <> {" · "}saved ground difference {(afterGroundY - after.y).toFixed(1)} pixels (positive above guide).</>}
          {scene.footGroundPoints?.length === 2 && afterGroundY === undefined && <> {" · "}outside saved ground span.</>}
        </p>}
        <p className="field-hint">The floor estimate follows the character's neutral feet, not the scenery. Inspect the main Stage at each suggested time for actual ground contact or overlap.</p>
        {scene.footGroundY !== undefined && <>
          <p className="field-hint">{review.possibleGroundDepth.length} possible below-guide intervals in this three-second window. {scene.footGroundPoints?.length === 2
            ? "The two-point guide covers only its saved X span; samples outside it are not compared."
            : "The flat guide covers the Stage."} Jump to a frame and inspect the artwork; camera motion, jumps, perspective and intentional overlap can make this manual guide inaccurate.</p>
          {review.possibleGroundDepth.length > 0 && <ol aria-label="Character below-scene-ground intervals">
            {review.possibleGroundDepth.map(item => <li key={item.startIndex}>
              {item.seconds.toFixed(3)}s · {item.depthPixels.toFixed(1)} stage pixels below saved guide
              {" · "}frames {item.startIndex + 1}–{item.endIndex + 1}{" "}
              <button type="button" className="button secondary small"
                onClick={() => onSeek(item.seconds)}>
                Show Below-Ground-Guide Frame {item.peakIndex + 1}
              </button>
            </li>)}
          </ol>}
        </>}
        {review.possibleDepth.length > 0 && <>
          <p className="field-hint">These poses put the selected sole at least four stage pixels below its neutral-pose baseline. They may be intentional. This does not measure the scenery or prove a collision.</p>
          <ol aria-label="Character below-neutral foot intervals">
            {review.possibleDepth.map(item => <li key={item.startIndex}>
              {item.seconds.toFixed(3)}s · {item.depthPixels.toFixed(1)} stage pixels below neutral
              {" · "}frames {item.startIndex + 1}–{item.endIndex + 1}{" "}
              <button type="button" className="button secondary small"
                onClick={() => onSeek(item.seconds)}>
                Show Below-Baseline Frame {item.peakIndex + 1}
              </button>
            </li>)}
          </ol>
        </>}
        <p className="field-hint">
          You can hold a puppet foot at a suggested frame when this movement has editable timeline keys.
          The change adds one foot key within a linear motion interval, up to 12 stage pixels,
          and can affect nearby frames. Timed gestures, talking cycles and authored keys need manual editing.
          Preview the whole step afterward. Undo restores the original movement.
        </p>
        <label>Foot hold length
          <select aria-label="Foot hold length" value={holdFrames}
            onChange={event => { setHoldFrames(Number(event.target.value)); setMessage(""); }}>
            {[2, 3, 4, 5, 6].map(count => <option key={count} value={count}>{count} frames</option>)}
          </select>
          <span className="field-hint">One Undo step. Longer holds may be refused if a shoe would move more than 12 stage pixels.</span>
        </label>
        {message && <p role="status" className="field-hint">{message}</p>}
        {review.possibleSlides.length ? <ol aria-label="Character near-floor travel intervals">
          {review.possibleSlides.map(item => <li key={item.afterIndex}>
            {item.seconds.toFixed(3)}s · {item.horizontalPixels.toFixed(1)} stage pixels sideways{" "}
            <button type="button" className="button secondary small"
              onClick={() => onSeek(item.seconds)}>
              Show Foot Frame {item.afterIndex + 1}
            </button>
            <button type="button" className="button secondary small"
              disabled={!editable}
              onClick={() => {
                const next = alignPuppetFootFrame(
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
            </button>
            <button type="button" className="button secondary small"
                disabled={!editable || item.afterIndex + holdFrames - 1 >= review.points.length}
                onClick={() => {
                  const next = holdPuppetFootForFrames(
                    project, scene, actorId, review.start, side, item.afterIndex, holdFrames,
                  );
                  if (!next || !onApply(next)) {
                    setMessage("This foot hold could not be safely made. Try fewer frames, another suggested frame, or adjust the timeline keys.");
                    return;
                  }
                  setMessage(`Held this ${side} foot for ${holdFrames} reviewed frames from ${item.seconds.toFixed(3)}s. Preview the full step; Undo restores it.`);
                  onSeek(review.points[item.afterIndex + holdFrames - 1].seconds);
                }}>
                Hold {side} Foot for {holdFrames} Frames from Frame {item.afterIndex + 1}
            </button>
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
