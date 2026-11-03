import { useState } from "react";
import type { Project, Scene } from "../model";
import { durationLabel } from "../model";
import { CHAPTERS } from "../story-model";
import type { ChapterId } from "../story-model";
import {
  chapterSummary,
  chapterDrafts,
  insertDrafts,
  planningProgress,
} from "../story";
import { sceneStart } from "../timeline";
import { Modal } from "./Modal";

export function StoryOverview({
  project,
  selected,
  onChange,
  onScene,
  onClose,
}: {
  project: Project;
  selected: number;
  onChange: (p: Project) => void;
  onScene: (i: number) => void;
  onClose: () => void;
}) {
  const [chapter, setChapter] = useState<ChapterId>("exploration"),
    [count, setCount] = useState(3),
    [duration, setDuration] = useState(20),
    [after, setAfter] = useState(selected);
  const [drafts, setDrafts] = useState<Scene[]>([]),
    [error, setError] = useState("");
  const progress = planningProgress(project);
  function generate() {
    try {
      setDrafts(chapterDrafts(project, chapter, count, duration));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function add() {
    try {
      const p = insertDrafts(project, drafts, after);
      onChange(p);
      setDrafts([]);
      setAfter(after + drafts.length);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function editDraft(i: number, patch: Partial<Scene>) {
    setDrafts((ds) => ds.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  }
  return (
    <Modal title="Story chapters & running time" onClose={onClose} wide>
      <p className="section-description">
        Build a longer story one manageable chapter at a time. Scenes play in
        their numbered order.
      </p>
      <div className="story-planning">
        <strong>
          {project.scenes.length} scenes · {durationLabel(progress.seconds)} on
          the storyboard
        </strong>
        <label>
          Target story length
          <select
            value={project.plannedMinutes}
            onChange={(e) =>
              onChange({ ...project, plannedMinutes: Number(e.target.value) })
            }
          >
            {[...new Set([1, 3, 5, 15, 20, project.plannedMinutes])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {n} minute{n === 1 ? "" : "s"}
                </option>
              ))}
          </select>
        </label>
        <progress
          aria-label="Story duration toward planning goal"
          value={progress.percent}
          max={100}
        />
        <p className="field-hint">
          {durationLabel(progress.remaining)} left toward your goal. A target
          and generated notes are planning tools; they do not create finished
          speech or footage.
        </p>
      </div>
      <div className="chapter-overview">
        {chapterSummary(project).map((group) => (
          <section key={group.id}>
            <h3>
              {group.label}{" "}
              <small>
                {durationLabel(
                  group.scenes.reduce((n, item) => n + item.scene.duration, 0),
                )}
              </small>
            </h3>
            <p className="field-hint">{group.prompt}</p>
            <ol>
              {group.scenes.map(({ scene, index }) => (
                <li key={scene.id}>
                  <button
                    className="chapter-scene"
                    aria-current={index === selected ? "step" : undefined}
                    onClick={() => onScene(index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{scene.title}</strong>
                    <small>
                      {durationLabel(sceneStart(project, index))} ·{" "}
                      {scene.duration}s
                    </small>
                  </button>
                </li>
              ))}
            </ol>
            {!group.scenes.length && (
              <p className="field-hint">Ready for a new moment.</p>
            )}
          </section>
        ))}
      </div>
      <section className="batch-scenes">
        <h3>Add scenes from editable notes</h3>
        <div className="form-grid">
          <label>
            Chapter for new scenes
            <select
              value={chapter}
              onChange={(e) => setChapter(e.target.value as ChapterId)}
            >
              {CHAPTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scenes in this batch
            <input
              type="number"
              min={1}
              max={12}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <label>
            Seconds per new scene
            <input
              type="number"
              min={2}
              max={120}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
            />
          </label>
          <label>
            Insert new scenes
            <select
              value={after}
              onChange={(e) => setAfter(Number(e.target.value))}
            >
              <option value={-1}>Before scene 1</option>
              {project.scenes.map((s, i) => (
                <option key={s.id} value={i}>
                  After scene {i + 1}: {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="button secondary"
          onClick={generate}
          disabled={project.scenes.length >= 120}
        >
          Prepare scene notes
        </button>
        {!!drafts.length && (
          <div className="batch-preview">
            <p className="local-note">
              Review these {drafts.length} new scenes before adding them.
              Existing artwork, animation and scene audio stay intact.
              Episode-wide audio keeps its absolute timing; review it after
              inserting scenes.
            </p>
            {drafts.map((s, i) => (
              <fieldset key={s.id}>
                <legend>
                  New scene {i + 1} · {s.duration}s
                </legend>
                <label>
                  New scene {i + 1} title
                  <input
                    maxLength={160}
                    value={s.title}
                    onChange={(e) =>
                      editDraft(i, {
                        title: e.target.value || "Untitled scene",
                      })
                    }
                  />
                </label>
                <label>
                  New scene {i + 1} narration
                  <textarea
                    rows={2}
                    maxLength={6000}
                    value={s.narration}
                    onChange={(e) =>
                      editDraft(i, { narration: e.target.value })
                    }
                  />
                </label>
                <label>
                  New scene {i + 1} dialogue
                  <textarea
                    rows={2}
                    maxLength={6000}
                    value={s.dialogue}
                    onChange={(e) => editDraft(i, { dialogue: e.target.value })}
                  />
                </label>
                <label>
                  New scene {i + 1} learning question
                  <input
                    maxLength={500}
                    value={s.question ?? ""}
                    onChange={(e) => editDraft(i, { question: e.target.value })}
                  />
                </label>
              </fieldset>
            ))}
            <div className="animation-actions">
              <button
                className="button secondary"
                onClick={() => setDrafts([])}
              >
                Cancel batch
              </button>
              <button className="button primary" onClick={add}>
                Add {drafts.length} reviewed scenes
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="error-message">
            {error}
          </p>
        )}
      </section>
      <div className="modal-actions">
        <button className="button primary" onClick={onClose}>
          Back to storyboard
        </button>
      </div>
    </Modal>
  );
}
