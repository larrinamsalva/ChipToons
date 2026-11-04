import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { downloadBlob, safeFilename } from "../files";
import { listLibrary } from "../library";
import type { LibraryItem } from "../library";
import { durationLabel, totalDuration } from "../model";
import type { Project } from "../model";
import { HEARTS } from "../animation-model";
import { productionReadiness } from "../readiness";
import { exportLimit, supportedVideoFormats } from "../video-export";
import { listProjects } from "../storage";
import { CREW_ID, kindHeartsCrew, seasonTemplate } from "../series-starter";
import { listSeries, saveSeries, SeriesConflict } from "../series-storage";
import type { SavedSeries } from "../series-storage";
import {
  BIBLE_FIELDS, castOptions, continuityWarnings, episodeBrief, EPISODE_STATUSES,
  MAX_CAST, MAX_EPISODES, newCast, newEpisode, newSeries, readSeriesBackup, seriesBackup,
} from "../series";
import type { CastMember, EpisodePlan, SeriesPlan } from "../series";
import { ArtThumbnail } from "./ArtLibrary";
import type { AssistantSeed } from "./CartoonAssistant";
import { Modal } from "./Modal";
import { VoiceCastFields } from "./VoiceCastFields";

const panels = ["Overview", "Series Bible", "Recurring Cast", "Episode Plans"] as const;

function TextField({ label, value, onChange, max = 1500, long = false }: {
  label: string; value: string; onChange: (value: string) => void; max?: number; long?: boolean;
}) {
  return <label>{label}
    {long
      ? <textarea rows={3} maxLength={max} value={value} onChange={e => onChange(e.target.value)} />
      : <input type="text" maxLength={max} value={value} onChange={e => onChange(e.target.value)} />}
  </label>;
}

function NumberField({ label, value, max, onChange }: {
  label: string; value: number; max: number; onChange: (value: number) => void;
}) {
  return <label>{label}<input type="number" min={1} max={max}
    value={Number.isNaN(value) ? "" : value} onChange={e => onChange(e.target.valueAsNumber)} /></label>;
}

function Action({ children, onClick, disabled, primary = false }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; primary?: boolean;
}) {
  return <button type="button" className={`button ${primary ? "primary" : "secondary"} small`}
    onClick={onClick} disabled={disabled}>{children}</button>;
}

function CastDetails({ member, library, onChange }: {
  member: CastMember; library: LibraryItem[]; onChange: (next: CastMember) => void;
}) {
  const item = library.find(entry => entry.id === member.libraryId);
  const options = item && castOptions(item);
  const set = <K extends keyof CastMember>(key: K, value: CastMember[K]) => onChange({ ...member, [key]: value });
  return <div className="series-cast-details">
    <div>
      {item && <div className="series-art"><ArtThumbnail item={item} /></div>}
      {options && <dl className="series-reference">
        <dt>Available expressions</dt><dd>{options.expressions}</dd>
        <dt>Saved poses</dt><dd>{options.poses || "Uses its saved pose"}</dd>
        <dt>Available animations</dt><dd>{options.actions || "Use position, scale, and rotation in the editor"}</dd>
      </dl>}
    </div>
    <div className="series-fields">
      <TextField label="Character name" value={member.name} max={80} onChange={value => set("name", value)} />
      <TextField label="Role" value={member.role} max={160} onChange={value => set("role", value)} />
      <label>Artwork or puppet from your library
        <select value={member.libraryId} onChange={e => {
          const source = library.find(item => item.id === e.target.value);
          onChange({ ...member, libraryId: e.target.value, name: member.name || source?.name || "" });
        }}>
          <option value="">Choose later</option>
          {member.libraryId && !item && <option value={member.libraryId}>Unavailable source</option>}
          {library.map((entry, index) => <option key={entry.id} value={entry.id}>
            {entry.name} · {entry.character?.puppet ? "Puppet" : "Art"} {index + 1}
          </option>)}
        </select>
      </label>
      <TextField label="Appearance reference" value={member.appearance} onChange={value => set("appearance", value)} long />
      <TextField label="Personality and helpful strengths" value={member.strengths} onChange={value => set("strengths", value)} long />
      <TextField label="Signature expressions" value={member.expressions} onChange={value => set("expressions", value)} />
      <TextField label="Relationships" value={member.relationships} onChange={value => set("relationships", value)} long />
      <VoiceCastFields notes={member.voice} onChange={value => set("voice", value)} />
      <label>Preferred heart glow
        <select value={member.heart} onChange={e => set("heart", e.target.value as CastMember["heart"])}>
          {HEARTS.map(heart => <option key={heart} value={heart}>{heart === "off" ? "Use story defaults" : heart}</option>)}
        </select>
      </label>
    </div>
  </div>;
}

