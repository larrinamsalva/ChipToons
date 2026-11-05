import { useEffect, useMemo, useRef, useState } from "react";
import { downloadBlob, safeFilename } from "../files";
import { elementName } from "../library";
import { totalDuration } from "../model";
import type { Project } from "../model";
import { listSeries } from "../series-storage";
import { frameAt } from "../timeline";
import { paintStage } from "../video-export";
import type { ExportProgress } from "../video-export";
import {
  chapterTimestamp, draftEpisodeDetails, episodeDescription, publishingChapters, publishingChecks,
  publishingSubtitles, publishingTracks, YOUTUBE_HELP,
} from "../youtube-kit";
import type { EpisodeDetails, PublishingMovie } from "../youtube-kit";

const palettes = {
  navy: { label: "Navy and white", paper: "#142035", ink: "#ffffff" },
  green: { label: "Forest and cream", paper: "#153d30", ink: "#fff4d5" },
  plum: { label: "Plum and white", paper: "#4d2346", ink: "#ffffff" },
};
const detailFields = [
  ["title", "Video title", 100, false],
  ["description", "Description draft", 5000, true],
  ["topic", "Educational topic", 240, false],
  ["series", "Series name", 160, false],
  ["episode", "Episode number", 8, false],
  ["hashtags", "Hashtags", 200, false],
  ["credits", "Creator credits", 1500, true],
] as const;
const textBlob = (text: string, type = "text/plain") => new Blob([text], { type: `${type};charset=utf-8` });

function MoviePreview({ video }: { video: Blob }) {
  const player = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = player.current!;
    const url = URL.createObjectURL(video);
    element.src = url;
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
    };
  }, [video]);
  return <video ref={player} controls playsInline aria-label="Verified YouTube movie preview" />;
}

