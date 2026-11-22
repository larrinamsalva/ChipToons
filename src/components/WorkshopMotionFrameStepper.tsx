import { useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import {
  WORKSHOP_INSPECTION_FPS,
  workshopMotionInspectionFrame,
} from "../workshop-motion-frame-stepper";
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
  const sample = workshopMotionInspectionFrame(scene, actorId, step, frameIndex);

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
          <div className="workshop-motion-frame-stepper-stage"
            aria-label="Inspected original Stage frame">
            <Stage project={project} scene={scene}
              time={sample.seconds} labelled={false} />
          </div>
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
