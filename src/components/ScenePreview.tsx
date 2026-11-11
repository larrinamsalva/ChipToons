import { sceneCaptionText } from "../production";
import { liveCameraFraming } from "../camera-motion-framing";
import {
  adjacentCameraRiskTime, cameraRiskMarkerOffset,
  cameraScrubWindow, inCameraScrubWindow, cameraSettleTiming,
} from "../camera-motion-scrub";
import { CaptionOverlay } from "./CaptionOverlay";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Project, Scene } from "../model";
import type { Grip, Point } from "../interaction-model";
import { PreviewAudio } from "../audio-engine";
import { sceneStart } from "../timeline";
import { PlaybackClock } from "../playback";
import { Stage } from "./Stage";

export function ScenePreview({ project, scene, markers, releaseMarker, initialTime = 0.4, precision = 1, captionGuide = false, showCaptions = false, onFocusPosition, soundPreview = false, initialSound = false, playFrom = 0, playTo = scene.duration, shotGuides, scrubTimeline }: {
  project: Project; scene: Scene; markers?: { actorId: string; grip: Grip }[]; initialTime?: number; releaseMarker?: Point; precision?: 1 | 2 | 3;
  soundPreview?: boolean; initialSound?: boolean; playFrom?: number; playTo?: number; shotGuides?: { ids: string[]; offset: Point }; captionGuide?: boolean; showCaptions?: boolean; onFocusPosition?: (point: Point) => void;
  /** Opt-in review-only motion timeline; risk moments come from real camera scans. */
  scrubTimeline?: {
    start: number; end: number; riskyTimes?: number[];
    settle?: { start: number; move: number; end: number };
  };
}) {
  const [clock] = useState(() => {
    const playback = new PlaybackClock();
    playback.configure(0, playTo, false);
    playback.seek(initialTime);
    return playback;
  });
  const [calm, setCalm] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [audio] = useState(() => soundPreview ? new PreviewAudio() : undefined);
  const [sound, setSound] = useState(initialSound);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ticket = useRef(0);
  const frame = useSyncExternalStore(clock.subscribe, clock.getSnapshot);
  const scrubWindow = scrubTimeline
    ? cameraScrubWindow(scrubTimeline.start, scrubTimeline.end) : undefined;
  const riskTimes = scrubTimeline?.riskyTimes ?? [];
  const settle = scrubWindow && scrubTimeline?.settle
    ? cameraSettleTiming(scrubTimeline.settle,scrubWindow) : undefined;
  const previousRisk = scrubWindow
    ? adjacentCameraRiskTime(riskTimes,frame.seconds,"previous",scrubWindow) : undefined;
  const nextRisk = scrubWindow
    ? adjacentCameraRiskTime(riskTimes,frame.seconds,"next",scrubWindow) : undefined;
  const liveFraming = scrubWindow
    ? liveCameraFraming(project, scene, frame.seconds, calm) : undefined;
  useEffect(() => {
    clock.configure(0, playTo, false);
    return () => clock.pause();
  }, [clock, playTo]);
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

  function seekPreview(time:number) {
    stop();
    if (Number.isFinite(time)) clock.seek(time);
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
      const source = await audio.start(project, offset + playFrom, offset + playFrom, offset + playTo, false,
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
          shotGuides={shotGuides}
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
      {scrubWindow && <div className="camera-motion-scrubber"
        role="group" aria-label="Camera motion scrubber controls">
        <div className="camera-motion-scrubber-head">
          <strong>Scrub camera motion</strong>
          <output>{frame.seconds.toFixed(2)}s</output>
        </div>
        {liveFraming && <div className="camera-live-framing-meter"
          role="group" aria-label="Live camera framing meter">
          <span>Live camera zoom: <output aria-label="Live camera zoom">
            {liveFraming.camera.zoom.toFixed(2)}×
          </output></span>
          <span>
            {liveFraming.coverage.edges.length
              ? "Original canvas edges outside view: " + liveFraming.coverage.edges.join(", ")
              : "Inside original canvas"}
          </span>
          {liveFraming.coverage.edges.length > 0 && <span>
            Approximately {(liveFraming.coverage.outsideFraction * 100).toFixed(1)}%
            of the visible camera area is beyond the original canvas
          </span>}
        </div>}
        <div className="camera-motion-scrubber-track">
          <input type="range" aria-label="Camera motion scrubber"
            min={scrubWindow.start} max={scrubWindow.end} step={.005}
            value={inCameraScrubWindow(frame.seconds,scrubWindow)}
            onChange={event=>seekPreview(Number(event.target.value))} />
          {settle && <div className="camera-motion-settle-tick" aria-hidden="true"
            style={{left:settle.markerPercent+"%"}} />}
          <div className="camera-motion-risk-ticks" aria-hidden="true">
            {riskTimes.filter(t=>t>=scrubWindow.start&&t<=scrubWindow.end).map((time,i)=>(
              <span key={i} style={{left:cameraRiskMarkerOffset(time,scrubWindow)+"%"}} />
            ))}
          </div>
        </div>
        {settle && <div className="camera-motion-settle-guide" role="group"
          aria-label="Camera move timing guide">
          <p>
            Camera reaches final view at <strong>{settle.settleAt.toFixed(2)}s</strong>.
            {settle.holdSeconds > 0.001
              ? " Then holds for " + settle.holdSeconds.toFixed(2) + "s."
              : " Continues moving until the shot ends."}
          </p>
          <p className="field-hint">
            {frame.seconds < settle.settleAt - .005
              ? "At current preview: camera is moving."
              : settle.holdSeconds > .001
                ? "At current preview: final camera view is held."
                : "At current preview: camera is arriving at its final view."}
          </p>
          <button type="button" className="button secondary small"
            onClick={()=>seekPreview(settle.seekAt)}>
            Jump to camera move finish
          </button>
        </div>}
        <p className="field-hint">
          Drag the slider or use arrow keys to inspect the real animated
          preview and timed captions. Nothing is saved by scrubbing.
        </p>
        {!!riskTimes.length && <div className="camera-motion-risk-navigation">
          <span>{riskTimes.length} flagged sample{riskTimes.length===1?"":"s"} marked on the timeline</span>
          <button type="button" className="button secondary small"
            disabled={previousRisk===undefined}
            onClick={()=>{if(previousRisk!==undefined)seekPreview(previousRisk);}}>
            Previous risky moment
          </button>
          <button type="button" className="button secondary small"
            disabled={nextRisk===undefined}
            onClick={()=>{if(nextRisk!==undefined)seekPreview(nextRisk);}}>
            Next risky moment
          </button>
        </div>}
      </div>}
      <label>
        Preview time (seconds)
        <input
          type="number"
          min={0}
          max={playTo}
          step={10 ** -precision}
          value={Number(frame.seconds.toFixed(precision))}
          onChange={(e) => {
            seekPreview(e.target.valueAsNumber || 0);
          }}
        />
      </label>
    </section>
  );
}