export function YouTubeKit({ project, movie, active, expectedAudio, canRender, longer, preferredWidth, busy, progress, exportError,
  onMake, onCancel, onBack, onParts }: {
  project: Project;
  movie?: PublishingMovie;
  active: boolean;
  expectedAudio: boolean;
  canRender: boolean;
  longer: boolean;
  preferredWidth: 800 | 1280;
  busy: boolean;
  progress: ExportProgress | null;
  exportError: string;
  onMake: (width: 800 | 1280) => void;
  onCancel: () => void;
  onBack: () => void;
  onParts: () => void;
}) {
  const [initial, setInitial] = useState(() => draftEpisodeDetails(project));
  const [edits, setEdits] = useState<Partial<EpisodeDetails>>({});
  const details = { ...initial, ...edits };
  const [approved, setApproved] = useState("");
  const [includeChapters, setIncludeChapters] = useState(false);
  const [width, setWidth] = useState(preferredWidth);
  const [preview, setPreview] = useState(false);
  const [chapterTitles, setChapterTitles] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [verification, setVerification] = useState<{
    movie: PublishingMovie; tracks?: Awaited<ReturnType<typeof publishingTracks>>; error?: string;
  }>();
  const [time, setTime] = useState(0.5);
  const [title, setTitle] = useState(() => project.title.slice(0, 55));
  const [palette, setPalette] = useState<keyof typeof palettes>("navy");
  const [artwork, setArtwork] = useState("");
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [thumbnail, setThumbnail] = useState<{ blob: Blob; key: string; url: string }>();
  const [thumbBusy, setThumbBusy] = useState(false);
  const [thumbError, setThumbError] = useState("");
  const thumbTask = useRef<AbortController | undefined>(undefined);
  const heading = useRef<HTMLHeadingElement>(null);
  const total = totalDuration(project);
  const frame = frameAt(project, time);
  const selected = frame.scene.elements.find(element => element.id === artwork);
  const thumbKey = JSON.stringify([time, title, palette, selected?.id, x, y]);
  const readyThumb = thumbnail?.key === thumbKey ? thumbnail : undefined;
  const current = movie && verification?.movie === movie ? verification : undefined;
  const audioRequired = movie?.expectAudio ?? expectedAudio;
  const missingAudio = !!current?.tracks && audioRequired && !current.tracks.audio;
  const readyMovie = !!current?.tracks && !missingAudio;
  const checkedMovie = current?.tracks ? movie : undefined;
  const subtitles = useMemo(() => checkedMovie ? publishingSubtitles(project, checkedMovie) : "", [project, checkedMovie]);
  const chapters = useMemo(() => checkedMovie ? publishingChapters(project, checkedMovie) : [], [project, checkedMovie]);
  const chapterText = includeChapters && chapters.length > 0 && chapters.every(chapter => (chapterTitles[chapter.seconds] ?? chapter.title).trim())
    ? chapters.map(chapter => `${chapterTimestamp(chapter.seconds)} ${(chapterTitles[chapter.seconds] ?? chapter.title).trim()}`).join("\n") : "";
  const description = episodeDescription(details, chapterText);
  const wording = JSON.stringify([details.title.trim(), description]);
  const canApprove = !!details.title.trim() && !!details.description.trim() && description.length <= 5000 &&
    (!includeChapters || !chapters.length || !!chapterText);
  const filename = safeFilename(project.title);

  useEffect(() => { if (active) heading.current?.focus(); }, [active]);
  useEffect(() => {
    let active = true;
    void listSeries().then(saved => {
      if (active) setInitial(draftEpisodeDetails(project, saved.map(item => item.plan)));
    }).catch(() => {});
    return () => {
      active = false;
      thumbTask.current?.abort();
    };
  }, [project]);
  useEffect(() => () => {
    if (thumbnail) URL.revokeObjectURL(thumbnail.url);
  }, [thumbnail]);
  useEffect(() => {
    if (!movie) return;
    let active = true;
    void publishingTracks(movie).then(tracks => {
      if (active) setVerification({ movie, tracks });
    }).catch(error => {
      if (active) setVerification({ movie, error: error instanceof Error ? error.message : "WebM track verification failed." });
    });
    return () => { active = false; };
  }, [movie]);

  async function makeThumbnail() {
    if (thumbTask.current) return;
    const task = new AbortController();
    thumbTask.current = task;
    setThumbBusy(true);
    setThumbError("");
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This browser could not open a thumbnail canvas.");
      await paintStage(context, project, time, { width: 1280, captions: false }, task.signal,
        selected ? { id: selected.id, x, y } : undefined);
      if (title.trim()) {
        const colors = palettes[palette];
        context.fillStyle = colors.paper;
        context.fillRect(48, 566, 1184, 107);
        context.fillStyle = colors.ink;
        context.font = "bold 52px system-ui, sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(title.trim(), 640, 620, 1120);
      }
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value =>
        value ? resolve(value) : reject(new Error("This browser could not make a PNG thumbnail.")), "image/png"));
      if (!task.signal.aborted) setThumbnail({ blob, key: thumbKey, url: URL.createObjectURL(blob) });
    } catch (error) {
      if (!task.signal.aborted) setThumbError(error instanceof Error ? error.message : "Thumbnail preparation failed.");
    } finally {
      thumbTask.current = undefined;
      if (!task.signal.aborted) setThumbBusy(false);
    }
  }

  return <div className="delivery-studio youtube-kit">
    <h3 ref={heading} tabIndex={-1}>Your publishing files</h3>
    <p>Prepare the files here, then upload them yourself in YouTube Studio. Draft wording stays in this finishing session. Download it to keep a copy. Save an editable project backup separately.</p>
    <section className="delivery-card" aria-label="Finished movie">
      <h3>Finished movie</h3>
      {!movie && <p><strong>Required.</strong> {longer
        ? "A continuous movie is missing. Open Complete Episode Delivery to see which numbered parts are missing and join the verified parts."
        : "Render a complete WebM to verify playback, size, duration and tracks."}</p>}
      {!movie && !longer && !canRender && !busy && <p>Return to finishing to check any missing audio sources or unsupported browser settings.</p>}
      {movie && <p><strong>Playback verified.</strong> {movie.duration.toFixed(2)} seconds · {movie.width} × {movie.height} · WebM</p>}
      {movie && !current && <p role="status">Checking WebM video and audio tracks…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.tracks && <p>{current.tracks.codec} video · {current.tracks.audio
        ? `${current.tracks.audio} audio track present. Listen to confirm the mix.`
        : audioRequired ? "Required audio track missing. Export with mixed audio enabled."
          : "No audio track. Review this if you intended to include sound."}</p>}
      {readyMovie && movie && movie.width === 800 && <p>Optional. Re-render original scenes at 1280 × 720 on a supported larger screen for a higher-resolution export.</p>}
      <p>{subtitles ? "Timed SRT subtitles match this movie timeline." : "Optional. Timed SRT subtitles are unavailable for this movie."}
        {movie?.burned && " The movie also has captions drawn into the picture."}</p>
      {(!movie || missingAudio) && !longer && preferredWidth === 1280 && <label>YouTube render resolution
        <select value={width} disabled={busy} onChange={event => setWidth(Number(event.target.value) === 800 ? 800 : 1280)}>
          <option value={1280}>1280 × 720</option><option value={800}>800 × 450</option>
        </select>
      </label>}
      {active && readyMovie && movie && preview && <MoviePreview video={movie.video} />}
      <div className="delivery-actions">
        {(!movie || missingAudio) && !longer && <button className="button primary" disabled={!canRender || busy}
          onClick={() => onMake(width)}>Render YouTube WebM</button>}
        {longer && (!movie || missingAudio) && <button className="button primary" disabled={busy} onClick={onParts}>Review numbered movie parts</button>}
        {busy && <button className="button secondary" onClick={onCancel}>Cancel video export</button>}
        {readyMovie && <button className="button secondary" onClick={() => setPreview(value => !value)}>
          {preview ? "Close movie preview" : "Preview verified movie"}
        </button>}
        {readyMovie && movie && <button className="button primary" onClick={() => {
          movie.keepForDownload?.();
          downloadBlob(movie.video, `${filename}-youtube.webm`);
        }}>Download YouTube WebM</button>}
        {subtitles && <button className="button secondary" onClick={() =>
          downloadBlob(textBlob(subtitles, "application/x-subrip"), `${filename}-youtube.srt`)}>Download YouTube SRT</button>}
      </div>
      {busy && progress && <div><progress aria-label="YouTube video progress" value={progress.fraction} max={1} />
        <p role="status">{progress.phase}</p></div>}
      {exportError && <p role="alert">{exportError}</p>}
    </section>

    <section className="delivery-card" aria-label="Thumbnail maker">
      <h3>Thumbnail</h3>
      <p>{readyThumb ? "Thumbnail ready · 1280 × 720 PNG." : "Optional. Prepare a thumbnail from an actual cartoon frame."}</p>
      <fieldset className="delivery-fields" disabled={thumbBusy}>
        <legend className="visually-hidden">Thumbnail settings</legend>
        <div className="form-grid">
          <label>Thumbnail scene
            <select value={frame.index} onChange={event => {
              const index = Number(event.target.value);
              setTime(project.scenes.slice(0, index).reduce((sum, scene) => sum + scene.duration, 0) + 0.5);
              setArtwork("");
              setX(0);
              setY(0);
            }}>{project.scenes.map((scene, index) => <option key={scene.id} value={index}>{scene.title}</option>)}</select>
          </label>
          <label>Frame time in seconds
            <input type="number" value={time} min={0} max={total} step="0.1"
              onChange={event => setTime(Math.max(0, Math.min(total, Number(event.target.value))))} />
          </label>
          <label>Thumbnail title <input value={title} maxLength={55} onChange={event => setTitle(event.target.value)} /></label>
          <label>Thumbnail colors
            <select value={palette} onChange={event => setPalette(event.target.value as keyof typeof palettes)}>
              {Object.entries(palettes).map(([key, color]) => <option key={key} value={key}>{color.label}</option>)}
            </select>
          </label>
          <label>Reposition original artwork
            <select value={selected?.id ?? ""} onChange={event => { setArtwork(event.target.value); setX(0); setY(0); }}>
              <option value="">Keep the frame’s original layout</option>
              {frame.scene.elements.filter(element => !element.backdrop).map(element =>
                <option key={element.id} value={element.id}>{elementName(project, element)}</option>)}
            </select>
          </label>
          {selected && <>
            <label>Horizontal offset <input type="range" min={-250} max={250} step={5} value={x} onChange={event => setX(Number(event.target.value))} /></label>
            <label>Vertical offset <input type="range" min={-150} max={150} step={5} value={y} onChange={event => setY(Number(event.target.value))} /></label>
          </>}
        </div>
        <div className="delivery-actions">
          <button className="button secondary" disabled={busy} onClick={() => void makeThumbnail()}>
            {thumbBusy ? "Preparing thumbnail…" : "Preview thumbnail at small size"}
          </button>
          {readyThumb && <button className="button secondary" onClick={() =>
            downloadBlob(readyThumb.blob, `${filename}-thumbnail.png`)}>Download thumbnail PNG</button>}
        </div>
      </fieldset>
      {readyThumb && <img className="youtube-thumbnail" src={readyThumb.url} alt="Small preview of the chosen cartoon thumbnail" />}
      {thumbError && <p role="alert">{thumbError}</p>}
    </section>

    <section className="delivery-card" aria-label="Episode details">
      <h3>Episode details</h3>
      <div className="form-grid">
        {detailFields.map(([field, label, maxLength, multiline]) => <label key={field}>{label}
          {multiline
            ? <textarea rows={3} maxLength={maxLength} value={details[field]} onChange={event =>
              setEdits(previous => ({ ...previous, [field]: event.target.value }))} />
            : <input maxLength={maxLength} value={details[field]} onChange={event =>
              setEdits(previous => ({ ...previous, [field]: event.target.value }))} />}
        </label>)}
      </div>
      {chapters.length ? <>
        <label className="inline-check"><input type="checkbox" checked={includeChapters}
          onChange={event => setIncludeChapters(event.target.checked)} /> Include chapters in the description</label>
        {includeChapters && <div className="form-grid">{chapters.map(chapter =>
          <label key={chapter.seconds}>Chapter at {chapterTimestamp(chapter.seconds)}
            <input maxLength={100} value={chapterTitles[chapter.seconds] ?? chapter.title} onChange={event => {
              const value = event.target.value;
              setChapterTitles(previous => ({ ...previous, [chapter.seconds]: value }));
            }} />
          </label>)}</div>}
      </> : <p>Optional. YouTube chapters need at least three eligible boundaries, starting at 00:00, with at least ten seconds per chapter.</p>}
      <div className="youtube-copy">
        <strong>{details.title.trim() || "Enter a video title"}</strong>
        <p>{description || "Enter a description to preview it here."}</p>
      </div>
      {!canApprove && <p>Enter a title and description, keep the combined description within 5,000 characters, and name each included chapter.</p>}
      <label className="inline-check"><input type="checkbox" disabled={!canApprove} checked={canApprove && approved === wording}
        onChange={event => setApproved(event.target.checked ? wording : "")} /> I approve this title and description</label>
      <div className="delivery-actions">
        <button className="button secondary" disabled={!canApprove || approved !== wording} onClick={() =>
          downloadBlob(textBlob(`${details.title.trim()}\n\n${description}\n`), `${filename}-video-details.txt`)}>Download video details</button>
        {chapterText && <button className="button secondary" onClick={() =>
          downloadBlob(textBlob(`${chapterText}\n`), `${filename}-chapters.txt`)}>Download chapter timestamps</button>}
      </div>
    </section>

    <section className="delivery-card" aria-label="Publishing checklist">
      <h3>Publishing checklist</h3>
      {publishingChecks.map(([id, reminder]) => <label className="inline-check" key={id}>
        <input type="checkbox" checked={!!checked[id]} onChange={event => {
          const value = event.target.checked;
          setChecked(previous => ({ ...previous, [id]: value }));
        }} /> {reminder}
      </label>)}
      <div className="delivery-actions">
        <a href={YOUTUBE_HELP.audience} target="_blank" rel="noreferrer">YouTube audience settings</a>
        <a href={YOUTUBE_HELP.longer} target="_blank" rel="noreferrer">YouTube account verification</a>
        <a href={YOUTUBE_HELP.chapters} target="_blank" rel="noreferrer">YouTube chapters</a>
      </div>
      <div className="delivery-actions">
        <button className="button secondary" onClick={() => downloadBlob(textBlob(
          [`Publishing checklist for ${project.title}`, "", ...publishingChecks.map(([id, reminder]) =>
            `[${checked[id] ? "x" : " "}] ${reminder}`), "", ...Object.values(YOUTUBE_HELP)].join("\n"),
        ), `${filename}-publishing-checklist.txt`)}>Download publishing checklist</button>
      </div>
    </section>
    <button className="button secondary" disabled={busy || thumbBusy} onClick={onBack}>Back to finishing</button>
  </div>;
}
