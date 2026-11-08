import { CREATIVE_STUDIOS, connectionLabel } from "../studio-connections";

/**
 * An honest entry point to other studios: no cross-origin data access, hidden
 * execution, external uploads, or promised format compatibility.
 */
export function StudioConnections({ onImportImage }: { onImportImage: () => void }) {
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
      <p className="field-hint">
        PNG, JPEG and WebP are the current image inputs. 3D models, animation
        sequences, editable layered files and XR scenes are not imported here.
        Learn about the planned adapters in the Creative Studio Bridge guide.
      </p>
    </details>
  );
}
