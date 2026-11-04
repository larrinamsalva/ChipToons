import { sceneCaptionText } from "../production";
import { CaptionOverlay } from "./CaptionOverlay";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Project, Scene } from "../model";
import type { Grip, Point } from "../interaction-model";
import { PreviewAudio } from "../audio-engine";
import { sceneStart } from "../timeline";
import { PlaybackClock } from "../playback";
import { Stage } from "./Stage";

export function ScenePreview({ project, scene, markers, releaseMarker, initialTime = 0.4, precision = 1, captionGuide = false, showCaptions = false, onFocusPosition, soundPreview = false, playFrom = 0 }: {
  project: Project; scene: Scene; markers?: { actorId: string; grip: Grip }[]; initialTime?: number; releaseMarker?: Point; precision?: 1 | 2 | 3;
  soundPreview?: boolean; playFrom?: number; captionGuide?: boolean; showCaptions?: boolean; onFocusPosition?: (point: Point) => void;
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
  const [audio] = useState(() => soundPreview ? new PreviewAudio() : undefined);
  const [sound, setSound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ticket = useRef(0);
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  useEffect(() => {
    clock.configure(0, scene.duration, false);
    return () => clock.pause();
  }, [clock, scene.duration]);
  useEffect(() => {
    if (!audio) return;
    const playbackTicket = ticket;
    const off = clock.subscribe(() => {
      if (!clock.getSnapshot().playing) audio.stop();
    });
    return () => { playbackTicket.current++; off(); audio.dispose(); };
  }, [audio, clock]);

  function stop() {
    ticket.current++;
    audio?.stop();
    clock.setTimeSource();
    clock.pause();
    setBusy(false);
  }

  async function play() {
    if (frame.playing) { stop(); return; }
    clock.seek(playFrom);
    if (!audio || !sound) { clock.play(); return; }
    const index = project.scenes.findIndex(item => item.id === scene.id);
    if (index < 0) { clock.play(); return; }
    const offset = sceneStart(project, index);
    const request = ++ticket.current;
    setBusy(true); setError("");
    try {
      const source = await audio.start(project, offset + playFrom, offset + playFrom, offset + scene.duration, false,
        problem => { stop(); setError(problem.message); });
      if (request !== ticket.current) return;
      clock.setTimeSource(() => source() - offset);
      clock.play();
    } catch (problem) {
      if (request === ticket.current) setError(problem instanceof Error ? problem.message : "Sound preview did not start.");
    } finally {
      if (request === ticket.current) setBusy(false);
    }
  }
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
          disabled={busy}
          onClick={() => void play()}
        >
          {busy ? "Preparing sound…" : frame.playing ? "Pause preview" : "Preview this scene"}
        </button>
        {audio && <label className="assistant-check">
          <input type="checkbox" checked={sound} onChange={event => { stop(); setSound(event.target.checked); }} /> Sound in preview
        </label>}
        <label className="assistant-check">
          <input
            type="checkbox"
            checked={calm}
            onChange={(e) => setCalm(e.target.checked)}
          />{" "}
          Calmer preview
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <label>
        Preview time (seconds)
        <input
          type="number"
          min={0}
          max={scene.duration}
          step={10 ** -precision}
          value={Number(frame.seconds.toFixed(precision))}
          onChange={(e) => {
            stop();
            clock.seek(e.target.valueAsNumber || 0);
          }}
        />
      </label>
    </section>
  );
}
