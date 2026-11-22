import { useEffect, useState } from "react";
import type { Project, Scene } from "../model";
import type { WorkshopMotionStep } from "../workshop-motion-steps";
import {
  workshopMotionLoopFrame,
  type WorkshopMotionLoopSpeed,
} from "../workshop-motion-loop";
import { workshopMotionScrubSample } from "../workshop-motion-scrub";
import { Stage } from "./Stage";

/**
 * Optional, read-only playback of one saved pose-to-pose transition.
 * This uses a private wall clock; it cannot seek the studio's global clock
 * or overwrite the authored puppet animation.
 */
export function WorkshopMotionLoopPlayer({
  project, scene, actorId, step,
}: {
  project: Project;
  scene: Scene;
  actorId: string;
  step: WorkshopMotionStep;
}) {
  const [opened, setOpened] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [percent, setPercent] = useState(0);
  const [speed, setSpeed] = useState<WorkshopMotionLoopSpeed>(1);
  const sample = workshopMotionScrubSample(scene, actorId, step, percent);
  const isValid = !!sample;

  useEffect(() => {
    if (!opened || !playing) return;
    // Captured at play/resume; speed changes restart from the last real frame.
    const startingPercent = percent;
    const startingTime = performance.now();
    let frameId = 0;
    let lastUpdateTime = -Infinity;
    const tick = (now: number) => {
      // Limit heavy Stage SVG renders while preserving continuous real time.
      if (now - lastUpdateTime >= 50) {
        const next = workshopMotionLoopFrame(
          scene, actorId, step, startingPercent, now - startingTime, speed,
        );
        if (!next) {
          setPlaying(false);
          return;
        }
        setPercent(previous => previous === next.percent ? previous : next.percent);
        lastUpdateTime = now;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    const pauseWhenHidden = () => {
      if (document.visibilityState === "hidden") setPlaying(false);
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
    };
    // The button or speed change is the intentional start/resume boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, playing, speed, scene, actorId, step]);

  return (
    <section className="workshop-motion-loop" aria-label="Selected motion loop">
      <button
        className="button secondary small"
        type="button"
        aria-expanded={opened}
        onClick={() => {
          setPlaying(false);
          setOpened(value => !value);
        }}
      >
        {opened ? "Close Motion Loop" : "Review Motion Loop"}
      </button>
      {opened && (
        <>
          <p className="field-hint">
            Play the original motion between these two saved poses on repeat.
            Slow it down to spot unnatural movement. Only this preview moves;
            your real timeline, music and exports are unchanged.
          </p>
          <div className="workshop-motion-loop-controls">
            <button
              type="button"
              className="button secondary small"
              disabled={!isValid}
              onClick={() => setPlaying(value => !value)}
              aria-pressed={playing}
            >
              {playing ? "Pause Motion Loop" : "Play Motion Loop"}
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => {
                setPlaying(false);
                setPercent(0);
              }}
            >
              Restart Motion Loop
            </button>
            <label>
              Motion loop speed
              <select
                aria-label="Motion loop speed"
                value={speed}
                onChange={event => {
                  const next = Number(event.target.value);
                  if (next === .5 || next === 1 || next === 2)
                    setSpeed(next);
                }}
              >
                <option value={0.5}>Slow · 0.5×</option>
                <option value={1}>Normal · 1×</option>
                <option value={2}>Fast · 2×</option>
              </select>
            </label>
          </div>
          {sample && (
            <>
              <output className="workshop-motion-loop-status"
                aria-label="Motion loop frame readout" aria-live={playing ? "off" : "polite"}>
                {playing ? "Playing" : "Paused"} · {sample.percent}% · {sample.seconds.toFixed(2)}s
                {sample.savedKeyframe ? " · Original saved keyframe" : " · Original timeline frame"}
              </output>
              <div className="workshop-motion-loop-stage"
                aria-label="Playing original Stage movement">
                <Stage project={project} scene={scene}
                  time={sample.seconds} labelled={false} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
