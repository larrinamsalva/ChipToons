import { useEffect, useState } from "react";
import type { Project, Scene } from "../model";
import { durationLabel, totalDuration, uid, validateProject } from "../model";
import { missingAudio } from "../audio-vault";
import { downloadBlob, safeFilename } from "../files";
import { chapterOf } from "../story";
import { CHAPTERS } from "../story-model";
import { directScene, directionFromScript, scriptSuggestions } from "../assistant";
import {
  blankLine, chooseScriptTake, lineStatus, recordingNeedsRoom, scriptCaptions, scriptFor, scriptText, scriptTiming,
  selectedTake, setLineApproval, withScript,
} from "../script";
import { DEFAULT_SCRIPT, MAX_SCRIPT_LINES } from "../script-model";
import type { SceneScript, ScriptLine } from "../script-model";
import { ArtThumbnail } from "./ArtLibrary";
import type { LibraryItem } from "../library";
import { ScenePreview } from "./CartoonAssistant";
import { OriginalAudio } from "./VoiceStudio";
import { VoiceCastFields } from "./VoiceCastFields";
import { Modal } from "./Modal";
import { MediaNumber } from "./MediaNumber";

const filters = ["All lines", "Narration", "Character dialogue", "Missing recordings", "Needs review", "Approved lines"] as const;
type Filter = (typeof filters)[number];

const shortTime = (seconds: number) => durationLabel(Math.round(seconds));
const speakerName = (project: Project, line: ScriptLine) => line.kind === "narration" ? "Narrator"
  : project.characters.find(character => character.id === line.speakerId)?.name ?? "Unassigned speaker";

