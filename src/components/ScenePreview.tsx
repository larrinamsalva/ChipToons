import { sceneCaptionText } from "../production";
import { CaptionOverlay } from "./CaptionOverlay";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Project, Scene } from "../model";
import type { Grip, Point } from "../interaction-model";
import { PlaybackClock } from "../playback";
import { Stage } from "./Stage";

export function ScenePreview({ project, scene, markers, releaseMarker, initialTime = 0.4, precision = 1, captionGuide = false, showCaptions = false, onFocusPosition }: {
  project: Project; scene: Scene; markers?: { actorId: string; grip: Grip }[]; initialTime?: number; releaseMarker?: Point; precision?: 1 | 2 | 3;
  captionGuide?: boolean; showCaptions?: boolean; onFocusPosition?: (point: Point) => void;
}) {
  const [clock] = useState(() => {
    const playback = new PlaybackClock();
    playback.configure(0, scene.duration, false);
    playback.seek(initialTime);
    return playback;
  });
  const [calm, setCalm] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  useEffect(() => {
    clock.configure(0, scene.duration, false);
    return () => clock.pause();
  }, [clock, scene.duration]);
  return (
    <section className="assistant-preview" aria-label="Proposed scene preview">
      <div className="live-stage">
        <Stage
          project={project}
          scene={scene}
          time={Math.min(frame.seconds, scene.duration)}
          calmPreview={calm}
          anchorMarkers={markers}
          releaseMarker={releaseMarker}
          captionGuide={captionGuide}
          onFocusPosition={onFocusPosition}
        />
        {showCaptions && <CaptionOverlay text={sceneCaptionText(project, scene, frame.seconds)} style={project.captionStyle} />}
      </div>
      <div className="assistant-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            if (frame.playing) clock.pause();
            else {
              clock.seek(0);
              clock.play();
            }
          }}
        >
          {frame.playing ? "Pause preview" : "Preview this scene"}
        </button>
        <label className="assistant-check">
          <input
            type="checkbox"
            checked={calm}
            onChange={(e) => setCalm(e.target.checked)}
          />{" "}
          Calmer preview
        </label>
      </div>
      <label>
        Preview time (seconds)
        <input
          type="number"
          min={0}
          max={scene.duration}
          step={10 ** -precision}
          value={Number(frame.seconds.toFixed(precision))}
          onChange={(e) => {
            clock.pause();
            clock.seek(e.target.valueAsNumber || 0);
          }}
        />
      </label>
    </section>
  );
}
