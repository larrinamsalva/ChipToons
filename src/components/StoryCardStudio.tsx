import { useEffect, useState } from "react";
import { listLibrary } from "../library";
import type { LibraryItem } from "../library";
import { BACKGROUNDS, totalDuration } from "../model";
import type { Project } from "../model";
import type { SeriesPlan } from "../series";
import { listSeries } from "../series-storage";
import { CHAPTERS } from "../story-model";
import { applyPresentation, defaultCardOptions, episodePresentation, newStoryCard, reviewStoryCard } from "../story-card-studio";
import type { CardOptions } from "../story-card-studio";
import { CARD_SOUNDS, CREDIT_ROLES, MAX_STORY_CREDITS, minimumCreditTime, STORY_CARD_KINDS, STORY_CARD_STUDIO } from "../story-card-model";
import type { RecapPoint, StoryCard, StoryCardKind, StoryCredit } from "../story-card-model";
import { storyCardLayout } from "../story-card-layout";
import { MediaNumber } from "./MediaNumber";
import { Modal } from "./Modal";
import { ScenePreview } from "./ScenePreview";
import { StoryCardStyleFields } from "./StoryCardStyleFields";

const creditFields = { role: "Credit role (optional)", name: "Name or source to publish",
  license: "License name (optional)", url: "Source or license URL (optional)" } as const;
const blankCredit = (role = ""): StoryCredit => ({ role, name: "", license: "", url: "" });
const emptyPoint: RecapPoint = { text: "" };
const seconds = (value: number) => Number(value.toFixed(2));

