import { useState } from "react";
import type { Project, Scene } from "../model";
import { workshopSeatingReviewMoments } from "../workshop-seating-review";
import { Stage } from "./Stage";
import { resolvedCharacter } from "../library";
import { workshopJointDifferences } from "../workshop-joint-differences";
import { workshopMotionSteps } from "../workshop-motion-steps";
import { workshopMotionFilmstrip } from "../workshop-motion-filmstrip";
import { workshopJointReview } from "../workshop-joint-review-filter";
import type { WorkshopJointGroup, WorkshopJointOrder } from "../workshop-joint-review-filter";

/**
 * Two genuine, independent renderings of the same saved Stage scene.
 * This UI only reads the existing keyframes. It does not seek the main
 * playback clock, change the project or write timeline keys.
 */
export function WorkshopPoseCompare({
  project,
  scene,
  actorId,
}: {
  project: Project;
  scene: Scene;
  actorId: string;
}) {
  const moments = workshopSeatingReviewMoments(scene, actorId);
  const [opened, setOpened] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [stepsOpened, setStepsOpened] = useState(false);
  const [filmstripOpened, setFilmstripOpened] = useState(false);
  const [jointGroup, setJointGroup] = useState<WorkshopJointGroup>("all");
  const [jointOrder, setJointOrder] = useState<WorkshopJointOrder>("rig");
  const [leftChoice, setLeftChoice] = useState("seated");
  const [rightChoice, setRightChoice] = useState("standing");
  if (moments.length < 2) return null;

  const left = moments.find(moment => moment.id === leftChoice) ?? moments[0];
  const right = moments.find(moment => moment.id === rightChoice) ??
    moments[moments.length - 1];
  const actor = scene.elements.find(element => element.id === actorId);
  const rig = resolvedCharacter(project, actor)?.puppet;
  const differences = workshopJointDifferences(
    scene, actorId, rig, left.seconds, right.seconds,
  );
  const changed = differences.length;
  const review = workshopJointReview(differences, jointGroup, jointOrder);
  const steps = opened && stepsOpened ? workshopMotionSteps(scene, actorId, rig) : [];
  const selectedStep = steps.find(step =>
    step.from.id === left.id && step.to.id === right.id);
  const filmstrip = stepsOpened && filmstripOpened
    ? workshopMotionFilmstrip(scene, actorId, selectedStep) : [];

  return (
    <section className="workshop-pose-comparison" aria-label="Side-by-side workshop pose comparison">
      <button
        className="button secondary small"
        type="button"
        aria-expanded={opened}
        onClick={() => setOpened(value => !value)}
      >
        {opened ? "Close Pose Comparison" : "Compare Two Poses Side by Side"}
      </button>
      {opened && (
        <>
          <p className="field-hint">
            Compare two actual saved Stage frames from this scene.
            No keyframes, furniture, playback position or project data change.
          </p>
          <div className="workshop-motion-steps" aria-label="Recorded motion step review">
            <button
              className="button secondary small"
              type="button"
              aria-expanded={stepsOpened}
              onClick={() => setStepsOpened(value => !value)}
            >
              {stepsOpened ? "Close Motion Steps" : "Review Motion Steps"}
            </button>
            {stepsOpened && (
              <>
                <p className="field-hint">
                  Each step compares two adjacent saved poses in their actual
                  scene order. Rotations are local joint degrees, not a
                  foot-contact or movement-quality score.
                </p>
                <div className="workshop-motion-step-list">
                  {steps.map(step => {
                    const before = step.from.label.replace("Review ", "");
                    const after = step.to.label.replace("Review ", "");
                    const selected = left.id === step.from.id &&
                      right.id === step.to.id;
                    return (
                      <button
                        key={step.id}
                        className="workshop-motion-step-button"
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setLeftChoice(step.from.id);
                          setRightChoice(step.to.id);
                        }}
                      >
                        <strong>Compare {before} to {after}</strong>
                        <span>
                          {step.from.seconds.toFixed(2)}s – {step.to.seconds.toFixed(2)}s
                          {" · "}{step.changedJoints} changed
                          {step.changedJoints === 1 ? " joint" : " joints"}
                          {" · "}largest rotation {step.largestRotation.toFixed(1)}°
                          {step.largestRotationRole ? ` (${step.largestRotationRole})` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="workshop-motion-filmstrip-review">
                  <button
                    className="button secondary small"
                    type="button"
                    aria-expanded={filmstripOpened}
                    onClick={() => setFilmstripOpened(value => !value)}
                  >
                    {filmstripOpened ? "Close Three-Frame Filmstrip" : "Review Three-Frame Filmstrip"}
                  </button>
                  {filmstripOpened && (filmstrip.length ? (
                    <>
                      <p className="field-hint">
                        Real Stage snapshots at the selected step's start, halfway,
                        and end. The middle is sampled from the original timeline;
                        it is not an added keyframe. Existing props, furniture,
                        background and camera are retained.
                      </p>
                      <div className="workshop-motion-filmstrip-grid"
                        aria-label="Three-frame motion filmstrip">
                        {filmstrip.map(frame => (
                          <figure
                            key={frame.id}
                            className="workshop-motion-filmstrip-frame"
                            aria-label={`${frame.label} motion filmstrip frame`}
                          >
                            <div className="workshop-motion-filmstrip-picture">
                              <Stage
                                project={project}
                                scene={scene}
                                time={frame.seconds}
                                labelled={false}
                              />
                            </div>
                            <figcaption>
                              <strong>{frame.label} — {frame.seconds.toFixed(2)}s</strong>
                              <span>
                                {frame.savedKeyframe
                                  ? "Saved keyframe"
                                  : "Real timeline sample (between keys)"}
                              </span>
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="field-hint" role="status">
                      Choose a recorded motion step above to see its three real frames.
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="workshop-pose-comparison-grid">
            {([
              { side: "Before" as const, moment: left, choose: setLeftChoice },
              { side: "After" as const, moment: right, choose: setRightChoice },
            ]).map(({ side, moment, choose }) => (
              <div
                key={side}
                className="workshop-pose-comparison-card"
                role="group"
                aria-label={`${side} pose preview`}
              >
                <label>
                  {side} pose
                  <select
                    aria-label={`${side} pose`}
                    value={moment.id}
                    onChange={event => choose(event.target.value)}
                  >
                    {moments.map(option => (
                      <option key={option.id} value={option.id}>
                        {option.label.replace("Review ", "")} — {option.seconds.toFixed(2)}s
                      </option>
                    ))}
                  </select>
                </label>
                <div className="workshop-pose-comparison-frame">
                  <Stage
                    project={project}
                    scene={scene}
                    time={moment.seconds}
                    labelled={false}
                  />
                </div>
                <p className="field-hint">
                  {moment.label.replace("Review ", "")} at {moment.seconds.toFixed(2)} seconds
                </p>
              </div>
            ))}
          </div>
          <p className="field-hint" role="status">
            {changed} articulated {changed === 1 ? "joint differs" : "joints differ"}
            {" "}between these saved poses. Sparse neutral joints count as zero.
          </p>
          <div className="workshop-joint-inspector" aria-label="Joint Difference Inspector">
            <button
              className="button secondary small"
              type="button"
              aria-expanded={inspecting}
              onClick={() => setInspecting(value => !value)}
            >
              {inspecting ? "Close Joint Differences" : "Inspect Joint Differences"}
            </button>
            {inspecting && (
              <>
                <p className="field-hint">
                  Original saved angles in degrees. Positive/negative values
                  reflect local joint rotation, not collision or foot contact.
                  Offsets are local joint pixels. No values are changed.
                </p>
                <div className="workshop-joint-review-controls">
                  <label>
                    Body-part filter
                    <select
                      aria-label="Joint body filter"
                      value={jointGroup}
                      onChange={event => setJointGroup(event.target.value as WorkshopJointGroup)}
                    >
                      <option value="all">All changed joints</option>
                      <option value="arms">Arms and hands</option>
                      <option value="legs">Legs and feet</option>
                      <option value="body">Head and body</option>
                    </select>
                  </label>
                  <label>
                    Display order
                    <select
                      aria-label="Joint listing order"
                      value={jointOrder}
                      onChange={event => setJointOrder(event.target.value as WorkshopJointOrder)}
                    >
                      <option value="rig">Original rig order</option>
                      <option value="rotation">Largest rotation first</option>
                    </select>
                  </label>
                </div>
                <p className="field-hint" role="status">
                  Showing {review.rows.length} of {review.total} changed joints.
                  The largest rotation is relative to these two keyframes only.
                </p>
                {review.rows.length ? (
                  <div className="workshop-joint-inspector-scroll">
                    <table aria-label="Changed workshop joints">
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
                        {review.rows.map(diff => (
                          <tr
                            key={diff.partId}
                            data-largest-rotation={
                              diff.partId === review.largestRotationPartId ? "true" : undefined
                            }
                          >
                            <th scope="row">
                              {diff.label}
                              {diff.partId === review.largestRotationPartId && (
                                <span className="workshop-joint-largest-label">Largest rotation</span>
                              )}
                            </th>
                            <td>{diff.beforeAngle.toFixed(1)}</td>
                            <td>{diff.afterAngle.toFixed(1)}</td>
                            <td>{diff.angleDelta > 0 ? "+" : ""}{diff.angleDelta.toFixed(1)}</td>
                            <td>
                              {diff.xDelta.toFixed(1)}, {diff.yDelta.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="field-hint" role="status">
                    {review.total
                      ? "No changed joints in this body group. Choose another filter."
                      : "No joint angles or offsets differ beyond 0.1 between these frames."}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
