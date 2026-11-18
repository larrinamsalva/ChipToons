import { useState } from "react";
import type { Project, Scene } from "../model";
import { workshopSeatingReviewMoments } from "../workshop-seating-review";
import { Stage } from "./Stage";
import { resolvedCharacter } from "../library";
import { workshopJointDifferences } from "../workshop-joint-differences";

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
                {differences.length ? (
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
                        {differences.map(diff => (
                          <tr key={diff.partId}>
                            <th scope="row">{diff.label}</th>
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
                    No joint angles or offsets differ beyond 0.1 between these frames.
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
