import { useState } from "react";
import type { Project, Scene } from "../model";
import { workshopSeatingReviewMoments } from "../workshop-seating-review";
import { Stage } from "./Stage";

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
  const [leftChoice, setLeftChoice] = useState("seated");
  const [rightChoice, setRightChoice] = useState("standing");
  if (moments.length < 2) return null;

  const left = moments.find(moment => moment.id === leftChoice) ?? moments[0];
  const right = moments.find(moment => moment.id === rightChoice) ??
    moments[moments.length - 1];
  const frames = scene.elements.find(element => element.id === actorId)?.animation?.keyframes;
  const first = frames?.find(key => Math.abs(key.time - left.seconds) < 0.001);
  const second = frames?.find(key => Math.abs(key.time - right.seconds) < 0.001);
  const jointIds = new Set([
    ...Object.keys(first?.joints ?? {}),
    ...Object.keys(second?.joints ?? {}),
  ]);
  // Sparse joint snapshots omit zero rotations. Treat omitted parts as
  // neutral rather than missing/invalid when comparing poses.
  const changed = [...jointIds].filter(id =>
    Math.abs((first?.joints?.[id]?.angle ?? 0) -
      (second?.joints?.[id]?.angle ?? 0)) > 0.1).length;

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
            {changed} animated joint {changed === 1 ? "angle differs" : "angles differ"}
            {" "}between these saved poses. Missing neutral joints count as zero.
          </p>
        </>
      )}
    </section>
  );
}
