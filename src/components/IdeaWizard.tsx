import { useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_IDEA, localStoryProvider, STARTERS } from "../planner";
import type { IdeaInput, Project } from "../model";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

export function IdeaWizard({
  onClose,
  onCreate,
  starterId,
}: {
  onClose: () => void;
  onCreate: (p: Project) => void;
  starterId?: string;
}) {
  const starter = STARTERS.find((s) => s.id === starterId);
  const [input, setInput] = useState<IdeaInput>({
    ...DEFAULT_IDEA,
    ...(starter
      ? { idea: starter.idea, title: starter.title, lesson: starter.lesson }
      : {}),
  });
  const [proposal, setProposal] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const field = <K extends keyof IdeaInput>(key: K, value: IdeaInput[K]) =>
    setInput((i) => ({ ...i, [key]: value }));
  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setProposal(await localStoryProvider.plan(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        proposal
          ? "Your story has a beginning!"
          : "Every cartoon starts with a little idea."
      }
      onClose={onClose}
      wide
    >
      <div className="wizard-progress">
        <span className="active">
          <i>1</i> Your spark
        </span>
        <span className={proposal ? "active" : ""}>
          <i>2</i> Story outline
        </span>
        <span>
          <i>3</i> Make it yours
        </span>
      </div>
      {!proposal ? (
        <form onSubmit={generate} className="wizard-form">
          <label className="big-label">
            What’s your story idea?
            <textarea
              autoFocus
              required
              maxLength={6000}
              rows={4}
              placeholder="A shy little cloud wants to join the rainbow…"
              value={input.idea}
              onChange={(e) => field("idea", e.target.value)}
            />
          </label>
          <p className="field-hint">
            A sentence is plenty. You can change every part of your story later.
          </p>
          <div className="form-grid">
            <label>
              Cartoon title
              <input
                maxLength={160}
                placeholder="My little big story"
                value={input.title}
                onChange={(e) => field("title", e.target.value)}
              />
            </label>
            <label>
              Character names{" "}
              <span className="label-note">separated by commas</span>
              <input
                maxLength={330}
                value={input.names}
                onChange={(e) => field("names", e.target.value)}
              />
            </label>
            <label>
              Where does it happen?
              <input
                maxLength={300}
                value={input.setting}
                onChange={(e) => field("setting", e.target.value)}
              />
            </label>
            <label>
              A little lesson to share
              <input
                maxLength={500}
                value={input.lesson}
                onChange={(e) => field("lesson", e.target.value)}
              />
            </label>
            <label>
              Story mood
              <select
                value={input.mood}
                onChange={(e) =>
                  field("mood", e.target.value as IdeaInput["mood"])
                }
              >
                <option value="gentle">Gentle & kind</option>
                <option value="funny">Funny</option>
                <option value="adventurous">Adventurous</option>
                <option value="magical">Magical</option>
                <option value="educational">Educational</option>
              </select>
            </label>
            <label>
              Made for ages
              <select
                value={input.targetAge}
                onChange={(e) => field("targetAge", e.target.value)}
              >
                <option>4–7</option>
                <option>7–10</option>
                <option>All ages</option>
              </select>
            </label>
          </div>
          <details className="more-options">
            <summary>A few more creative choices</summary>
            <div className="form-grid">
              <label>
                Art direction
                <input
                  maxLength={100}
                  value={input.artStyle}
                  onChange={(e) => field("artStyle", e.target.value)}
                />
              </label>
              <label>
                Episode goal
                <select
                  value={input.plannedMinutes}
                  onChange={(e) =>
                    field("plannedMinutes", Number(e.target.value))
                  }
                >
                  <option value={1}>1 minute</option>
                  <option value={3}>3 minutes</option>
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={20}>20 minutes</option>
                </select>
              </label>
            </div>
            <p className="field-hint">
              Art direction and mood are planning notes. This starter uses
              original shape characters and six scenes (about one minute). Add
              scenes over time to reach your episode goal.
            </p>
          </details>
          <div className="local-note">
            <Icon name="lock" size={18} />
            <span>
              Planned with editable local templates. Your idea stays in this
              browser.
            </span>
          </div>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Maybe later
            </button>
            <button className="button primary" type="submit" disabled={busy}>
              <Icon name="sparkles" />
              {busy ? "Making an outline…" : "Find my story"}
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </form>
      ) : (
        <div className="outline-preview">
          <p className="section-description">
            Here’s a starting shape for <strong>{proposal.title}</strong>. Make
            it sound like you.
          </p>
          {(["beginning", "conflict", "response", "ending"] as const).map(
            (key, i) => (
              <label className="outline-row" key={key}>
                <span className={`step-number step-${i}`}>{i + 1}</span>
                <span>
                  <strong>
                    {
                      [
                        "The beginning",
                        "A little challenge",
                        "A helpful response",
                        "The happy takeaway",
                      ][i]
                    }
                  </strong>
                  <textarea
                    maxLength={6000}
                    rows={2}
                    value={proposal.outline[key]}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        outline: { ...proposal.outline, [key]: e.target.value },
                      })
                    }
                  />
                </span>
              </label>
            ),
          )}
          <p className="field-hint">
            Your outline is saved as a planning note. Scene narration is edited
            separately in the storyboard.
          </p>
          <div className="local-note">
            <Icon name="film" size={18} />
            <span>
              Six editable scenes, two original characters, and room for your
              imagination.
            </span>
          </div>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setProposal(null)}
            >
              <Icon name="back" />
              Edit my idea
            </button>
            <button
              className="button primary"
              onClick={() => onCreate(proposal)}
            >
              Create my storyboard
              <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