function EpisodeDetails({ plan, series, projects, library, number, onChange, onOrder, onCreate, onOpen, busy }: {
  plan: EpisodePlan; series: SeriesPlan; projects: Project[]; library: LibraryItem[];
  number: number; onChange: (next: EpisodePlan) => void; onOrder: (offset: number) => void;
  onCreate: () => void; onOpen: (project: Project, script?: boolean) => void; busy: boolean;
}) {
  const project = projects.find(item => item.id === plan.projectId);
  const warnings = continuityWarnings(series, plan, project, library);
  const limit = exportLimit();
  const [supported] = useState(() => !!supportedVideoFormats().length);
  const ready = project ? productionReadiness(project, limit, supported) : [];
  const otherLinks = new Set(series.episodes.filter(e => e.id !== plan.id).map(e => e.projectId));
  const set = <K extends keyof EpisodePlan>(key: K, value: EpisodePlan[K]) => onChange({ ...plan, [key]: value });
  return <div className="series-card series-fields">
    <h3>Episode {number}</h3>
    <div className="series-actions">
      <Action disabled={number === 1} onClick={() => onOrder(-1)}>Move earlier</Action>
      <Action disabled={number === series.episodes.length} onClick={() => onOrder(1)}>Move later</Action>
    </div>
    <TextField label="Episode title" max={160} value={plan.title} onChange={value => set("title", value)} />
    <TextField label="Central lesson" max={500} value={plan.lesson} onChange={value => set("lesson", value)} />
    <TextField label="Setting" max={500} value={plan.setting} onChange={value => set("setting", value)} />
    <TextField label="Story description" max={6000} value={plan.description} onChange={value => set("description", value)} long />
    <TextField label="Learning question" max={500} value={plan.question} onChange={value => set("question", value)} />
    <NumberField label="Target duration (minutes)" max={30} value={plan.minutes} onChange={value => set("minutes", value)} />
    <label>Production status
      <select value={plan.status} onChange={e => set("status", e.target.value as EpisodePlan["status"])}>
        {EPISODE_STATUSES.map(status => <option key={status}>{status}</option>)}
      </select>
    </label>
    {series.cast.length > 0 && <fieldset className="series-fields">
      <legend>Episode cast</legend>
      {series.cast.map((member, index) => <label key={member.id}>{member.name || `Cast member ${index + 1}`} · {member.role || `Cast member ${index + 1}`}
        <select value={plan.main.includes(member.id) ? "main" : plan.supporting.includes(member.id) ? "supporting" : ""}
          onChange={e => {
            const value = e.target.value;
            onChange({
              ...plan,
              main: value === "main" ? [...plan.main, member.id] : plan.main.filter(id => id !== member.id),
              supporting: value === "supporting" ? [...plan.supporting, member.id] : plan.supporting.filter(id => id !== member.id),
            });
          }}>
          <option value="">Outside this episode</option><option value="main">Main character</option>
          <option value="supporting">Supporting character</option>
        </select>
      </label>)}
    </fieldset>}
    <label>Linked cartoon
      <select value={plan.projectId ?? ""} onChange={e => set("projectId", e.target.value || undefined)}>
        <option value="">No linked cartoon</option>
        {plan.projectId && !project && <option value={plan.projectId}>Unavailable cartoon</option>}
        {projects.filter(p => !otherLinks.has(p.id)).map(p =>
          <option key={p.id} value={p.id}>{p.title}</option>)}
      </select>
    </label>
    <p>Save series changes before opening or creating a cartoon. Unlinking keeps the original cartoon in My cartoons.</p>
    <div className="series-actions">
      {project && <>
        <Action primary disabled={busy} onClick={() => onOpen(project)}>Open linked cartoon</Action>
        <Action disabled={busy} onClick={() => onOpen(project, true)}>Write My Episode Script</Action>
      </>}
      {!plan.projectId && <Action primary disabled={busy || series.archived} onClick={onCreate}>Create This Episode</Action>}
    </div>
    <h4>Continuity review</h4>
    {warnings.length ? <ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
      : <p>{project ? "No continuity warnings for the current plan and linked cartoon." : "Continuity checks expand when you link a cartoon."}</p>}
    {project && <>
      <h4>Production readiness · {durationLabel(totalDuration(project))} actual running time</h4>
      {ready.length ? <details><summary>{ready.length} items to review in Finish My Cartoon</summary>
        <ul>{ready.map(issue => <li key={issue.id}>{issue.title}</li>)}</ul></details>
        : <p>The linked cartoon passed the current readiness checks.</p>}
    </>}
  </div>;
}

