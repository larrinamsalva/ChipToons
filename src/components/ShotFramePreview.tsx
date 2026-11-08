import { useEffect, useRef, useState } from "react";

/**
 * A local, temporary preview of the exact original PNG File selected by the
 * creator. Object URLs are created only for the currently visible frame and
 * revoked whenever that frame changes or the preview unmounts.
 *
 * This visual editor aid never writes project data, uploads files, decodes
 * external URLs or changes the existing exported frame timeline.
 */
function LocalFrameImage({ file, alt }: { file: File; alt: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    const url = URL.createObjectURL(file);
    image.src = url;
    return () => {
      image.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <div className="studio-frame-image">
      <img ref={imageRef} alt={alt} decoding="async"
        onLoad={() => setBroken(false)}
        onError={() => setBroken(true)} />
      {broken && <p role="alert" className="field-hint">
        This PNG preview could not be decoded. Try a valid PNG export.
      </p>}
    </div>
  );
}

/** Scrub the exact local source frames, before creating any cartoon. */
export function ShotFramePreview({
  files, prefix, fps, disabled = false,
}: {
  files: readonly File[];
  prefix: string;
  fps: number;
  disabled?: boolean;
}) {
  const [index, setIndex] = useState(0);
  if (!files.length) return null;
  const selected = Math.min(Math.max(index, 0), files.length - 1);
  const file = files[selected];
  const seconds = (selected / fps).toFixed(2);

  return (
    <section className="studio-frame-preview" aria-label={`Preview of ${prefix}`}>
      <p className="field-hint">
        Original PNG preview · frame {selected + 1} of {files.length} · {seconds}s into shot
      </p>
      <LocalFrameImage key={file.name} file={file}
        alt={`Frame ${selected + 1} of ${files.length} from ${prefix}: ${file.name}`} />
      <label className="studio-frame-scrubber">
        Inspect numbered frame
        <input type="range" min={0} max={files.length - 1} step={1}
          value={selected} disabled={disabled}
          aria-label={`Inspect frame of ${prefix}`}
          onChange={event => setIndex(Number(event.target.value))} />
      </label>
      <div className="studio-frame-stepper">
        <button type="button" className="button secondary small"
          aria-label={`Previous frame of ${prefix}`}
          disabled={disabled || selected === 0}
          onClick={() => setIndex(value => Math.max(0, value - 1))}>
          Previous frame
        </button>
        <span className="field-hint" aria-live="polite">
          {file.name} · {selected + 1}/{files.length}
        </span>
        <button type="button" className="button secondary small"
          aria-label={`Next frame of ${prefix}`}
          disabled={disabled || selected === files.length - 1}
          onClick={() => setIndex(value => Math.min(files.length - 1, value + 1))}>
          Next frame
        </button>
      </div>
    </section>
  );
}
