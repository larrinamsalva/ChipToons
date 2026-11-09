import { useState } from "react";
import type { Project } from "../model";
import { framefieldGuidedSession } from "../framefield-guided-session";

/** A read-only rehearsal guide; actual recording remains in VoiceStudio. */
export function FramefieldGuidedRecording({
  project, onScene,
}: {
  project: Project;
  onScene: (index: number, panel?: "voices" | "captions") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(0);
  const session = framefieldGuidedSession(project);
  const position = Math.min(selected, session.scenes.length - 1);
  const scene = session.scenes[position];
  return (
    <section aria-label="Guided scene voice recording">
      <h3>Guided Voice Recording</h3>
      <p className="field-hint">
        Rehearse your actual scenes in order. The existing Voices &amp; Sound
        Studio handles all microphone permissions, recording, preview and saving.
      </p>
      <button type="button" className="button secondary"
        onClick={() => setExpanded(open => !open)}>
        {expanded ? "Close guided recording" : "Start guided voice recording"}
      </button>
      {expanded && scene && (
        <div role="group" aria-label="Current guided recording step">
          <p role="status">
            {"Scene " + (position + 1) + " of " + session.scenes.length +
              " · " + session.scenesWithAssignedVoice +
              " scene(s) with assigned voice intervals"}
          </p>
          <h4>{scene.title}</h4>
          <p>{"Episode time: " + scene.episodeStart.toFixed(2) +
            "s–" + scene.episodeEnd.toFixed(2) + "s"}</p>
          {scene.narration.trim()
            ? <p><strong>Read narration:</strong> {scene.narration}</p>
            : <p className="field-hint">No written narration for this scene.</p>}
          {scene.dialogue.trim() && (
            <p><strong>Read dialogue:</strong> {scene.dialogue}</p>
          )}
          <p className={scene.missingVoice ? "framefield-voice-warning" : "field-hint"}>
            {scene.missingVoice
              ? "Written words need a real voice assignment or may remain intentionally silent."
              : scene.voiceClips > 0
                ? "Assigned voice intervals exist; listen to verify real spoken words."
                : "No assigned voice interval. A silent scene is allowed."}
          </p>
          {scene.cues.length ? (
            <ul aria-label="Caption cues for current recording scene">
              {scene.cues.map(cue => (
                <li key={cue.id}>
                  <strong>{cue.episodeStart.toFixed(2) + "s–" +
                    cue.episodeEnd.toFixed(2) + "s: "}</strong>
                  {cue.text}
                  {" · " + (cue.overlapsVoice
                    ? "An assigned voice clip overlaps; listen to confirm"
                    : "No assigned voice clip overlaps")}
                </li>
              ))}
            </ul>
          ) : <p className="field-hint">No timed captions for this scene.</p>}
          <div className="animation-actions">
            <button type="button" className="button primary"
              onClick={() => onScene(position, "voices")}>
              Record or upload this scene
            </button>
            <button type="button" className="button secondary"
              onClick={() => onScene(position, "captions")}>
              Review this scene's captions
            </button>
          </div>
          <div role="group" aria-label="Recording scene navigation"
            className="animation-actions">
            <button type="button" className="button secondary small"
              disabled={position === 0}
              onClick={() => setSelected(i => Math.max(0, i - 1))}>
              Previous scene
            </button>
            <button type="button" className="button secondary small"
              disabled={position >= session.scenes.length - 1}
              onClick={() => setSelected(i =>
                Math.min(session.scenes.length - 1, i + 1))}>
              Next scene
            </button>
          </div>
          <p className="field-hint">
            Return to Finish My Cartoon after recording to inspect updated
            voice coverage. The guide never approves speech, changes a project,
            or saves its current step.
          </p>
        </div>
      )}
    </section>
  );
}
