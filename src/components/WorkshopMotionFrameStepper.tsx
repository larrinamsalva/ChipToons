import { useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import {
  WORKSHOP_INSPECTION_FPS,
  workshopMotionInspectionFrame,
} from "../workshop-motion-frame-stepper";
import { workshopAdjacentFramePair } from "../workshop-adjacent-frame-compare";
import { workshopAdjacentJointReview } from "../workshop-adjacent-joint-review";
import { WorkshopJointMotionCurveReview } from "./WorkshopJointMotionCurveReview";
import { WorkshopFootTravelReview } from "./WorkshopFootTravelReview";
import { workshopJointReview } from "../workshop-joint-review-filter";
import type { WorkshopJointGroup } from "../workshop-joint-review-filter";
import { Stage } from "./Stage";

/** Read-only one-frame-at-a-time inspection of existing Stage interpolation. */
export function WorkshopMotionFrameStepper({
  project, scene, actorId, step,
}: {
  project: Project;
  scene: Scene;
  actorId: string;
  step: WorkshopMotionStep;
}) {
  const [opened, setOpened] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [jointInspecting, setJointInspecting] = useState(false);
  const [jointGroup, setJointGroup] = useState<WorkshopJointGroup>("all");
  const sample = workshopMotionInspectionFrame(scene, actorId, step, frameIndex);
  const neighboring = comparing
    ? workshopAdjacentFramePair(scene, actorId, step, frameIndex)
    : undefined;
  const jointChanges = comparing && jointInspecting && neighboring
    ? workshopAdjacentJointReview(project, scene, actorId, step, frameIndex)
    : undefined;
  const jointView = jointChanges
    ? workshopJointReview(jointChanges.changes, jointGroup, "rotation")
    : undefined;

  return (
    <section className="workshop-motion-frame-stepper" aria-label="Motion frame-by-frame inspector">
      <button
        type="button"
        className="button secondary small"
        aria-expanded={opened}
        onClick={() => setOpened(value => !value)}
      >
        {opened ? "Close Frame by Frame" : "Review Frame by Frame"}
      </button>
      {opened && sample && (
        <>
          <p className="field-hint">
            Check the original cartoon movement one precise 24-fps inspection
            step at a time. This does not create a new keyframe or affect
            recording, the main playhead, the motion loop, or movie exports.
          </p>
          <div className="workshop-motion-frame-stepper-controls">
            <button type="button" className="button secondary small"
              disabled={sample.index === 0}
              onClick={() => setFrameIndex(0)}>First Frame</button>
            <button type="button" className="button secondary small"
              disabled={sample.index === 0}
              onClick={() => setFrameIndex(index => index - 1)}>Previous Frame</button>
            <button type="button" className="button secondary small"
              disabled={sample.index === sample.lastIndex}
              onClick={() => setFrameIndex(index => index + 1)}>Next Frame</button>
            <button type="button" className="button secondary small"
              disabled={sample.index === sample.lastIndex}
              onClick={() => setFrameIndex(sample.lastIndex)}>Last Frame</button>
          </div>
          <output className="workshop-motion-frame-stepper-status"
            aria-label="Frame-by-frame inspection status" aria-live="polite">
            Frame {sample.index + 1} of {sample.lastIndex + 1}
            {" · "}{sample.seconds.toFixed(3)}s
            {" · "}{sample.savedKeyframe
              ? "Original saved keyframe"
              : "Real interpolated Stage sample"}
          </output>
          <button
            className="button secondary small"
            type="button"
            aria-pressed={comparing}
            onClick={() => setComparing(value => !value)}
          >
            {comparing ? "Show Single Frame" : "Compare Adjacent Frames"}
          </button>
          {comparing && neighboring ? (
            <div className="workshop-motion-adjacent-comparison"
              aria-label="Adjacent original Stage frames comparison">
              {([
                { label: "Before", frame: neighboring.before },
                { label: "After", frame: neighboring.after },
              ] as const).map(({ label, frame }) => (
                <figure className="workshop-motion-adjacent-card"
                  key={label}
                  aria-label={`${label} adjacent original Stage frame`}>
                  <div className="workshop-motion-adjacent-picture">
                    <Stage project={project} scene={scene}
                      time={frame.seconds} labelled={false} />
                  </div>
                  <figcaption>
                    <strong>{label} — Frame {frame.index + 1}</strong>
                    <span>{frame.seconds.toFixed(3)}s · {frame.savedKeyframe
                      ? "Original saved keyframe"
                      : "Real interpolated Stage sample"}</span>
                  </figcaption>
                </figure>
              ))}
              <p className="field-hint workshop-motion-adjacent-spacing"
                role="status">
                Comparing adjacent original timeline samples
                {" · "}{neighboring.spacingSeconds.toFixed(3)}s apart.
                This is a visual comparison, not a movement-quality score.
              </p>
              <section className="workshop-motion-adjacent-joints"
                aria-label="Adjacent frame joint movement review">
                <button type="button" className="button secondary small"
                  aria-expanded={jointInspecting}
                  onClick={() => setJointInspecting(value => !value)}>
                  {jointInspecting
                    ? "Close Adjacent Joint Changes"
                    : "Inspect Adjacent Joint Changes"}
                </button>
                {jointInspecting && jointChanges && jointView && (
                  <>
                    <p className="field-hint">
                      Actual local joint angles and offsets sampled from the
                      two rendered Stage frames. These measurements do not
                      detect ground contact, collisions or animation quality.
                    </p>
                    <label>
                      Adjacent joint body filter
                      <select aria-label="Adjacent joint body filter"
                        value={jointGroup}
                        onChange={event =>
                          setJointGroup(event.target.value as WorkshopJointGroup)}>
                        <option value="all">All body parts</option>
                        <option value="arms">Arms and hands</option>
                        <option value="legs">Legs and feet</option>
                        <option value="body">Head and body</option>
                      </select>
                    </label>
                    <p className="field-hint" role="status">
                      Showing {jointView.rows.length} of {jointChanges.changes.length}
                      {" "}changed local joints between
                      {" "}{jointChanges.beforeSeconds.toFixed(3)}s and
                      {" "}{jointChanges.afterSeconds.toFixed(3)}s.
                      Largest angular change appears first.
                    </p>
                    {jointView.rows.length ? (
                      <div className="workshop-motion-adjacent-joints-scroll">
                        <table aria-label="Adjacent frame joint changes">
                          <thead>
                            <tr>
                              <th scope="col">Joint</th>
                              <th scope="col">Before °</th>
                              <th scope="col">After °</th>
                              <th scope="col">Change °</th>
                              <th scope="col">Offset Δ px</th>
                            </tr>
                          </thead>
                          <tbody>
                            {jointView.rows.map(change => (
                              <tr key={change.partId}
                                data-largest-rotation={
                                  change.partId === jointView.largestRotationPartId
                                    ? "true" : undefined}>
                                <th scope="row">{change.label}</th>
                                <td>{change.beforeAngle.toFixed(2)}</td>
                                <td>{change.afterAngle.toFixed(2)}</td>
                                <td>{change.angleDelta > 0 ? "+" : ""}
                                  {change.angleDelta.toFixed(2)}</td>
                                <td>{change.xDelta.toFixed(2)},
                                  {" "}{change.yDelta.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="field-hint" role="status">
                        No measurable local joint changes in this body group
                        between these two samples. Try another filter.
                      </p>
                    )}
                    <WorkshopJointMotionCurveReview
                      project={project}
                      scene={scene}
                      actorId={actorId}
                      step={step}
                      selectedIndex={frameIndex}
                      onSelectFrame={setFrameIndex}
                    />
                  </>
                )}
              </section>
              <WorkshopFootTravelReview
                project={project} scene={scene} actorId={actorId}
                step={step} selectedIndex={frameIndex} onSelectFrame={setFrameIndex} />
            </div>
          ) : (
            <div className="workshop-motion-frame-stepper-stage"
              aria-label="Inspected original Stage frame">
              <Stage project={project} scene={scene}
                time={sample.seconds} labelled={false} />
            </div>
          )}
          <p className="field-hint">
            {WORKSHOP_INSPECTION_FPS} frames per second is an inspection
            spacing, not a change to your project's export settings.
            Both original saved endpoints remain included.
          </p>
        </>
      )}
    </section>
  );
}