export function StoryCardStudio({ project, selected, onClose, onApply, onScript }: {
  project: Project; selected: number; onClose: () => void;
  onApply: (project: Project, index: number) => void; onScript: (project: Project, index: number) => void;
}) {
  const selectedScene = project.scenes[selected];
  const [sceneId, setSceneId] = useState(selectedScene.storyCard ? selectedScene.id : "");
  const [card, setCard] = useState(() => selectedScene.storyCard ?? newStoryCard(project, "opening"));
  const [options, setOptions] = useState<CardOptions>(() => ({ ...defaultCardOptions(project, card.kind, selected),
    ...(sceneId ? { duration: selectedScene.duration, chapter: selectedScene.chapter ?? "closing" } : {}) }));
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [series, setSeries] = useState<SeriesPlan[]>([]);
  const [sourceNotice, setSourceNotice] = useState("");
  const [review, setReview] = useState<ReturnType<typeof reviewStoryCard>>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.allSettled([listLibrary(), listSeries()]).then(([art, plans]) => {
      if (!active) return;
      if (art.status === "fulfilled") setLibrary(art.value.filter(item => item.kind === "background"));
      if (plans.status === "fulfilled") setSeries(plans.value.map(item => item.plan));
      if (art.status === "rejected" || plans.status === "rejected") setSourceNotice("Some saved art or series suggestions are unavailable. You can still finish this cartoon.");
    });
    return () => { active = false; };
  }, []);
  const metadata = episodePresentation(project, series);
  const source = project.scenes.find(scene => scene.id === sceneId);
  const points = project.scenes.flatMap(scene => (scene.learningSteps ?? []).map(step =>
    ({ value: step.id, text: step.text, sceneId: scene.id, title: scene.title })));
  const draft = { ...card, points: card.points.filter(point => point.text.trim()),
    credits: card.credits.filter(credit => credit.name.trim() || credit.license.trim() || credit.url.trim()) };
  const total = totalDuration(project);
  const extra = options.duration - (source?.duration ?? 0);
  const preview = review?.project.scenes[review.index];
  const layout = preview && review ? storyCardLayout(review.project, preview, draft) : undefined;
  const designIssue = layout?.clipped ? "This card is too full for the safe area. Shorten the text, use smaller type, or choose scrolling credits." :
    layout && layout.contrast < 4.5 ? "Choose text and card colors with stronger contrast." : "";
  const needsReview = card.points.some(point => point.source && !points.some(step =>
    step.value === point.source?.stepId && step.sceneId === point.source.sceneId && step.text.slice(0, 140) === point.text));

  function resetReview() { setReview(undefined); setError(""); }
  function change(patch: Partial<StoryCard>) { setCard(current => ({ ...current, ...patch })); resetReview(); }
  function settings(patch: Partial<CardOptions>) { setOptions(current => ({ ...current, ...patch })); resetReview(); }

  function choose(kind: StoryCardKind, id = "", preset = false) {
    const saved = project.scenes.find(scene => scene.id === id);
    let next = saved?.storyCard ?? newStoryCard(project, kind, metadata);
    let setup = defaultCardOptions(project, next.kind, selected);
    if (saved) setup = { ...setup, duration: saved.duration, chapter: saved.chapter ?? setup.chapter, background: saved.background };
    if (preset && metadata.defaults) {
      next = applyPresentation(next, metadata.defaults);
      if (kind === "credits" && !next.credits.length) next.credits = metadata.defaults.roles.map(blankCredit);
      setup = { ...setup, duration: Math.max(setup.duration, minimumCreditTime(next)),
        artwork: library.find(item => item.id === metadata.defaults?.artId),
        sound: kind === "opening" ? metadata.defaults.sound : "" };
    }
    setSceneId(id); setCard(next); setOptions(setup); resetReview();
  }

  function previewCard() {
    setError(""); setReview(undefined);
    try { setReview(reviewStoryCard(project, draft, options, sceneId || undefined)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This card could not be added."); }
  }

  function editPoint(index: number, value: RecapPoint) {
    change({ points: card.points.map((point, i) => i === index ? value : point) });
  }

  return <Modal title={STORY_CARD_STUDIO} onClose={onClose} wide>
    <p>Add an optional opening, chapter marker, or ending. Each saved card becomes an editable storyboard scene.</p>
    <div className="interaction-layout story-card-studio">
      <div className="interaction-controls">
        {project.scenes.some(scene => scene.storyCard) && <label>Edit a saved story card
          <select value={sceneId} onChange={event => choose(card.kind, event.target.value)}>
            <option value="">Add a new story card</option>
            {project.scenes.filter(scene => scene.storyCard).map(scene => <option key={scene.id} value={scene.id}>{scene.title}</option>)}
          </select>
        </label>}
        {!sceneId && <label>What would you like to add?<select value={card.kind}
          onChange={event => choose(event.target.value as StoryCardKind)}>
          {Object.entries(STORY_CARD_KINDS).map(([id, title]) => <option key={id} value={id}>Add {title}</option>)}
        </select></label>}
        {metadata.series && <p className="field-hint">{metadata.series}{metadata.number ? ` · Episode ${metadata.number}` : ""}</p>}
        {!sceneId && metadata.series && (card.kind === "opening" || card.kind === "episode") &&
          <button className="button secondary small" onClick={() => {
            const next = newStoryCard(project, card.kind, metadata);
            change({ title: next.title, eyebrow: next.eyebrow });
          }}>Use episode information</button>}
        {!sceneId && metadata.defaults && <div className="director-actions">
          <button className="button secondary small" onClick={() => choose(card.kind, "", true)}>Review series card defaults</button>
          <button className="button secondary small" onClick={() => choose(metadata.defaults?.ending === "thanks" ? "thanks" : "credits", "", true)}>
            Review series ending suggestion</button>
        </div>}
        {sourceNotice && <p role="status">{sourceNotice}</p>}
        <label>Card title<input maxLength={140} value={card.title} onChange={event => change({ title: event.target.value })} /></label>
        <label>Series title or episode number (optional)<input maxLength={90} value={card.eyebrow}
          onChange={event => change({ eyebrow: event.target.value })} /></label>
        <label>Short subtitle (optional)<textarea maxLength={165} value={card.subtitle}
          onChange={event => change({ subtitle: event.target.value })} /></label>
        {!sceneId && <label>Place card<select value={options.after} onChange={event => settings({ after: Number(event.target.value) })}>
          <option value={-1}>Before the first scene</option>
          {project.scenes.map((scene, index) => <option key={scene.id} value={index}>After {index + 1}. {scene.title}</option>)}
        </select></label>}
        <label>Story chapter<select value={options.chapter} onChange={event => settings({ chapter: event.target.value as CardOptions["chapter"] })}>
          {CHAPTERS.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.label}</option>)}
        </select></label>
        {card.kind === "chapter" && <button className="button secondary small"
          onClick={() => change({ title: CHAPTERS.find(chapter => chapter.id === options.chapter)!.label })}>Use chapter name</button>}
        <MediaNumber label="Display time (seconds)" min={2} max={120} value={options.duration} onChange={duration => settings({ duration })} />
        <label>Stage background<select value={options.background}
          onChange={event => settings({ background: event.target.value as CardOptions["background"] })}>
          {BACKGROUNDS.map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        {!!library.length && <label>Saved background art<select value={options.artwork?.id ?? ""}
          onChange={event => settings({ artwork: library.find(item => item.id === event.target.value) })}>
          <option value="">Keep the scene background</option>
          {library.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>}
        {!sceneId && (card.kind === "opening" || card.kind === "thanks") && project.characters.length > 0 &&
          <label className="world-check"><input type="checkbox" checked={options.cast}
            onChange={event => settings({ cast: event.target.checked })} />
            {card.kind === "opening" ? "Welcome with my characters" : "Say goodbye with my characters"}</label>}
        <label>Add an original sound<select value={options.sound}
          onChange={event => settings({ sound: event.target.value as CardOptions["sound"] })}>
          <option value="">Add no sound</option>
          {Object.entries(CARD_SOUNDS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label>
        <details className="focus-appearance"><summary>Change the card’s look</summary>
          <StoryCardStyleFields style={card.style} onChange={style => change({ style })} />
        </details>
        {card.kind === "recap" && <fieldset className="story-card-entries">
          <legend>Learning points</legend>
          <p>Use up to three short ideas. A suggested step is a copy you can edit.</p>
          {needsReview && <p role="status">A linked learning step changed or was removed. Your saved words are still here.</p>}
          {card.points.map((point, i) => <div className="story-card-entry" key={i}>
            <label>Learning point {i + 1}<textarea value={point.text} maxLength={140}
              onChange={event => editPoint(i, { text: event.target.value })} /></label>
            {!!points.length && <label>Suggest words for point {i + 1}<select value={point.source?.stepId ?? ""}
              onChange={event => {
                const step = points.find(step => step.value === event.target.value);
                editPoint(i, step ? { text: step.text.slice(0, 140), source: { sceneId: step.sceneId, stepId: step.value } } : { text: point.text });
              }}>
              <option value="">Write my own</option>
              {point.source && !points.some(step => step.value === point.source?.stepId) &&
                <option value={point.source.stepId}>Previously linked step</option>}
              {points.map(step => <option key={step.value} value={step.value}>{step.title} · {step.text.slice(0, 90)}</option>)}
            </select></label>}
            <button className="button text small" onClick={() => change({ points: card.points.filter((_, index) => index !== i) })}>Remove point {i + 1}</button>
          </div>)}
          <button className="button secondary small" disabled={card.points.length >= 3}
            onClick={() => change({ points: [...card.points, emptyPoint] })}>Add learning point</button>
        </fieldset>}
        {card.kind === "credits" && <fieldset className="story-card-entries">
          <legend>Credits to publish</legend>
          <p>Publish only the names and sources you enter here. Credit records attribution. Use material you have permission to include.</p>
          <label className="world-check"><input type="checkbox" checked={card.scroll} onChange={event => change({ scroll: event.target.checked })} />
            Scroll the credits slowly</label>
          {card.scroll && <p className="field-hint">Allow at least {Math.ceil(minimumCreditTime(draft))} seconds.</p>}
          {card.credits.map((row, i) => <div className="story-card-entry" key={i}>
            <p>Credit {i + 1}</p>
            <label>Suggested role for credit {i + 1}<select value={CREDIT_ROLES.find(role => role === row.role) ?? ""}
              onChange={event => change({ credits: card.credits.map((credit, index) => index === i ? { ...credit, role: event.target.value } : credit) })}>
              <option value="">Custom or no role</option>
              {CREDIT_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
            </select></label>
            {(Object.entries(creditFields) as [keyof StoryCredit, string][]).map(([key, label]) => <label key={key}>{label} · {i + 1}
              <input maxLength={{ role: 45, name: 105, license: 80, url: 125 }[key]} value={row[key]}
                onChange={event => change({ credits: card.credits.map((credit, index) => index === i ? { ...credit, [key]: event.target.value } : credit) })} />
            </label>)}
            <button className="button text small" onClick={() => change({ credits: card.credits.filter((_, index) => index !== i) })}>Remove credit {i + 1}</button>
          </div>)}
          <button className="button secondary small" disabled={card.credits.length >= MAX_STORY_CREDITS}
            onClick={() => change({ credits: [...card.credits, blankCredit()] })}>Add credit</button>
        </fieldset>}
      </div>
      <div className="interaction-review">
        <div className="story-card-runtime" role="group" aria-label="Running time review">
          <strong>{seconds(total + extra)} seconds after this edit</strong>
          <span>{seconds(total)} seconds now · {extra < 0 ? "Remove" : "Add"} {seconds(Math.abs(extra))} seconds</span>
          <small>{sceneId ? "Edit this existing card in place." : options.after < 0 ? "Place before the first scene." : `Place after scene ${options.after + 1}.`}</small>
        </div>
        <button className="button secondary" onClick={previewCard}>Preview Card</button>
        {error && <p className="interaction-empty" role="alert">{error}</p>}
        {designIssue && <p className="interaction-empty" role="status">{designIssue}</p>}
        {review && preview && <ScenePreview project={review.project} scene={preview} initialTime={Math.min(0.9, preview.duration)}
          precision={2} showCaptions captionGuide soundPreview={review.project.audioClips.length > 0} />}
        <p className="field-hint">Card text stays visible in the movie. Use Script Director to record a line or add its spoken captions.</p>
      </div>
    </div>
    <div className="modal-actions">
      <button className="button secondary" onClick={onClose}>Cancel</button>
      <button className="button secondary" disabled={!review || !!designIssue} onClick={() => review && onScript(review.project, review.index)}>
        Apply &amp; open Script Director</button>
      <button className="button primary" disabled={!review || !!designIssue} onClick={() => review && onApply(review.project, review.index)}>Apply Card</button>
    </div>
  </Modal>;
}
