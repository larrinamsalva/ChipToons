import { CREATIVE_STUDIOS, connectionLabel } from "../studio-connections";
import { FrameSequencePicker } from "./FrameSequencePicker";
import type { ShotBeat } from "../studio-shot-beats";
import type { SubtitleDraftAdjustment } from "../studio-subtitle-drafts";
import type { ShotDirection } from "../studio-multishot";
import "../studio-connections.css";

/**
 * An honest entry point to other studios: no cross-origin data access, hidden
 * execution, external uploads, or promised format compatibility.
 */
export function StudioConnections({
  onImportImage, onCreateSequence,
}: {
  onImportImage: () => void;
  onCreateSequence: (files: File[], fps: number, multiShot: boolean,
    direction?: ShotDirection[], beats?: ShotBeat[],
    includeDraftCaptions?: boolean, subtitleEdits?: SubtitleDraftAdjustment[]) => Promise<void>;
}) {
  return (
    <details className="transform-examples">
      <summary>More ways to create · 3D, art, film &amp; XR studio connections</summary>
      <p className="field-hint">
        Advanced creator tools from MichaelWave369. Your projects remain local.
        Connections below are manual unless explicitly labeled otherwise.
      </p>
      <div className="studio-connections-list">
        {CREATIVE_STUDIOS.map((studio) => (
          <section className="studio-connection" aria-label={studio.name} key={studio.id}>
            <h3>{studio.name}</h3>
            <p>{studio.description}</p>
            <p className="field-hint"><strong>{connectionLabel(studio.state)}</strong> · {studio.instructions}</p>
            <div className="series-actions">
              <a className="button secondary small" href={studio.url} target="_blank" rel="noopener noreferrer">
                Open {studio.name.split(" · ")[0]} (new tab)
              </a>
              {studio.canStartFromImage && (
                <button className="button secondary small" type="button" onClick={onImportImage}>
                  Start a cartoon from PNG
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
      <FrameSequencePicker onCreate={onCreateSequence} />
      <p className="field-hint">
        Single stills accept PNG, JPEG and WebP. Bounded numbered PNG sequences now
        import as timed 2D animation; 3D models, editable layered files and XR scenes
        are still not imported here. See the Creative Studio Bridge guide.
      </p>
    </details>
  );
}
