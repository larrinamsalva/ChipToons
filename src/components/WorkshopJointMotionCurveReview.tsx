import { useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import { resolvedCharacter } from "../library";
import { workshopAdjacentFramePair } from "../workshop-adjacent-frame-compare";
import { workshopJointMotionCurve } from "../workshop-joint-motion-curve";

/** A compact opt-in graph of actual Stage joint rotations, not a pose editor. */
export function WorkshopJointMotionCurveReview({
  project, scene, actorId, step, selectedIndex,
}: {
  project: Project;
  scene: Scene;
  actorId: string;
  step: WorkshopMotionStep;
  selectedIndex: number;
}) {
  const [opened, setOpened] = useState(false);
  const [partId, setPartId] = useState("");
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
              onChange={event => setPartId(event.target.value)}>
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
