import type { ImageSettings } from "../library";
import { FULL_CROP } from "../art-model";

export function ImageControls({
  value,
  onChange,
  croppable = false,
  defaultSize = { width: 190, height: 245 },
}: {
  value: ImageSettings;
  onChange: (patch: ImageSettings) => void;
  croppable?: boolean;
  defaultSize?: { width: number; height: number };
}) {
  const crop = value.crop ?? FULL_CROP;
  function cropField(key: keyof typeof crop, n: number) {
    const next = { ...crop, [key]: n / 100 };
    next.width = Math.min(next.width, 1 - next.left);
    next.height = Math.min(next.height, 1 - next.top);
    onChange({ crop: next });
  }
  return (
    <div className="image-controls">
      <div className="form-grid compact">
        <label>
          Artwork rotation
          <input
            aria-label="Artwork rotation"
            type="range"
            min="-180"
            max="180"
            value={value.rotation ?? 0}
            onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          />
        </label>
        <label>
          Artwork opacity
          <input
            aria-label="Artwork opacity"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={value.opacity ?? 1}
            onChange={(e) => onChange({ opacity: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="flip-controls">
        <label className="inline-check">
          <input
            type="checkbox"
            checked={value.flip ?? false}
            onChange={(e) => onChange({ flip: e.target.checked })}
          />
          Flip horizontally
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={value.flipY ?? false}
            onChange={(e) => onChange({ flipY: e.target.checked })}
          />
          Flip vertically
        </label>
      </div>
      {croppable && (
        <>
          <div className="form-grid compact">
            <label>
              Artwork width
              <input
                aria-label="Artwork width"
                type="number"
                min="10"
                max="1600"
                value={value.width ?? defaultSize.width}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 10 && n <= 1600) onChange({ width: n });
                }}
              />
            </label>
            <label>
              Artwork height
              <input
                aria-label="Artwork height"
                type="number"
                min="10"
                max="900"
                value={value.height ?? defaultSize.height}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 10 && n <= 900) onChange({ height: n });
                }}
              />
            </label>
          </div>
          <details className="crop-controls">
            <summary>Crop original image</summary>
            <p className="field-hint">
              Choose the visible part. The original image stays intact.
            </p>
            {(["left", "top", "width", "height"] as const).map((k) => (
              <label key={k}>
                Crop {k}{" "}
                <span className="range-value">
                  {Math.round(crop[k] * 100)}%
                </span>
                <input
                  aria-label={`Crop ${k}`}
                  type="range"
                  min={k === "left" || k === "top" ? 0 : 5}
                  max={
                    k === "left" || k === "top"
                      ? 95
                      : Math.round(
                          (1 - (k === "width" ? crop.left : crop.top)) * 100,
                        )
                  }
                  value={Math.round(crop[k] * 100)}
                  onChange={(e) => cropField(k, Number(e.target.value))}
                />
              </label>
            ))}
            <button
              className="button text small"
              onClick={() => onChange({ crop: { ...FULL_CROP } })}
            >
              Reset crop
            </button>
          </details>
        </>
      )}
      <button
        className="button text small"
        onClick={() =>
          onChange({
            crop: { ...FULL_CROP },
            rotation: 0,
            flip: false,
            flipY: false,
            opacity: 1,
            ...(croppable ? defaultSize : {}),
          })
        }
      >
        Reset image changes
      </button>
    </div>
  );
}