export function SeriesStudio({ initialId, initialEpisodeId, initialPanel = "Overview", onClose, onOpen, onCreate, onLibrary }: {
  initialId?: string; initialEpisodeId?: string; initialPanel?: (typeof panels)[number]; onClose: () => void; onOpen: (project: Project, script?: boolean) => void;
  onCreate: (saved: SavedSeries, episode: EpisodePlan, seed: AssistantSeed) => void;
  onLibrary: (seriesId: string, puppet: boolean) => void;
}) {
  const [inventory, setInventory] = useState<SavedSeries[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [selected, setSelected] = useState<SavedSeries>();
  const [draft, setDraft] = useState<SeriesPlan>();
  const [panel, setPanel] = useState<(typeof panels)[number]>(initialPanel);
  const [episodeId, setEpisodeId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(true);
  const [inventoryWarning, setInventoryWarning] = useState("");
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const backupInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const dirty = draft !== selected?.plan;
  const episode = draft?.episodes.find(item => item.id === episodeId) ?? draft?.episodes[0];
  const member = draft?.cast.find(item => item.id === memberId) ?? draft?.cast[0];

  function show(saved?: SavedSeries) {
    setSelected(saved);
    setDraft(saved?.plan);
    setEpisodeId("");
    setMemberId("");
    setConflict(false);
    setError("");
  }

  useEffect(() => {
    let active = true;
    void Promise.allSettled([listSeries(), listProjects(), listLibrary()]).then(([series, cartoons, art]) => {
      if (!active) return;
      if (series.status === "fulfilled") {
        setInventory(series.value);
        const found = series.value.find(entry => entry.id === initialId);
        if (found) {
          show(found);
          setEpisodeId(initialEpisodeId ?? "");
        }
      } else setError("Saved series could not be opened. Check local browser storage.");
      if (cartoons.status === "fulfilled") setProjects(cartoons.value);
      if (art.status === "fulfilled") setLibrary(art.value.filter(item => item.kind === "character"));
      if (cartoons.status === "rejected" || art.status === "rejected")
        setInventoryWarning("Some local projects or library sources could not be read. Review unavailable references before changing them.");
      setBusy(false);
    });
    return () => { active = false; };
  }, [initialEpisodeId, initialId]);

  async function run(operation: () => Promise<void>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await operation();
    } catch (e) {
      setConflict(e instanceof SeriesConflict);
      setError(e instanceof DOMException && e.name === "QuotaExceededError"
        ? "Local storage is full. Download the series plan to keep your edits."
        : e instanceof Error ? e.message : "The series could not be saved on this device.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  function remember(saved: SavedSeries, message: string) {
    setInventory(previous => [...previous.filter(entry => entry.id !== saved.id), saved]
      .sort((a, b) => a.plan.name.localeCompare(b.plan.name)));
    setSelected(saved);
    setDraft(saved.plan);
    setConflict(false);
    setStatus(message);
  }

  function save(next: SeriesPlan) {
    void run(async () => remember(await saveSeries(next, selected?.revision ?? null), "Series saved on this device."));
  }

  function addStarter() {
    const existing = inventory.find(entry => entry.id === CREW_ID);
    if (existing) { show(existing); setPanel("Overview"); return; }
    void run(async () => {
      const { plan, artwork } = kindHeartsCrew();
      const saved = await saveSeries(plan, null, artwork);
      setLibrary(previous => [...artwork, ...previous]);
      remember(saved, "Added 30 editable plans and six original library puppets.");
      setPanel("Overview");
    });
  }

  function close() {
    if (busy) return;
    if (dirty) {
      setError("Save the series or discard the unsaved changes before closing.");
      return;
    }
    onClose();
  }

  function reviewEpisode(item: EpisodePlan) {
    if (!draft || !selected || dirty || item.projectId) return;
    const selectedCast = [...item.main, ...item.supporting];
    const cast = draft.cast.flatMap(entry => {
      const art = library.find(source => source.id === entry.libraryId);
      return art ? [{ ...entry, library: art }] : [];
    });
    const number = draft.episodes.indexOf(item) + 1;
    onCreate(selected, item, {
      cast, selected: selectedCast.filter(id => cast.some(member => member.id === id)).slice(0, 3),
      brief: episodeBrief(item, number), question: item.question,
    });
  }

  const update = <K extends keyof SeriesPlan>(key: K, value: SeriesPlan[K]) => {
    if (draft) setDraft({ ...draft, [key]: value });
  };
  const linked = new Set(draft?.episodes.map(item => item.projectId));
  const started = projects.filter(project => linked.has(project.id));

  return <Modal title="My Cartoon Series" onClose={close} wide>
    <div className="series-studio">
      <p>Keep your cast, lessons, and episode plans together. Each linked cartoon can still be edited on its own.</p>
      {inventoryWarning && <p role="status">{inventoryWarning}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      <p className="series-status" role="status">{busy ? "Working with your saved series…" : status}</p>
      <div className="series-actions">
        <Action disabled={dirty || busy} onClick={() => { show(); setDraft(newSeries()); setPanel("Overview"); }}>New series</Action>
        <Action disabled={dirty || busy} onClick={addStarter}>{inventory.some(entry => entry.id === CREW_ID) ? "Open The Kind Hearts Crew" : "Add The Kind Hearts Crew"}</Action>
        <Action disabled={dirty || busy} onClick={() => backupInput.current?.click()}>Restore series-plan backup</Action>
      </div>
      <input hidden aria-label="Restore series-plan backup file" type="file" accept=".json,application/json" ref={backupInput} onChange={e => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        void run(async () => {
          const restored = await readSeriesBackup(file);
          remember(await saveSeries(restored, null), "Series plan restored as a new series. Link any restored cartoons separately.");
          setPanel("Overview");
        });
      }} />
      {inventory.length > 0 && <label>Saved series
        <select value={selected?.id ?? ""} disabled={dirty || busy} onChange={e => {
          show(inventory.find(entry => entry.id === e.target.value));
          setPanel("Overview");
        }}>
          <option value="">Choose a series</option>
          {inventory.map(entry => <option key={entry.id} value={entry.id}>
            {entry.plan.name}{entry.plan.archived ? " (archived)" : ""}
          </option>)}
        </select>
      </label>}
      {draft && <>
        <div className="series-card">
          <h3>{draft.name || "Untitled series"}{draft.archived ? " (archived)" : ""}</h3>
          <p>{draft.episodes.length} planned of {draft.target || "—"} target · {started.length} started · {draft.episodes.filter(item => item.status === "Completed").length} marked completed</p>
          <p>{durationLabel(started.reduce((total, project) => total + totalDuration(project), 0))} actual running time in available cartoons</p>
          {draft.episodes.some(item => item.projectId && !started.some(project => project.id === item.projectId)) &&
            <p>Some linked cartoons are unavailable. Check the episode plans for details.</p>}
        </div>
        <nav className="series-actions series-tabs" aria-label="Series sections">
          {panels.map(name => <button key={name} type="button" className={`button small ${panel === name ? "primary" : "secondary"}`}
            aria-current={panel === name ? "true" : undefined} onClick={() => setPanel(name)}>{name}</button>)}
        </nav>
        <fieldset className="series-edit" disabled={busy}>
          <legend className="visually-hidden">{panel} fields</legend>
          {panel === "Overview" && <div className="series-fields">
            <TextField label="Series name" value={draft.name} max={160} onChange={value => update("name", value)} />
            <TextField label="Description" value={draft.description} max={6000} onChange={value => update("description", value)} long />
            <TextField label="Audience age range" value={draft.age} max={60} onChange={value => update("age", value)} />
            <TextField label="Educational themes" value={draft.themes} max={1000} onChange={value => update("themes", value)} long />
            <NumberField label="Target number of episodes" max={MAX_EPISODES} value={draft.target} onChange={value => update("target", value)} />
            <div className="series-actions">
              <Action onClick={() => update("archived", !draft.archived)}>{draft.archived ? "Restore archived series" : "Archive series"}</Action>
              {!draft.episodes.length && <Action onClick={() => setDraft({ ...draft, target: 30, episodes: seasonTemplate(draft.cast) })}>Use 30-episode template</Action>}
            </div>
            <p>Archiving changes the series label. Your cartoons and media stay available.</p>
          </div>}
          {panel === "Series Bible" && <div className="series-fields">
            {(Object.entries(BIBLE_FIELDS) as [keyof SeriesPlan["bible"], string][]).map(([key, label]) =>
              <TextField key={key} label={label} value={draft.bible[key]} long
                onChange={value => update("bible", { ...draft.bible, [key]: value })} />)}
          </div>}
          {panel === "Recurring Cast" && <div className="series-fields">
            <p>Connect a character or puppet from your existing library. Episodes copy that artwork for independent editing. To review a puppet update, open its episode and choose the update from the Art Library.</p>
            <div className="series-actions">
              <Action disabled={draft.cast.length >= MAX_CAST} onClick={() => {
                const added = newCast(); update("cast", [...draft.cast, added]); setMemberId(added.id);
              }}>Add cast member</Action>
              <Action disabled={dirty} onClick={() => onLibrary(draft.id, false)}>Open Character &amp; Art Library</Action>
              <Action disabled={dirty} onClick={() => onLibrary(draft.id, true)}>Open Puppet Maker</Action>
            </div>
            {member && <>
              <label>Cast member to edit
                <select value={member.id} onChange={e => setMemberId(e.target.value)}>
                  {draft.cast.map((item, index) => <option key={item.id} value={item.id}>
                    {item.name || "New cast member"} · {item.role || `Cast member ${index + 1}`}
                  </option>)}
                </select>
              </label>
              <CastDetails member={member} library={library}
                onChange={value => update("cast", draft.cast.map(item => item.id === value.id ? value : item))} />
            </>}
          </div>}
          {panel === "Episode Plans" && <div className="series-fields">
            <p>Pick a plan to edit, review its production status, or open its linked cartoon.</p>
            <div className="series-actions">
              <Action disabled={draft.episodes.length >= MAX_EPISODES} onClick={() => {
                const next = newEpisode(draft.episodes.length + 1);
                update("episodes", [...draft.episodes, next]); setEpisodeId(next.id);
              }}>Add next episode plan</Action>
            </div>
            {!!draft.episodes.length && <ol className="series-episode-grid" aria-label="Episode planning board">
              {draft.episodes.map((item, index) => <li key={item.id}>
                <button type="button" aria-current={item.id === episode?.id ? "true" : undefined}
                  className="series-card series-episode" onClick={() => setEpisodeId(item.id)}>
                  <strong>{index + 1}. {item.title}</strong><span>{item.status} · {item.minutes || "—"} min target</span>
                  {item.projectId && <span>{projects.some(project => project.id === item.projectId) ? "Cartoon linked" : "Cartoon unavailable"}</span>}
                </button>
              </li>)}
            </ol>}
            {episode && <EpisodeDetails plan={episode} series={draft} projects={projects} library={library}
              number={draft.episodes.indexOf(episode) + 1} busy={dirty || busy} onOpen={onOpen}
              onCreate={() => reviewEpisode(episode)}
              onChange={next => update("episodes", draft.episodes.map(item => item.id === next.id ? next : item))}
              onOrder={offset => {
                const reordered = [...draft.episodes];
                const from = reordered.indexOf(episode);
                reordered.splice(from, 1);
                reordered.splice(from + offset, 0, episode);
                setEpisodeId(episode.id);
                update("episodes", reordered);
              }} />}
          </div>}
        </fieldset>
        <div className="series-actions series-footer">
          <Action primary disabled={!dirty || busy || conflict} onClick={() => save(draft)}>Save series</Action>
          {dirty && !conflict && <Action disabled={busy} onClick={() => { show(selected); setStatus("Unsaved changes discarded."); }}>Discard unsaved changes</Action>}
          {conflict && <Action disabled={busy} onClick={() => void run(async () => {
            const latest = await listSeries();
            setInventory(latest);
            show(latest.find(entry => entry.id === draft.id));
            setStatus("Opened the latest saved series.");
          })}>Discard edits and reload saved series</Action>}
          <Action onClick={() => {
            try {
              downloadBlob(seriesBackup(draft), `${safeFilename(draft.name)}.series-plan.json`);
              setStatus("Series-plan download prepared.");
            } catch (e) { setError(e instanceof Error ? e.message : "Could not prepare the plan backup."); }
          }}>Download series plan</Action>
        </div>
        <p>A series-plan backup contains plans and cast references. Keep complete episode and art library backups separately for artwork and original audio.</p>
      </>}
    </div>
  </Modal>;
}
