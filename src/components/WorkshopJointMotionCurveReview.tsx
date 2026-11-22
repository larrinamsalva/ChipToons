import { useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import { resolvedCharacter } from "../library";
import { workshopAdjacentFramePair } from "../workshop-adjacent-frame-compare";
import { workshopJointMotionCurve } from "../workshop-joint-motion-curve";
import { workshopJointRotationRates } from "../workshop-joint-rotation-rate";
import { workshopLargestRotationRateChanges } from "../workshop-rate-change-finder";
import { workshopMotionTransitionTriplet } from "../workshop-motion-transition-triplet";
import { Stage } from "./Stage";

/** A compact opt-in graph of actual Stage joint rotations, not a pose editor. */
export function WorkshopJointMotionCurveReview({
  project, scene, actorId, step, selectedIndex, onSelectFrame,
}: {
  project: Project;
  scene: Scene;
  actorId: string;
  step: WorkshopMotionStep;
  selectedIndex: number;
  onSelectFrame: (index: number) => void;
}) {
  const [opened, setOpened] = useState(false);
  const [partId, setPartId] = useState("");
  const [reviewRates, setReviewRates] = useState(false);
  const [reviewChanges, setReviewChanges] = useState(false);
  const [selectedTransitionIndex, setSelectedTransitionIndex] = useState<number | null>(null);
  const actor = scene.elements.find(element => element.id === actorId);
  const parts = actor ? resolvedCharacter(project, actor)?.puppet?.parts ?? [] : [];
  const chosenPartId = parts.some(part => part.id === partId)
    ? partId : parts.find(part => part.role === "rightArm")?.id ?? parts[0]?.id ?? "";
  // Read-only graph only samples Stage while explicitly open. Avoid
  // manual memoization across mutable scene/project references: the React
  // Compiler rightly cannot guarantee that those dependencies stay stable.
  const curve = opened && chosenPartId
    ? workshopJointMotionCurve(project, scene, actorId, step, chosenPartId)
    : undefined;
  const pair = opened ? workshopAdjacentFramePair(scene, actorId, step, selectedIndex) : undefined;
  const rates = opened && reviewRates ? workshopJointRotationRates(curve) : undefined;
  const changes = opened && reviewRates && reviewChanges
    ? workshopLargestRotationRateChanges(rates) : undefined;
  const selectedTransition = changes?.largest.find(
    change => change.sharedFrameIndex === selectedTransitionIndex);
  const transition = selectedTransition
    ? workshopMotionTransitionTriplet(scene, actorId, step, selectedTransition)
    : undefined;

  const width = 600;
  const height = 144;
  const insetX = 24;
  const insetY = 18;
  const plotWidth = width - insetX * 2;
  const plotHeight = height - insetY * 2;
  const bottom = height - insetY;
  const low = curve?.minAngle ?? 0;
  const high = curve?.maxAngle ?? 0;
  const range = Math.max(1, high - low);
  const xAt = (index: number, last: number) =>
    insetX + plotWidth * index / Math.max(1, last);
  const yAt = (angle: number) => bottom -
    (angle - low) / range * plotHeight;
  const lastIndex = (curve?.points.length ?? 1) - 1;
  const linePoints = curve?.points.map(point =>
    `${xAt(point.index, lastIndex).toFixed(2)},${yAt(point.angle).toFixed(2)}`,
  ).join(" ") ?? "";
  const zeroRateY = height / 2;
  const rateAtY = (degreesPerSecond: number) =>
    zeroRateY - degreesPerSecond / Math.max(1, rates?.maxAbsoluteRate ?? 1) * (plotHeight / 2);
  const rateLinePoints = rates?.intervals.map(item =>
    `${xAt(item.afterIndex, lastIndex).toFixed(2)},${rateAtY(item.degreesPerSecond).toFixed(2)}`,
  ).join(" ") ?? "";

  return (
    <section className="workshop-joint-motion-curve"
      aria-label="Joint rotation curve review">
      <button type="button" className="button secondary small"
        aria-expanded={opened} onClick={() => setOpened(value => !value)}>
        {opened ? "Close Movement Curve" : "Review Movement Curve"}
      </button>
      {opened && (
        <>
          <p className="field-hint">
            Inspect one original puppet joint's angle throughout this saved
            movement. The line samples the real Stage every 1/24 second;
            vertical markers show the two frames currently compared.
            Nothing is edited or re-exported.
          </p>
          <label>
            Movement curve joint
            <select aria-label="Movement curve joint"
              value={chosenPartId}
              onChange={event => {
                setPartId(event.target.value);
                setSelectedTransitionIndex(null);
              }}>
              {parts.map(part => (
                <option key={part.id} value={part.id}>
                  {part.role.replace(/([a-z])([A-Z])/g, "$1 $2")}
                </option>
              ))}
            </select>
          </label>
          {curve ? (
            <>
              <div className="workshop-joint-motion-curve-picture">
                <svg viewBox={`0 0 ${width} ${height}`} role="img"
                  aria-label={`${curve.label} original local rotation from ${curve.points[0].seconds.toFixed(3)} to ${curve.points[lastIndex].seconds.toFixed(3)} seconds`}>
                  <line className="workshop-joint-motion-curve-axis"
                    x1={insetX} y1={bottom} x2={width - insetX} y2={bottom} />
                  <line className="workshop-joint-motion-curve-axis"
                    x1={insetX} y1={insetY} x2={insetX} y2={bottom} />
                  <polyline className="workshop-joint-motion-curve-line"
                    fill="none" strokeWidth={2.5} points={linePoints} />
                  {pair && [pair.before, pair.after].map((frame, idx) => {
                    const point = curve.points[frame.index];
                    return point ? (
                      <g key={idx}>
                        <line className="workshop-joint-motion-curve-marker"
                          x1={xAt(frame.index, lastIndex)} y1={insetY}
                          x2={xAt(frame.index, lastIndex)} y2={bottom}
                          strokeWidth={1.8} strokeDasharray={idx ? "4 3" : "2 4"} />
                        <circle className="workshop-joint-motion-curve-dot"
                          cx={xAt(frame.index, lastIndex)}
                          cy={yAt(point.angle)} r={4} />
                      </g>
                    ) : null;
                  })}
                </svg>
              </div>
              <output className="workshop-joint-motion-curve-summary"
                aria-label="Joint rotation curve summary">
                {curve.label}: {curve.points.length} real Stage samples
                {" · "}min {low.toFixed(2)}°
                {" · "}max {high.toFixed(2)}°
                {" · "}start {curve.points[0].angle.toFixed(2)}°
                {" · "}end {curve.points[lastIndex].angle.toFixed(2)}°
              </output>
              <button type="button" className="button secondary small"
                aria-expanded={reviewRates} onClick={() => setReviewRates(value => !value)}>
                {reviewRates ? "Close Rotation Speed" : "Review Rotation Speed"}
              </button>
              {reviewRates && rates && (
                <section aria-label="Local joint rotation speed review"
                  className="workshop-joint-rotation-rate">
                  <p className="field-hint">
                    Signed local angle change in degrees per second, measured
                    between real neighboring Stage samples. Positive and negative
                    values indicate rotation direction, not how fast the
                    character walks or whether any foot is sliding.
                  </p>
                  <div className="workshop-joint-motion-curve-picture">
                    <svg viewBox={`0 0 ${width} ${height}`} role="img"
                      aria-label={`${rates.label} signed local rotation rate across ${rates.intervals.length} Stage intervals`}>
                      <line className="workshop-joint-motion-curve-axis"
                        x1={insetX} y1={zeroRateY}
                        x2={width - insetX} y2={zeroRateY} />
                      <polyline className="workshop-joint-motion-curve-line"
                        fill="none" strokeWidth={2.5} points={rateLinePoints} />
                      {pair && (() => {
                        const interval = rates.intervals[pair.after.index - 1];
                        return interval ? (
                          <g>
                            <line className="workshop-joint-motion-curve-marker"
                              x1={xAt(interval.afterIndex, lastIndex)} y1={insetY}
                              x2={xAt(interval.afterIndex, lastIndex)} y2={bottom}
                              strokeWidth={1.8} strokeDasharray="4 3" />
                            <circle className="workshop-joint-motion-curve-dot"
                              cx={xAt(interval.afterIndex, lastIndex)}
                              cy={rateAtY(interval.degreesPerSecond)} r={4} />
                          </g>
                        ) : null;
                      })()}
                    </svg>
                  </div>
                  <output aria-label="Rotation rate summary"
                    className="workshop-joint-motion-curve-summary">
                    {rates.label}: {rates.intervals.length} measured intervals
                    {" · "}minimum {rates.minRate.toFixed(2)}°/s
                    {" · "}maximum {rates.maxRate.toFixed(2)}°/s
                    {" · "}peak absolute {rates.maxAbsoluteRate.toFixed(2)}°/s
                  </output>
                  <button type="button" className="button secondary small"
                    aria-expanded={reviewChanges}
                    onClick={() => setReviewChanges(value => !value)}>
                    {reviewChanges ? "Close Rotation Change Finder" : "Find Largest Rotation Changes"}
                  </button>
                  {reviewChanges && changes && (
                    <section aria-label="Rotation speed change finder"
                      className="workshop-rotation-change-finder">
                      <p className="field-hint">
                        These are the largest measured changes in local joint
                        rotation rate between neighboring Stage intervals.
                        A big number may be intentional. Choose any result
                        to inspect its original adjacent frames—no keyframes
                        or recorded motions are edited.
                      </p>
                      <output aria-label="Rotation change findings count">
                        {changes.totalChanges} measured rate changes
                        {" · "}showing the largest {changes.largest.length}.
                      </output>
                      <ol aria-label="Largest local joint rotation rate changes">
                        {changes.largest.map(change => (
                          <li key={change.sharedFrameIndex}>
                            <span>
                              Frame {change.sharedFrameIndex + 1}
                              {" · "}{change.seconds.toFixed(3)}s
                              {" · "}{change.degreesPerSecondSquared.toFixed(2)}°/s²
                            </span>
                            <button type="button" className="button secondary small"
                              onClick={() => onSelectFrame(change.afterFrameIndex)}>
                              Review Frames {change.sharedFrameIndex + 1}–
                              {change.afterFrameIndex + 1}
                            </button>
                            <button type="button" className="button secondary small"
                              aria-pressed={selectedTransitionIndex === change.sharedFrameIndex}
                              onClick={() => setSelectedTransitionIndex(current =>
                                current === change.sharedFrameIndex
                                  ? null : change.sharedFrameIndex)}>
                              {selectedTransitionIndex === change.sharedFrameIndex
                                ? "Hide Three-Frame Preview"
                                : `Preview Three Frames at Frame ${change.sharedFrameIndex + 1}`}
                            </button>
                          </li>
                        ))}
                      </ol>
                      {transition && (
                        <section className="workshop-motion-transition-preview"
                          aria-label="Original three-frame motion transition">
                          <p className="field-hint">
                            Original Stage samples immediately before, at and
                            after this joint-rate change. These are not newly
                            authored keyframes or modified animation.
                          </p>
                          <div className="workshop-motion-transition-frames">
                            {([
                              { label: "Before", frame: transition.before },
                              { label: "Middle", frame: transition.middle },
                              { label: "After", frame: transition.after },
                            ] as const).map(({ label, frame }) => (
                              <figure key={label}
                                aria-label={`${label} original transition frame`}>
                                <div className="workshop-motion-transition-picture">
                                  <Stage project={project} scene={scene}
                                    time={frame.seconds} labelled={false} />
                                </div>
                                <figcaption>
                                  <strong>{label} — Frame {frame.index + 1}</strong>
                                  <span>
                                    {frame.seconds.toFixed(3)}s
                                    {" · "}{frame.savedKeyframe
                                      ? "Original saved keyframe"
                                      : "Real Stage sample"}
                                  </span>
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                          <button type="button" className="button secondary small"
                            onClick={() => onSelectFrame(transition.after.index)}>
                            Review This Transition in Adjacent Frames
                          </button>
                        </section>
                      )}
                    </section>
                  )}
                  {reviewChanges && !changes && (
                    <p role="status" className="field-hint">
                      No valid neighboring rate changes are available.
                    </p>
                  )}
                  {pair && rates.intervals[pair.after.index - 1] && (
                    <p className="field-hint" role="status">
                      Frames {pair.before.index + 1} to {pair.after.index + 1}
                      {" · "}signed rotation rate{" "}
                      {rates.intervals[pair.after.index - 1].degreesPerSecond.toFixed(2)}°/s
                      {" · "}sample duration{" "}
                      {(rates.intervals[pair.after.index - 1].afterSeconds -
                        rates.intervals[pair.after.index - 1].beforeSeconds).toFixed(6)}s.
                    </p>
                  )}
                </section>
              )}
              {reviewRates && !rates && (
                <p role="status" className="field-hint">
                  No valid local joint rotation rate is available for this step.
                </p>
              )}
              {pair && (
                <p className="field-hint" role="status">
                  Selected frames {pair.before.index + 1} and {pair.after.index + 1}
                  {" · "}angles {curve.points[pair.before.index].angle.toFixed(2)}°
                  {" → "}{curve.points[pair.after.index].angle.toFixed(2)}°.
                </p>
              )}
              <p className="field-hint">
                This is a local joint-angle graph, not a world-space
                trajectory, speed graph, collision test, or smoothness score.
                Changing the joint or frame only changes this inspection.
              </p>
            </>
          ) : (
            <p role="status" className="field-hint">
              No valid saved motion and joint are available for this graph.
            </p>
          )}
        </>
      )}
    </section>
  );
}
