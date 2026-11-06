import type { Project } from "../model";
import { downloadBlob, safeFilename } from "../files";
import {
  LITTLE_FIXERS_VOICE_BOARD_TITLE,
  littleFixersVoiceCueSheet,
  littleFixersVoiceReadiness,
} from "../little-fixers-voice-readiness";
import { Modal } from "./Modal";

export function LittleFixersVoiceBoard({
  project,
  onClose,
  onRecord,
  onReview,
  onAnimate,
  onCaptions,
}: {
  project: Project;
  onClose: () => void;
  onRecord: (sceneIndex: number, lineId: string) => void;
  onReview: (sceneIndex: number, lineId: string) => void;
  onAnimate: (sceneIndex: number, clipId: string) => void;
  onCaptions: (sceneIndex: number) => void;
}) {
  const board = littleFixersVoiceReadiness(project);
  return (
    <Modal title={LITTLE_FIXERS_VOICE_BOARD_TITLE} onClose={onClose} wide>
      <section aria-label="Scout voice completion checklist" className="director">
        <p>
          Your original moving Scout scenes are preserved. This board helps
          you finish the actual voice recordings, recorded-audio lip sync and
          captions without replacing any approved take or inventing voices.
        </p>
        <p role="status">
          <strong>{board.approved} of {board.total} script lines approved</strong>
          {" · "}{board.unrecorded} not yet recorded
          {" · "}{board.mouthReady} approved lines with mouth animation ready
          {" · "}{board.captionReady} approved lines with timed captions
        </p>
        <p className="field-hint">
          Record your own voice or upload audio you have permission to use.
          Listen and approve each take in the Script Director, then animate
          the actual audio waveform, check captions and save a complete
          project backup. Audio is stored on your device.
        </p>
        <div className="director-actions">
          <button className="button secondary" onClick={() =>
            downloadBlob(new Blob([littleFixersVoiceCueSheet(project)], {
              type: "text/plain;charset=utf-8",
            }), `${safeFilename(project.title)}-voice-cues.txt`)
          }>
            Download voice recording cue sheet
          </button>
        </div>
        <ol aria-label="Recording lines" className="director-lines">
          {board.lines.map(line => {
            const label = `scene ${line.sceneIndex + 1} line ${line.lineIndex + 1}`;
            return (
              <li key={line.lineId} className="director-card">
                <h3>Scene {line.sceneIndex + 1} · Line {line.lineIndex + 1}</h3>
                <p className="field-hint">{line.sceneTitle}</p>
                <p><strong>{line.text}</strong></p>
                <p>Recording: {line.status}</p>
                <p>
                  Mouth animation: {line.mouthReady
                    ? line.needsMouth ? "Ready" : "Not needed"
                    : "Needs voice-based lip sync"}
                  {" · "}
                  Timed captions: {line.captionReady ? "Ready" : "Needs review"}
                </p>
                <div className="director-actions">
                  {line.status === "Not recorded" ? (
                    <button className="button primary" onClick={() =>
                      onRecord(line.sceneIndex, line.lineId)
                    }>Record {label}</button>
                  ) : !line.approved ? (
                    <button className="button primary" onClick={() =>
                      onReview(line.sceneIndex, line.lineId)
                    }>Review and approve {label}</button>
                  ) : !line.mouthReady && line.clipId ? (
                    <button className="button primary" onClick={() =>
                      onAnimate(line.sceneIndex, line.clipId!)
                    }>Animate mouth for {label}</button>
                  ) : !line.captionReady ? (
                    <button className="button primary" onClick={() =>
                      onCaptions(line.sceneIndex)
                    }>Review captions for scene {line.sceneIndex + 1}</button>
                  ) : (
                    <span>Voice, animation and captions accounted for.</span>
                  )}
                  {line.status !== "Not recorded" && (
                    <button className="button secondary" onClick={() =>
                      onReview(line.sceneIndex, line.lineId)
                    }>Open this line in Script Director</button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {board.complete ? (
          <p role="status">Every written line has an approved take, matching mouth animation where supported, and timed captions. Review the complete video before publishing.</p>
        ) : (
          <p role="status">This version is not fully voiced yet. Only approved existing recordings play in the exported cartoon.</p>
        )}
        <button className="button secondary" onClick={onClose}>Return to my cartoon</button>
      </section>
    </Modal>
  );
}
