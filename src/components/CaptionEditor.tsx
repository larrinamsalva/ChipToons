import { useState } from "react";
import type { Project } from "../model";
import { uid } from "../model";
import { captionsFromText, srt } from "../production";
import { downloadBlob, safeFilename } from "../files";
import { MediaNumber } from "./MediaNumber";
export function CaptionEditor({
  project,
  sceneIndex,
  time,
  onChange,
}: {
  project: Project;
  sceneIndex: number;
  time: number;
  onChange: (p: Project) => boolean;
}) {
  const [selected, setSelected] = useState(
      project.captions.find((c) => c.sceneId === project.scenes[sceneIndex].id)
        ?.id ?? "",
    ),
    [pending, setPending] = useState<"scene" | "all" | null>(null),
    scene = project.scenes[sceneIndex],
    caption = project.captions.find((c) => c.id === selected);
  function generate(which: "scene" | "all") {
    const targets = which === "all" ? project.scenes : [scene],
      ids = new Set(targets.map((s) => s.id)),
      generated = targets.flatMap(captionsFromText);
    if (
      onChange({
        ...project,
        captions: [
          ...project.captions.filter((c) => !ids.has(c.sceneId)),
          ...generated,
        ],
      })
    )
      setSelected(generated[0]?.id ?? "");
    setPending(null);
  }
  return (
    <section className="caption-editor">
      <h3>Words little viewers can follow</h3>
      <p className="field-hint">
        Generate a starting track from your written narration and dialogue. This
        uses your text; it does not transcribe recorded speech.
      </p>
      <div className="animation-actions">
        <button
          className="button secondary"
          onClick={() =>
            project.captions.some((c) => c.sceneId === scene.id)
              ? setPending("scene")
              : generate("scene")
          }
        >
          Generate this scene’s captions
        </button>
        <button
          className="button secondary"
          onClick={() =>
            project.captions.length ? setPending("all") : generate("all")
          }
        >
          Generate episode captions
        </button>
        <button
          className="button primary"
          onClick={() => {
            const start = Math.min(time, scene.duration - 0.1),
              c = {
                id: uid(),
                sceneId: scene.id,
                start,
                end: Math.min(scene.duration, start + 2),
                text: "A kind little moment.",
              };
            if (onChange({ ...project, captions: [...project.captions, c] }))
              setSelected(c.id);
          }}
        >
          Add caption at playhead
        </button>
      </div>
      {pending && (
        <div className="media-notice">
          <p>
            Replace the existing {pending === "all" ? "episode" : "scene"}{" "}
            caption track with a fresh text draft? Your audio recordings stay
            unchanged.
          </p>
          <div className="animation-actions">
            <button
              className="button secondary"
              onClick={() => setPending(null)}
            >
              Cancel caption replacement
            </button>
            <button
              className="button primary"
              onClick={() => generate(pending)}
            >
              Replace caption track
            </button>
          </div>
        </div>
      )}
      <label>
        Caption moment
        <select
          aria-label="Caption moment"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a caption</option>
          {project.captions.map((c) => (
            <option key={c.id} value={c.id}>
              {project.scenes.findIndex((s) => s.id === c.sceneId) + 1} ·{" "}
              {c.start.toFixed(2)}s · {c.text.slice(0, 42)}
            </option>
          ))}
        </select>
      </label>
      {caption && (
        <>
          <label>
            Caption words
            <textarea
              aria-label="Caption words"
              maxLength={280}
              rows={4}
              value={caption.text}
              onChange={(e) => {
                if (e.target.value.trim())
                  onChange({
                    ...project,
                    captions: project.captions.map((c) =>
                      c.id === caption.id ? { ...c, text: e.target.value } : c,
                    ),
                  });
              }}
            />
          </label>
          <p className="field-hint">
            Keep each caption short. Preview and video show up to four readable
            lines; SRT keeps the complete wording.
          </p>
          <div className="form-grid">
            <MediaNumber
              label="Caption begins (seconds)"
              value={caption.start}
              max={caption.end - 0.01}
              onChange={(start) =>
                onChange({
                  ...project,
                  captions: project.captions.map((c) =>
                    c.id === caption.id ? { ...c, start } : c,
                  ),
                })
              }
            />
            <MediaNumber
              label="Caption ends (seconds)"
              value={caption.end}
              min={caption.start + 0.01}
              max={
                project.scenes.find((s) => s.id === caption.sceneId)!.duration
              }
              onChange={(end) =>
                onChange({
                  ...project,
                  captions: project.captions.map((c) =>
                    c.id === caption.id ? { ...c, end } : c,
                  ),
                })
              }
            />
          </div>
          <button
            className="button text small"
            onClick={() => {
              if (
                onChange({
                  ...project,
                  captions: project.captions.filter((c) => c.id !== caption.id),
                })
              )
                setSelected("");
            }}
          >
            Remove caption
          </button>
        </>
      )}
      <div className="form-grid">
        <MediaNumber
          label="Caption text size"
          value={project.captionStyle.fontSize}
          min={18}
          max={32}
          step={1}
          onChange={(fontSize) =>
            onChange({
              ...project,
              captionStyle: { ...project.captionStyle, fontSize },
            })
          }
        />
        <label>
          Caption position
          <select
            value={project.captionStyle.position}
            onChange={(e) =>
              onChange({
                ...project,
                captionStyle: {
                  ...project.captionStyle,
                  position: e.target.value as "top" | "bottom",
                },
              })
            }
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </label>
        <label>
          Caption text color
          <select
            value={project.captionStyle.color}
            onChange={(e) =>
              onChange({
                ...project,
                captionStyle: {
                  ...project.captionStyle,
                  color: e.target.value as "#ffffff" | "#ffe6a1",
                },
              })
            }
          >
            <option value="#ffffff">White on dark</option>
            <option value="#ffe6a1">Warm yellow on dark</option>
          </select>
        </label>
      </div>
      <button
        className="button secondary"
        onClick={() =>
          downloadBlob(
            new Blob([srt(project)], {
              type: "application/x-subrip;charset=utf-8",
            }),
            `${safeFilename(project.title)}.srt`,
          )
        }
      >
        Download SRT subtitles
      </button>
    </section>
  );
}
