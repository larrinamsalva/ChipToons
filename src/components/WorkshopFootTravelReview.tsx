import { useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import { workshopAdjacentFramePair } from "../workshop-adjacent-frame-compare";
import { workshopFootTravel } from "../workshop-foot-travel";
import type { FootSide } from "../workshop-foot-travel";

/** Optional Stage-space measurement; it never rewrites a walk or a keyframe. */
export function WorkshopFootTravelReview({ project, scene, actorId, step, selectedIndex, onSelectFrame }: {
  project: Project;
  scene: Scene;
  actorId: string;
  step: WorkshopMotionStep;
  selectedIndex: number;
  onSelectFrame: (index: number) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [side, setSide] = useState<FootSide>("right");
  const review = opened ? workshopFootTravel(project, scene, actorId, step, side) : undefined;
  const pair = review ? workshopAdjacentFramePair(scene, actorId, step, selectedIndex) : undefined;
  const before = pair && review?.points[pair.before.index];
  const after = pair && review?.points[pair.after.index];

  return <section className="workshop-joint-motion-curve" aria-label="Foot travel review">
    <button type="button" className="button secondary small" aria-expanded={opened}
      onClick={() => setOpened(value => !value)}>
      {opened ? "Close Foot Travel" : "Review Foot Travel"}
    </button>
    {opened && <>
      <p className="field-hint">Measure the visible sole position at each original Stage sample in this saved movement. A foot moving sideways while near its rig’s estimated floor line is a place to inspect, not proof of a physical collision or a bad step. No animation is changed.</p>
      <label>Foot to review
        <select aria-label="Foot to review" value={side}
          onChange={event => setSide(event.target.value as FootSide)}>
          <option value="left">Left foot</option>
          <option value="right">Right foot</option>
        </select>
      </label>
      {review ? <>
        <output className="workshop-joint-motion-curve-summary" aria-label="Foot travel summary">
          {side === "left" ? "Left" : "Right"} foot: {review.points.length} real Stage samples
          {" · "}{review.possibleSlides.length} possible near-floor travel intervals shown.
        </output>
        {before && after && <p role="status" className="field-hint">
          Frames {before.index + 1} to {after.index + 1}
          {" · "}sole X {before.x.toFixed(1)} → {after.x.toFixed(1)} stage pixels
          {" · "}sole Y {before.y.toFixed(1)} → {after.y.toFixed(1)}
          {" · "}estimated floor gap {after.floorGap.toFixed(1)} pixels.
        </p>}
        {review.possibleSlides.length > 0 ? <div className="workshop-rotation-change-finder">
          <p className="field-hint">Largest measured intervals with at least 1.5 pixels of sideways travel while both soles remain within 4 pixels of the neutral rig floor estimate. Review the original adjacent Stage frames before editing.</p>
          <ol aria-label="Possible planted-foot travel intervals">
            {review.possibleSlides.map(item => <li key={item.afterIndex}>
              <span>Frames {item.beforeIndex + 1}–{item.afterIndex + 1}
                {" · "}{item.seconds.toFixed(3)}s
                {" · "}{item.horizontalPixels.toFixed(1)} stage pixels sideways</span>
              <button type="button" className="button secondary small"
                onClick={() => onSelectFrame(item.afterIndex)}>
                Review Foot Frames {item.beforeIndex + 1}–{item.afterIndex + 1}
              </button>
            </li>)}
          </ol>
        </div> : <p role="status" className="field-hint">
          No near-floor sideways interval crossed this review threshold. Inspect the feet visually; this is not a guarantee of floor contact.
        </p>}
      </> : <p role="status" className="field-hint">
        This saved step needs separate, parented vector left and right foot parts for sole measurements.
      </p>}
    </>}
  </section>;
}