export function ScriptDirector({ project, index, selected, onSelect, onSelectScene, onChange, onScene, onClose,
  onRecord, onTiming, onCaptions, onUndo, onRedo, canUndo, canRedo, saveStatus, saveError }: {
  project: Project; index: number; selected: string; onSelect: (id: string) => void;
  onSelectScene: (index: number) => void;
  onChange: (project: Project) => void; onScene: (patch: Partial<Scene>) => void; onClose: () => void;
  onRecord: (id: string) => void; onTiming: (clipId?: string) => void; onCaptions: () => void;
  onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean; saveStatus: string; saveError: string;
}) {
  const scene = project.scenes[index];
  const script = scene.script;
  const options = project.scriptOptions ?? DEFAULT_SCRIPT;
  const lines = script?.lines ?? [];
  const [filter, setFilter] = useState<Filter>("All lines");
  const [preview, setPreview] = useState<{ original: Scene; proposed: Scene }>();
  const [issue, setIssue] = useState("");
  const [notice, setNotice] = useState("");
  const [remove, setRemove] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [previewTake, setPreviewTake] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [inventory, setInventory] = useState<{ assets: Project["audioAssets"]; missing: Set<string> }>();
  const assets = project.audioAssets;
  useEffect(() => {
    let active = true;
    void missingAudio({ audioAssets: assets }).then(ids => {
      if (active) setInventory({ assets, missing: new Set(ids) });
    }).catch(() => {
      if (active) setInventory({ assets, missing: new Set(assets.filter(asset => asset.file).map(asset => asset.id)) });
    });
    return () => { active = false; };
  }, [assets]);
  const unavailable = inventory?.assets === assets ? inventory.missing : undefined;
  const line = lines.find(item => item.id === selected) ?? lines[0];
  const { clip } = line ? selectedTake(project, line) : { clip: undefined };
  const recordingReady = saveStatus === "Saved on this device";
  const stateOf = (item: ScriptLine) => {
    const { clip } = selectedTake(project, item);
    if (clip && !recordingReady) return saveError ? "Needs review" : "Waiting for local save";
    if (clip && !unavailable && assets.some(asset => asset.id === clip.assetId && asset.file)) return "Checking recording";
    return lineStatus(project, item, unavailable);
  };
  const allLines = project.scenes.flatMap(item => item.script?.lines ?? []);
  const approved = allLines.filter(item => stateOf(item) === "Approved").length;
  const open = project.scenes.flatMap((item, sceneIndex) => (item.script?.lines ?? [])
    .filter(line => ["Not recorded", "Needs review"].includes(stateOf(line)))
    .map(line => ({ sceneIndex, line })));
  const totals = project.scenes.map(item => scriptTiming(project, item)).reduce(
    (sum, item) => ({ words: sum.words + item.words, speech: sum.speech + item.speech, pauses: sum.pauses + item.pauses }),
    { words: 0, speech: 0, pauses: 0 },
  );
  const actual = totalDuration(project);
  const difference = totals.speech + totals.pauses - actual;
  const timing = scriptTiming(project, scene);
  const selectedCharacter = project.characters.find(character => character.id === line?.speakerId);
  const voiceCharacter = project.characters.find(character => character.id === voiceId) ?? selectedCharacter ?? project.characters[0];
  const thumbnail: LibraryItem | undefined = selectedCharacter && {
    id: selectedCharacter.id, name: selectedCharacter.name, kind: "character",
    character: selectedCharacter, assets: project.assets, emotion: "calm", pose: "standing",
    version: 1, transform: {}, tags: [], group: "", updatedAt: project.updatedAt,
  };
  const selectedAudio = assets.find(item => item.id === (line?.takes.some(take => take.assetId === previewTake) ? previewTake : clip?.assetId));
  const filtered = lines.filter(item => {
    if (filter === "Narration") return item.kind === "narration";
    if (filter === "Character dialogue") return item.kind === "dialogue";
    if (filter === "Missing recordings") return stateOf(item) === "Not recorded" ||
      (!item.clipId && !!item.takes.length) || unavailable?.has(selectedTake(project, item).clip?.assetId ?? "");
    if (filter === "Needs review") return stateOf(item) === "Needs review";
    if (filter === "Approved lines") return stateOf(item) === "Approved";
    return true;
  });
  const suggestions = scriptSuggestions(project, scene, index).filter((suggestion, i) =>
    !dismissed.includes(`${scene.id}:${suggestion.kind}`) &&
    !lines.some(line => line.text === suggestion.text && line.kind === suggestion.kind) &&
    (i !== 0 || scene.narration !== suggestion.text));

  function commit(next: Project) {
    try {
      validateProject(next);
      onChange(next);
      setIssue("");
      return true;
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "This script edit could not be saved.");
      return false;
    }
  }

  function saveScript(next: SceneScript, clipId?: string, nextLine?: string) {
    const saved = commit({ ...project, scenes: project.scenes.map(item => item.id === scene.id ? withScript(scene, next) : item),
      audioClips: clipId ? project.audioClips.filter(item => item.id !== clipId) : project.audioClips });
    if (saved && nextLine) onSelect(nextLine);
    return saved;
  }

  function changeLine(patch: Partial<ScriptLine>) {
    if (!script || !line) return;
    const next = { ...line, ...patch };
    if (next.kind === "narration") next.speakerId = undefined;
    commit({ ...project,
      scenes: project.scenes.map(item => item.id === scene.id
        ? withScript(scene, { ...script, lines: lines.map(item => item.id === line.id ? next : item) }) : item),
      audioClips: project.audioClips.map(item => item.id === line.clipId
        ? { ...item, category: next.kind, characterId: next.speakerId } : item),
    });
  }

  function addLine(item: ScriptLine) {
    const current = scriptFor(scene);
    saveScript({ ...current, lines: [...current.lines, item] }, undefined, item.id);
    setFilter("All lines");
  }

  function moveLine(offset: number) {
    if (!script || !line) return;
    const order = [...lines], from = order.indexOf(line);
    order.splice(from, 1);
    order.splice(from + offset, 0, line);
    saveScript({ ...script, lines: order });
  }

  function reviewActing() {
    try {
      const suggestion = directionFromScript(project, scene, line);
      if (!suggestion) {
        setNotice("Try a specific cue such as “waves hello” or “listens calmly” for a supported character on an unused animation track.");
        return;
      }
      setNotice("");
      setPreview({ original: scene, proposed: directScene(project, scene, suggestion, true) });
    } catch (error) {
      setIssue(error instanceof Error ? error.message : "This acting suggestion is unavailable.");
    }
  }

  const selectLine = (id: string) => {
    onSelect(id);
    setPreviewTake("");
    setRemove("");
  };

  return <Modal title="Write My Episode Script" onClose={() => { if (!busy) onClose(); }} wide>
    <div className="director">
      <p>{options.seriesTitle && <>{options.seriesTitle} · </>}<strong>{project.title}</strong></p>
      <p role="status">{busy ? "Preparing sample audio…" : saveStatus}</p>
      {saveError && <p role="alert">{saveError}</p>}
      {issue && <p role="alert">{issue}</p>}
      {notice && <p role="status">{notice}</p>}
      <div className="director-actions">
        <button className="button secondary" disabled={!canUndo || busy} onClick={onUndo}>Undo script edit</button>
        <button className="button secondary" disabled={!canRedo || busy} onClick={onRedo}>Redo script edit</button>
        <button className="button secondary" onClick={() => downloadBlob(
          new Blob([scriptText(project)], { type: "text/plain;charset=utf-8" }), `${safeFilename(project.title)}.script.txt`)}>Download script</button>
      </div>
      <p className="field-hint">The script download is for reading or printing. Use Project backup to keep editable scenes and recordings.</p>
      <section className="director-card" aria-label="Episode script timing">
        <strong>{project.scenes.length} scenes · {totals.words} words · {shortTime(totals.speech)} estimated speech · {shortTime(totals.pauses)} pauses</strong>
        <p>{shortTime(actual)} storyboard · {shortTime(Math.abs(difference))} {difference > 0 ? "over" : "under"} storyboard time · {project.plannedMinutes} min goal</p>
        <p>{approved} of {allLines.length} written lines approved</p>
        <details>
          <summary>Adjust pacing estimates</summary>
          <p>Estimated speech divides written words by your reading rate. Pauses are added separately. Record and listen to check actual timing.</p>
          <div className="form-grid">
            <MediaNumber label="Words per minute" min={60} max={240} value={options.pace}
              onChange={pace => commit({ ...project, scriptOptions: { ...options, pace } })} />
            <MediaNumber label="Default pause after a line (seconds)" min={0} max={20} value={options.pause}
              onChange={pause => commit({ ...project, scriptOptions: { ...options, pause } })} />
          </div>
        </details>
      </section>
      <fieldset disabled={busy} className="director-fields">
        <legend className="visually-hidden">Script and recording checklist</legend>
        <div className="form-grid">
          <label>Script scene<select value={scene.id} onChange={event => {
            selectLine(""); setPreview(undefined);
            onSelectScene(project.scenes.findIndex(item => item.id === event.target.value));
          }}>
            {project.scenes.map((item, i) => <option key={item.id} value={item.id}>
              {i + 1}. {item.title} · {CHAPTERS.find(chapter => chapter.id === chapterOf(item, i, project.scenes.length))?.label}
            </option>)}
          </select></label>
          {!!open.length && <label>Jump to an unfinished line
            <select value="" onChange={event => {
              const target = open.find(item => item.line.id === event.target.value);
              if (!target) return;
              setFilter("All lines"); setPreview(undefined); onSelectScene(target.sceneIndex); selectLine(target.line.id);
            }}>
              <option value="">Choose a line</option>
              {open.map(item => <option key={item.line.id} value={item.line.id}>
                Scene {item.sceneIndex + 1} · {item.line.text.slice(0, 50) || "Untitled line"}
              </option>)}
            </select></label>}
        </div>
        {options.helloHeart && <div className="director-card">
          <p>Add a short A Hello Heart example with a real, original synthetic narration file and two editable dialogue lines. It adds to the first scene and keeps the words already there.</p>
          <button className="button secondary" onClick={() => {
            setBusy(true);
            void import("../hello-heart").then(module => module.addHelloHeartSample(project)).then(next => {
              if (commit(next)) { onSelectScene(0); onSelect(next.scenes[0].script?.lines[0]?.id ?? ""); setNotice("A Hello Heart sample added. Play the narrator take or preview the cartoon with sound."); }
            }).catch((error: unknown) => setIssue(error instanceof Error ? error.message : "Sample audio could not be opened."))
              .finally(() => setBusy(false));
          }}>Add A Hello Heart sample</button>
        </div>}
        <details className="director-card">
          <summary>Scene words and directing notes</summary>
          <label>Scene heading<input maxLength={160} value={scene.title} onChange={event => onScene({ title: event.target.value || "Untitled scene" })} /></label>
          <label>What happens<textarea maxLength={6000} value={scene.action} onChange={event => onScene({ action: event.target.value })} /></label>
          <label>Acting directions<textarea maxLength={1500} value={script?.acting ?? ""} onChange={event => saveScript({ ...scriptFor(scene), acting: event.target.value })} /></label>
          <label>Emotional cues<textarea maxLength={1000} value={script?.emotion ?? ""} onChange={event => saveScript({ ...scriptFor(scene), emotion: event.target.value })} /></label>
          <label>Learning question<input maxLength={500} value={scene.question ?? ""} onChange={event => onScene({ question: event.target.value })} /></label>
          <MediaNumber label="Storyboard scene duration (seconds)" min={2} max={120} value={scene.duration} onChange={duration => onScene({ duration })} />
        </details>
        {timing.total > scene.duration + Math.max(2, scene.duration * 0.15) && <p className="media-notice">
          The words and pauses for this scene may need about {shortTime(timing.total)}. The storyboard allows {shortTime(scene.duration)}. Shorten the lines or give the scene more time.
        </p>}
        <div className="director-actions">
          <button className="button primary" disabled={lines.length >= MAX_SCRIPT_LINES} onClick={() => addLine(blankLine("dialogue"))}>Add dialogue line</button>
          <button className="button secondary" disabled={lines.length >= MAX_SCRIPT_LINES} onClick={() => addLine(blankLine("narration"))}>Add narration line</button>
          {!script && (scene.narration || scene.dialogue) && <button className="button secondary"
            onClick={() => saveScript(scriptFor(scene))}>Organize existing words</button>}
        </div>
        {!script && (scene.narration || scene.dialogue) && <p className="field-hint">Organize existing words to edit the scene’s current prose as lines. Its audio and captions stay in place.</p>}
        <div className="director-workspace">
          <section aria-label="Numbered script lines" className="director-card">
            <label>Filter lines<select value={filter} onChange={event => setFilter(event.target.value as Filter)}>
              {filters.map(item => <option key={item}>{item}</option>)}
            </select></label>
            <ol className="director-lines">
              {filtered.map(item => <li key={item.id}><button type="button" className="button secondary"
                aria-current={line?.id === item.id ? "true" : undefined} onClick={() => selectLine(item.id)}>
                <strong>{lines.indexOf(item) + 1}. {speakerName(project, item)}</strong>
                <span>{item.text || "New line"}</span><small>{stateOf(item)}</small>
              </button></li>)}
            </ol>
            {!filtered.length && <p>No lines in this view.</p>}
          </section>
          {line && filtered.includes(line) && <section className="director-card" aria-label="Edit selected script line">
            <h3>Line {lines.indexOf(line) + 1} · {stateOf(line)}</h3>
            <div className="form-grid">
              <label>Line type<select value={line.kind} onChange={event => changeLine({ kind: event.target.value as ScriptLine["kind"] })}>
                <option value="narration">Narration</option><option value="dialogue">Character dialogue</option>
              </select></label>
              {line.kind === "dialogue" && <label>Line speaker<select value={line.speakerId ?? ""} onChange={event => changeLine({ speakerId: event.target.value || undefined })}>
                <option value="">Unassigned speaker</option>
                {project.characters.map((character, i) => <option value={character.id} key={character.id}>
                  {character.name} · {character.seriesCastId ? "Recurring cast" : "Episode cast"} {i + 1}
                </option>)}
              </select></label>}
            </div>
            {thumbnail && <div className="director-thumbnail"><ArtThumbnail item={thumbnail} /></div>}
            <label>Spoken words<textarea rows={4} maxLength={6000} value={line.text} onChange={event => changeLine({ text: event.target.value })} /></label>
            <label>Delivery note<input maxLength={400} value={line.delivery} onChange={event => changeLine({ delivery: event.target.value })} /></label>
            <MediaNumber label="Pause after this line (seconds)" min={0} max={20} value={line.pause ?? options.pause} onChange={pause => changeLine({ pause })} />
            <div className="director-actions">
              <button className="button secondary" disabled={lines.indexOf(line) === 0} onClick={() => moveLine(-1)}>Move line earlier</button>
              <button className="button secondary" disabled={lines.indexOf(line) === lines.length - 1} onClick={() => moveLine(1)}>Move line later</button>
              <button className="button secondary" disabled={lines.length >= MAX_SCRIPT_LINES} onClick={() => {
                const copy = { ...line, id: uid(), takes: [], clipId: undefined };
                const next = [...lines]; next.splice(lines.indexOf(line) + 1, 0, copy);
                if (script) saveScript({ ...script, lines: next }, undefined, copy.id);
              }}>Duplicate line</button>
              <button className="button secondary" onClick={() => setRemove(line.id)}>Remove line</button>
            </div>
            {remove === line.id && <div className="media-notice">
              <p>Remove these words and their selected timeline clip? Original recordings stay in this project. Undo can restore the line.</p>
              <div className="director-actions">
                <button className="button secondary" onClick={() => setRemove("")}>Keep line</button>
                <button className="button primary" onClick={() => {
                  if (script) saveScript({ ...script, lines: lines.filter(item => item.id !== line.id) }, line.clipId);
                  setRemove("");
                }}>Confirm remove line</button>
              </div>
            </div>}
            {line.takes.length > 0 && stateOf(line) === "Needs review" && <p className="media-notice">
              Review this line’s recording. The words, speaker or delivery may have changed, or the clip or original may be unavailable.
            </p>}
            {clip && recordingNeedsRoom(project, clip) &&
              <p className="media-notice">The recording may be cut off at the end of this scene. Review clip timing.</p>}
            <div className="director-actions">
              <button className="button primary" disabled={!line.text.trim()} onClick={() => onRecord(line.id)}>Record This Line</button>
              {clip && <button className="button secondary" onClick={() => onTiming(clip.id)}>Edit audio timing</button>}
            </div>
            {!!line.takes.length && <>
              <label>Listen to a take<select value={selectedAudio?.id ?? ""} onChange={event => setPreviewTake(event.target.value)}>
                <option value="">Choose a take</option>
                {line.takes.map((take, i) => <option key={take.assetId} value={take.assetId}>
                  Take {i + 1} · {assets.find(asset => asset.id === take.assetId)?.name}{clip?.assetId === take.assetId ? " (preferred)" : ""}
                </option>)}
              </select></label>
              {selectedAudio && line.takes.some(take => take.assetId === selectedAudio.id) && <>
                <OriginalAudio key={selectedAudio.id} asset={selectedAudio} />
                <div className="director-actions">
                  <button className="button secondary" disabled={selectedAudio.id === clip?.assetId || unavailable?.has(selectedAudio.id) || (!!selectedAudio.file && !unavailable)}
                    onClick={() => commit(chooseScriptTake(project, line.id, selectedAudio))}>Use this take</button>
                  {clip && selectedAudio.id === clip.assetId && <button className="button secondary"
                    disabled={!recordingReady || !!unavailable?.has(clip.assetId) || (!!selectedAudio.file && !unavailable) || clip.muted || !clip.volume || recordingNeedsRoom(project, clip)}
                    onClick={() => commit(setLineApproval(project, line.id, stateOf(line) !== "Approved"))}>
                    {stateOf(line) === "Approved" ? "Remove approval" : "Approve after listening"}
                  </button>}
                </div>
              </>}
            </>}
          </section>}
        </div>
        <details className="director-card">
          <summary>Local dialogue suggestions</summary>
          <p>These editable suggestions use local story templates and your scene’s setting, cast and lesson. Add or skip each line.</p>
          {suggestions.map(item => <div key={item.kind}>
            <p>{item.text}</p><div className="director-actions">
              <button className="button secondary" disabled={lines.length >= MAX_SCRIPT_LINES}
                onClick={() => addLine({ ...blankLine(item.kind), ...item })}>Add suggested {item.kind}</button>
              <button className="button secondary" onClick={() => setDismissed([...dismissed, `${scene.id}:${item.kind}`])}>Skip {item.kind} suggestion</button>
            </div>
          </div>)}
        </details>
        <section className="director-card" aria-label="Acting and captions">
          <div className="director-actions">
            <button className="button secondary" onClick={reviewActing}>Preview acting suggestion</button>
            <button className="button secondary" disabled={!lines.length} onClick={() => {
              const captions = scriptCaptions(project, scene);
              if (captions.length === project.captions.length) { setNotice("No new caption fits an open time in this scene. Review the existing timed captions."); return; }
              if (commit({ ...project, captions })) setNotice("Caption drafts added in open times. Existing captions were kept.");
            }}>Add script caption drafts</button>
            <button className="button secondary" onClick={onCaptions}>Edit timed captions</button>
          </div>
          {preview?.original === scene && <>
            <ScenePreview project={project} scene={preview.proposed} />
            <div className="director-actions">
              <button className="button primary" onClick={() => {
                if (commit({ ...project, scenes: project.scenes.map(item => item.id === scene.id ? preview.proposed : item) })) setPreview(undefined);
              }}>Apply acting suggestion</button>
              <button className="button secondary" onClick={() => setPreview(undefined)}>Keep existing acting</button>
            </div>
          </>}
        </section>
        <details className="director-card">
          <summary>Episode voice cast</summary>
          <label>Voice cast character<select value={voiceCharacter.id} onChange={event => setVoiceId(event.target.value)}>
            {project.characters.map((character, i) => <option key={character.id} value={character.id}>{character.name} · Cast {i + 1}</option>)}
          </select></label>
          <VoiceCastFields notes={voiceCharacter.voice} onChange={voice => commit({
            ...project, characters: project.characters.map(character => character.id === voiceCharacter.id ? { ...character, voice } : character),
          })} />
        </details>
      </fieldset>
    </div>
  </Modal>;
}
