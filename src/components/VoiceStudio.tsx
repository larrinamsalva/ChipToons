import type { AudioFile } from "../audio-vault";
import { CaptionEditor } from "./CaptionEditor";
import { useEffect, useRef, useState } from "react";
import type { Project } from "../model";
import { validateProject, totalDuration } from "../model";
import type { AudioAsset, AudioCategory, AudioClip } from "../media-model";
import {
  CATEGORIES,
  MAX_AUDIO_ASSETS,
  MAX_TOTAL_AUDIO_SECONDS,
} from "../media-model";
import { SOUNDS, builtInSound } from "../sounds";
import type { SoundId } from "../sounds";
import { readAudio } from "../audio-files";
import { editSoundClip, reconcileSoundClips } from "../sound-cues";
import { newAudioClip } from "../production";
import { exportProject, downloadBlob, safeFilename } from "../files";
import {
  audioBlob,
  enableEpisodeAudio,
  storeAudio,
  sourceBytes,
  MAX_EPISODE_AUDIO_BYTES,
  MAX_EPISODE_AUDIO_SECONDS,
  MAX_EPISODE_AUDIO_SOURCES,
} from "../audio-vault";
import { VoiceRecorder, recordingMime } from "../recording";
import { Modal } from "./Modal";
import { chooseScriptTake, findScriptLine, reconcileScriptClips } from "../script";
import { MediaNumber } from "./MediaNumber";

export function OriginalAudio({ asset }: { asset: AudioAsset }) {
  const ref = useRef<HTMLAudioElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      url: string | undefined;
    const el = ref.current;
    if (!asset.file) {
      if (el) el.src = asset.dataUrl;
    } else
      void audioBlob(asset)
        .then((blob) => {
          if (alive && el) {
            url = URL.createObjectURL(blob);
            el.src = url;
            el.load();
          }
        })
        .catch((e) => {
          if (alive) setError((e as Error).message);
        });
    return () => {
      alive = false;
      el?.pause();
      el?.removeAttribute("src");
      el?.load();
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.dataUrl, asset.file?.key, asset]);
  return (
    <>
      <audio
        ref={ref}
        controls
        preload="metadata"
        src={asset.file ? undefined : asset.dataUrl}
        aria-label="Original audio source"
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
}
export function VoiceStudio({
  project,
  sceneIndex,
  localTime,
  initialClip,
  lineTarget,
  initialCategory,
  initialTab = "sound",
  onChange,
  onConvert,
  onClose,
  onPreview,
  saveStatus,
  saveError,
  onRetry,
}: {
  project: Project;
  sceneIndex: number;
  localTime: number;
  initialClip?: string;
  lineTarget?: string;
  initialCategory?: AudioCategory;
  initialTab?: "sound" | "captions";
  onChange: (p: Project) => void;
  onConvert: (p: Project, files: AudioFile[]) => Promise<void>;
  onClose: () => void;
  onPreview: () => void;
  saveStatus: string;
  saveError: string;
  onRetry: () => void;
}) {
  const target = lineTarget ? findScriptLine(project, lineTarget)?.line : undefined;
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const [selected, setSelected] = useState(
      initialClip ?? project.audioClips[0]?.id ?? "",
    ),
    [category, setCategory] = useState<AudioCategory>(
      target?.kind ?? initialCategory ?? "narration",
    ),
    [association, setAssociation] = useState("");
  const [draft, setDraft] = useState<AudioAsset | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [recordName, setRecordName] = useState(target ? target.text.slice(0, 75).trim() || "Script take" : "My voice clip");
  const [recorder] = useState(() => new VoiceRecorder()),
    alive = useRef(true),
    recordStarted = useRef(0),
    input = useRef<HTMLInputElement>(null),
    replacing = useRef(false),
    [deleteId, setDeleteId] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]),
    [voice, setVoice] = useState(""),
    [rate, setRate] = useState(1),
    [speechText, setSpeechText] = useState(
      project.scenes[sceneIndex].dialogue ||
        project.scenes[sceneIndex].narration,
    ),
    [lowStorage, setLowStorage] = useState(false),
    [availableBytes, setAvailableBytes] = useState<number | null>(null),
    [protectedStorage, setProtectedStorage] = useState(false);
  const clip = project.audioClips.find((c) => c.id === selected),
    asset = project.audioAssets.find((a) => a.id === clip?.assetId);
  useEffect(() => {
    alive.current = true;
    const synth = window.speechSynthesis,
      refresh = () => {
        if (alive.current) setVoices(synth?.getVoices() ?? []);
      };
    refresh();
    synth?.addEventListener("voiceschanged", refresh);
    void navigator.storage
      ?.estimate?.()
      .then((s) => {
        if (alive.current) {
          setAvailableBytes(
            s.quota ? Math.max(0, s.quota - (s.usage ?? 0)) : null,
          );
          setLowStorage(
            !!s.quota && s.quota - (s.usage ?? 0) < 15 * 1024 * 1024,
          );
        }
      })
      .catch(() => {});
    void navigator.storage
      ?.persisted?.()
      .then((value) => {
        if (alive.current) setProtectedStorage(value);
      })
      .catch(() => {});
    return () => {
      alive.current = false;
      recorder.cancel();
      synth?.cancel();
      synth?.removeEventListener("voiceschanged", refresh);
    };
  }, [recorder]);
  useEffect(() => {
    if (!recording) return;
    const interval = setInterval(
      () =>
        setElapsed(
          Math.min(60, (performance.now() - recordStarted.current) / 1000),
        ),
      200,
    );
    return () => clearInterval(interval);
  }, [recording]);
  function commit(p: Project) {
    try {
      const next = reconcileScriptClips({ ...p, audioClips: reconcileSoundClips(p.audioClips, p.scenes) });
      validateProject(next);
      onChange(next);
      setMessage("");
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "This audio edit could not be saved.",
      );
      return false;
    }
  }
  function edit(patch: Partial<AudioClip>) {
    if (!clip) return;
    const next = editSoundClip(clip, patch);
    next.fadeIn = Math.min(next.fadeIn, next.duration);
    next.fadeOut = Math.min(next.fadeOut, next.duration);
    commit({
      ...project,
      audioClips: project.audioClips.map((c) => (c.id === clip.id ? next : c)),
    });
  }
  async function addSource(source: AudioAsset, kind = category) {
    if (busy || recording) return;
    setBusy(true);
    if (project.mediaVersion === 1) {
      try {
        source = await storeAudio(source, undefined, project.audioAssets);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "The original could not be stored.",
        );
        setBusy(false);
        return;
      }
    }
    if (!alive.current) return;
    const same = project.audioAssets.find((a) =>
        source.file
          ? a.file?.sha256 === source.file.sha256
          : !a.file && a.dataUrl === source.dataUrl,
      ),
      a = same ?? source,
      nextClip = newAudioClip(project, a, kind, sceneIndex, localTime);
    if (
      project.mediaVersion === 1 &&
      !same &&
      (project.audioAssets.length >= MAX_EPISODE_AUDIO_SOURCES ||
        project.audioAssets.reduce((n, a) => n + a.duration, 0) +
          source.duration >
          MAX_EPISODE_AUDIO_SECONDS ||
        project.audioAssets.reduce((n, a) => n + sourceBytes(a), 0) +
          sourceBytes(source) >
          MAX_EPISODE_AUDIO_BYTES)
    ) {
      setMessage(
        "This source would exceed the episode’s 30-minute / 256 MB / 256-source budget. Keep the original and use another chapter project.",
      );
      setBusy(false);
      return;
    }
    nextClip.name = source.name.slice(0, 100);
    if (kind === "dialogue" && association) nextClip.characterId = association;
    try {
      const next = target ? chooseScriptTake(project, target.id, a, true) : {
        ...project,
        audioAssets: same ? project.audioAssets : [...project.audioAssets, a],
        audioClips: [...project.audioClips, nextClip],
      };
      if (commit(next)) {
        setSelected(target ? findScriptLine(next, target.id)?.line.clipId ?? "" : nextClip.id);
        setDraft(null);
        setMessage(target
          ? "Take linked to this line. Wait for Saved on this device before closing the project."
          : "Audio clip added. Your original source stays intact.");
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The take could not be assigned.");
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const a = await readAudio(
        file,
        undefined,
        project.mediaVersion === 1,
        project.audioAssets,
      );
      if (!alive.current) return;
      if (replacing.current && clip) {
        const old = clip,
          next = {
            ...clip,
            assetId: a.id,
            trimStart: 0,
            trimEnd: a.duration,
            duration: Math.min(clip.duration, a.duration),
            fadeIn: 0,
            fadeOut: 0,
          };
        if (
          commit({
            ...project,
            audioAssets: [...project.audioAssets, a],
            audioClips: project.audioClips.map((c) =>
              c.id === old.id ? next : c,
            ),
          })
        )
          setMessage(
            "Clip replaced. The earlier original remains in Sources until you remove it.",
          );
      } else setDraft(a);
    } catch (e) {
      if (alive.current)
        setMessage(
          e instanceof Error ? e.message : "The audio could not be opened.",
        );
    } finally {
      if (alive.current) setBusy(false);
      if (input.current) input.current.value = "";
      replacing.current = false;
    }
  }
  async function record() {
    setMessage("");
    setBusy(true);
    try {
      await recorder.start(
        (blob, seconds) => {
          if (!alive.current) return;
          setRecording(false);
          setBusy(true);
          void readAudio(
            new File([blob], `${recordName || "My voice clip"}.webm`, {
              type: blob.type,
            }),
            seconds,
            project.mediaVersion === 1,
            project.audioAssets,
          )
            .then((a) => {
              if (alive.current) {
                setDraft(a);
                setMessage(
                  "Recording ready. Listen, then save it to your cartoon.",
                );
              }
            })
            .catch((e) => {
              if (alive.current) setMessage(String(e.message ?? e));
            })
            .finally(() => {
              if (alive.current) setBusy(false);
            });
        },
        (e) => {
          if (alive.current) {
            setMessage(e.message);
            setRecording(false);
            setBusy(false);
          }
        },
      );
      if (alive.current) {
        recordStarted.current = performance.now();
        setElapsed(0);
        setRecording(true);
      }
    } catch (e) {
      if (alive.current)
        setMessage(
          e instanceof DOMException && e.name === "NotAllowedError"
            ? "Microphone permission was denied. You can retry or upload a recording."
            : e instanceof Error
              ? e.message
              : "Microphone permission was denied. You can retry or upload a recording.",
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const limit = clip?.sceneId
    ? project.scenes.find((s) => s.id === clip.sceneId)!.duration
    : totalDuration(project);
  function close() {
    if (target && (recording || draft || busy)) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }
  return (
    <Modal title={target ? "Record This Line" : "Voices & Sound Studio"} onClose={close} wide>
      {target && <section className="director-recording" aria-label="Recording script">
        <strong>{target.kind === "narration" ? "Narrator" :
          project.characters.find(character => character.id === target.speakerId)?.name ?? "Unassigned speaker"}</strong>
        <p>{target.text}</p>
        {target.delivery && <em>{target.delivery}</em>}
        <small>Scene {sceneIndex + 1} · {project.scenes[sceneIndex].title}</small>
      </section>}
      {!target && <section
        className="episode-audio-storage"
        aria-label="Episode audio storage"
      >
        <h3>
          {project.mediaVersion === 1
            ? "Long-episode audio is enabled"
            : "Planning a fully narrated episode?"}
        </h3>
        <p className="field-hint">
          {project.mediaVersion === 1
            ? "Up to 30 minutes of unique sources / 256 MB / 256 sources. Audio originals are separate local files; preview loads small windows. Complete backups use .ctepisode files."
            : "The original JSON mode holds five minutes of audio. Enable long-episode storage for 20-minute narrated stories, preserving existing recordings."}
        </p>
        <p className="field-hint">
          {availableBytes === null
            ? "This browser does not report its available storage."
            : `About ${(availableBytes / 1024 / 1024).toFixed(0)} MB of browser storage available when this panel opened.`}{" "}
          One minute of mono WAV at 24 kHz is about 2.9 MB. Available space is
          an estimate; keep a complete backup.
          {protectedStorage &&
            " This browser has granted protection from automatic storage cleanup."}
        </p>
        {project.mediaVersion === 1 &&
          !protectedStorage &&
          navigator.storage?.persist && (
            <button
              className="button secondary small"
              disabled={busy || recording}
              onClick={() => {
                void navigator.storage
                  .persist()
                  .then((granted) => {
                    if (alive.current) {
                      setProtectedStorage(granted);
                      setMessage(
                        granted
                          ? "Local storage protection granted. Keep downloaded episode backups too."
                          : "This browser did not grant storage protection. Your files remain saved; keep a complete episode backup before closing or clearing browser data.",
                      );
                    }
                  })
                  .catch(() => {
                    if (alive.current)
                      setMessage(
                        "Storage protection is unavailable. Keep a complete episode backup.",
                      );
                  });
              }}
            >
              Request local storage protection
            </button>
          )}
        <p>
          {(
            project.audioAssets.reduce((n, a) => n + sourceBytes(a), 0) /
            1024 /
            1024
          ).toFixed(1)}{" "}
          MB of{" "}
          {project.mediaVersion === 1
            ? MAX_EPISODE_AUDIO_BYTES / 1024 / 1024
            : 64}{" "}
          MB ·{" "}
          {project.audioAssets.reduce((n, a) => n + a.duration, 0).toFixed(0)} /{" "}
          {project.mediaVersion === 1
            ? MAX_EPISODE_AUDIO_SECONDS
            : MAX_TOTAL_AUDIO_SECONDS}{" "}
          seconds of unique audio
        </p>
        {project.mediaVersion !== 1 && (
          <button
            className="button secondary"
            disabled={busy || recording}
            onClick={() => {
              setBusy(true);
              void enableEpisodeAudio(project, onConvert)
                .then(() => {
                  if (alive.current) {
                    setMessage(
                      "Long-episode audio enabled. Existing originals are preserved. Use Project backup for a complete episode package.",
                    );
                  }
                })
                .catch((error) => {
                  if (alive.current)
                    setMessage(
                      error instanceof Error || error instanceof DOMException
                        ? `${error.name}: ${error.message}`
                        : "Storage could not be prepared. Existing sources are unchanged.",
                    );
                })
                .finally(() => {
                  if (alive.current) setBusy(false);
                });
            }}
          >
            Enable long-episode audio
          </button>
        )}
      </section>}
      {!target && <><p className="section-description">
        Record a kind voice, add a little music, and place sounds in your story.
        Everything stays on this device.
      </p>
      <p className="field-hint">
        New scene recordings: scene {sceneIndex + 1} ·{" "}
        {project.scenes[sceneIndex].title}. Selecting an existing clip shows its
        own scene or episode timing below.
      </p></>}
      <div className="production-save">
        <span role="status">{saveStatus}</span>
        {saveStatus === "Save failed" && (
          <>
            <button className="button secondary small" onClick={onRetry}>
              Retry save
            </button>
            <button
              className="button primary small"
              onClick={() => exportProject(project)}
            >
              Keep a project backup
            </button>
          </>
        )}
      </div>
      {saveError && (
        <p role="status" className="media-notice">
          {saveError}
        </p>
      )}
      {lowStorage && (
        <p className="media-notice">
          Browser space is running low. Download a project backup before adding
          more recordings.{" "}
          {project.mediaVersion === 1
            ? "Stored originals are retained for recovery, including sources removed from a project. Back up your projects before clearing any site data."
            : "You can remove unused sources below."}
        </p>
      )}
      {!target && <nav className="media-tabs" aria-label="Sound studio panels">
        <button
          className="button secondary"
          aria-pressed={tab === "sound"}
          disabled={recording}
          onClick={() => setTab("sound")}
        >
          Voices & sound
        </button>
        <button
          className="button secondary"
          aria-pressed={tab === "captions"}
          disabled={recording}
          onClick={() => setTab("captions")}
        >
          Timed captions
        </button>
      </nav>}
      {tab === "captions" ? (
        <CaptionEditor
          project={project}
          sceneIndex={sceneIndex}
          time={localTime}
          onChange={commit}
        />
      ) : (
        <>
          <div className={target ? "director-guided-audio" : "voice-studio-grid"}>
            <section className="voice-create">
              <h3>{target ? "Record or upload a take" : "Add a voice or sound"}</h3>
              {!target && <div className="form-grid">
                <label>
                  New clip category
                  <select
                    aria-label="New audio category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as AudioCategory)
                    }
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {category === "dialogue" && (
                  <label>
                    Voice for character
                    <select
                      value={association}
                      onChange={(e) => setAssociation(e.target.value)}
                    >
                      <option value="">Unassigned voice</option>
                      {project.characters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>}
              <label>
                Recording name
                <input
                  maxLength={100}
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                />
              </label>
              <div className="animation-actions">
                <button
                  className="button primary"
                  disabled={busy || recording || !recordingMime()}
                  onClick={() => void record()}
                >
                  Start microphone recording
                </button>
                <button
                  className="button secondary"
                  disabled={!recording}
                  onClick={() => recorder.stop()}
                >
                  Stop recording
                </button>
              </div>
              {recording && (
                <p className="recording-indicator" role="status">
                  <span />
                  Recording · {elapsed.toFixed(1)}s / 60s · microphone is on
                </p>
              )}
              <p className="field-hint">
                Your browser asks for microphone access only when you press
                Start. Tracks stop at Stop, after 60 seconds, or when this
                studio closes. Recording availability depends on HTTPS and
                browser support.
              </p>
              <button
                className="button secondary"
                disabled={busy || recording}
                onClick={() => {
                  replacing.current = false;
                  input.current?.click();
                }}
              >
                {target ? "Upload a take for this line" : "Upload voice, music or sound"}
              </button>
              <input
                className="visually-hidden"
                type="file"
                tabIndex={-1}
                aria-label="Upload audio file"
                accept="audio/wav,audio/x-wav,audio/mpeg,audio/ogg,audio/webm"
                ref={input}
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              <p className="field-hint">
                Use audio you own or have permission to use. WAV, MP3, Ogg and
                audio WebM are checked and decoded here. Maximum 12 MB / 120
                seconds per source.
              </p>
              {busy && <p role="status">Preparing audio…</p>}
              {draft && (
                <div className="audio-draft">
                  <h4>Ready to save</h4>
                  <label>
                    New audio name
                    <input
                      aria-label="New audio name"
                      maxLength={100}
                      value={draft.name}
                      onChange={(e) =>
                        setDraft({ ...draft, name: e.target.value })
                      }
                    />
                  </label>
                  <OriginalAudio key={draft.id} asset={draft} />
                  <p>{draft.duration.toFixed(2)} seconds · original source</p>
                  <div className="animation-actions">
                    <button
                      className="button primary"
                      disabled={busy || recording}
                      onClick={() => void addSource(draft)}
                    >
                      {target ? "Save take to this line" : "Save audio clip"}
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setDraft(null)}
                    >
                      Cancel new clip
                    </button>
                  </div>
                </div>
              )}
              {!target && <details className="sound-collection" open>
                <summary>Original music & sound effects</summary>
                <p className="field-hint">
                  A small synthesized collection made for ChipToons. No
                  downloaded songs or imitated character voices.
                </p>
                <div className="sound-grid">
                  {SOUNDS.map(([id, name, kind]) => (
                    <button
                      className="button secondary small"
                      key={id}
                      disabled={busy || recording}
                      onClick={() =>
                        addSource(builtInSound(id as SoundId), kind)
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </details>}
            </section>
            {!target && <section className="voice-edit">
              <h3>Place and mix clips</h3>
              <label>
                Audio clip
                <select
                  aria-label="Audio clip"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  <option value="">Choose a clip</option>
                  {project.audioClips.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.category} · {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {clip && asset ? (
                <>
                  <p className="audio-clip-status" role="status">
                    <strong>
                      {clip.muted ? "Muted clip" : "Assigned clip"}
                    </strong>{" "}
                    · {clip.category} · {clip.duration.toFixed(2)}s ·{" "}
                    {clip.sceneId
                      ? `scene ${project.scenes.findIndex((s) => s.id === clip.sceneId) + 1}`
                      : "complete episode"}
                    . Original source preserved.
                  </p>
                  <OriginalAudio key={asset.id} asset={asset} />
                  <p className="field-hint">
                    Listen to the original source above. Preview with your
                    cartoon to hear trim, timing, fades and mixer levels.
                  </p>
                  <label>
                    Clip name
                    <input
                      aria-label="Audio clip name"
                      maxLength={100}
                      value={clip.name}
                      onChange={(e) => {
                        if (e.target.value.trim())
                          edit({ name: e.target.value });
                      }}
                    />
                  </label>
                  <div className="form-grid">
                    <label>
                      Track category
                      <select
                        aria-label="Audio track category"
                        value={clip.category}
                        onChange={(e) =>
                          edit({
                            category: e.target.value as AudioCategory,
                            characterId:
                              e.target.value === "dialogue"
                                ? clip.characterId
                                : undefined,
                          })
                        }
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Anchor clip to
                      <select
                        aria-label="Audio clip scope"
                        value={clip.sceneId ?? "episode"}
                        onChange={(e) => {
                          const sceneId =
                              e.target.value === "episode"
                                ? undefined
                                : e.target.value,
                            n = sceneId
                              ? project.scenes.find((s) => s.id === sceneId)!
                                  .duration
                              : totalDuration(project);
                          edit({
                            sceneId,
                            start: Math.min(clip.start, n - 0.02),
                            duration: Math.max(
                              0.01,
                              Math.min(
                                clip.duration,
                                n - Math.min(clip.start, n - 0.02),
                              ),
                            ),
                          });
                        }}
                      >
                        <option value="episode">Complete episode</option>
                        {project.scenes.map((s, i) => (
                          <option key={s.id} value={s.id}>
                            {i + 1}. {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {clip.category === "dialogue" && (
                    <label>
                      Character association
                      <select
                        aria-label="Audio character"
                        value={clip.characterId ?? ""}
                        onChange={(e) =>
                          edit({ characterId: e.target.value || undefined })
                        }
                      >
                        <option value="">Unassigned</option>
                        {project.characters.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <div className="form-grid">
                    <MediaNumber
                      label="Clip start (seconds)"
                      value={clip.start}
                      max={limit - clip.duration}
                      onChange={(start) => edit({ start })}
                    />
                  {(clip.soundCue || clip.ambience) && <p className="field-hint">Moving this clip directly releases its timing link. Open Add Sounds to My Cartoon to adjust the event offset or scene range.</p>}
                    <MediaNumber
                      label="Clip play length (seconds)"
                      value={clip.duration}
                      min={0.01}
                      max={Math.min(
                        limit - clip.start,
                        clip.loop ? Infinity : clip.trimEnd - clip.trimStart,
                      )}
                      onChange={(duration) => edit({ duration })}
                    />
                    <MediaNumber
                      label="Trim start (seconds)"
                      value={clip.trimStart}
                      max={clip.trimEnd - 0.01}
                      onChange={(trimStart) =>
                        edit({
                          trimStart,
                          duration: clip.loop
                            ? clip.duration
                            : Math.min(clip.duration, clip.trimEnd - trimStart),
                        })
                      }
                    />
                    <MediaNumber
                      label="Trim end (seconds)"
                      value={clip.trimEnd}
                      min={clip.trimStart + 0.01}
                      max={asset.duration}
                      onChange={(trimEnd) =>
                        edit({
                          trimEnd,
                          duration: clip.loop
                            ? clip.duration
                            : Math.min(clip.duration, trimEnd - clip.trimStart),
                        })
                      }
                    />
                    <MediaNumber
                      label="Audio fade in (seconds)"
                      value={clip.fadeIn}
                      max={clip.duration}
                      onChange={(fadeIn) => edit({ fadeIn })}
                    />
                    <MediaNumber
                      label="Audio fade out (seconds)"
                      value={clip.fadeOut}
                      max={clip.duration}
                      onChange={(fadeOut) => edit({ fadeOut })}
                    />
                  </div>
                  <div className="animation-actions">
                    <button
                      className="button secondary small"
                      onClick={() =>
                        edit({
                          fadeIn: Math.min(0.4, clip.duration / 2),
                          fadeOut: Math.min(0.6, clip.duration / 2),
                        })
                      }
                    >
                      Gentle clip fades
                    </button>
                    <button
                      className="button text small"
                      onClick={() => edit({ fadeIn: 0, fadeOut: 0 })}
                    >
                      Clear clip fades
                    </button>
                  </div>
                  <label>
                    Clip volume
                    <input
                      aria-label="Audio clip volume"
                      type="range"
                      min="0"
                      max="1"
                      step=".05"
                      value={clip.volume}
                      onChange={(e) => edit({ volume: Number(e.target.value) })}
                    />
                  </label>
                  <div className="animation-actions">
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={clip.muted}
                        onChange={(e) => edit({ muted: e.target.checked })}
                      />
                      Mute selected clip
                    </label>
                    <label className="inline-check">
                      <input
                        type="checkbox"
                        checked={clip.loop}
                        onChange={(e) =>
                          edit({
                            loop: e.target.checked,
                            duration: e.target.checked
                              ? clip.duration
                              : Math.min(
                                  clip.duration,
                                  clip.trimEnd - clip.trimStart,
                                ),
                          })
                        }
                      />
                      Loop trimmed source
                    </label>
                  </div>
                  <p className="field-hint">
                    Times are local to the chosen scene, or global for Complete
                    episode. Episode music continues across scene cuts. Trims
                    never replace the source file.
                  </p>
                  <div className="animation-actions">
                    <button
                      className="button secondary small"
                      disabled={busy || recording}
                      onClick={() => {
                        replacing.current = true;
                        input.current?.click();
                      }}
                    >
                      Replace selected audio
                    </button>
                    <button
                      className="button text small"
                      onClick={() => {
                        if (
                          commit({
                            ...project,
                            audioClips: project.audioClips.filter(
                              (c) => c.id !== clip.id,
                            ),
                          })
                        )
                          setSelected("");
                      }}
                    >
                      Remove clip from timeline
                    </button>
                  </div>
                </>
              ) : (
                <p className="field-hint">
                  Save or choose an audio clip to set its timing and trim.
                </p>
              )}
              <section className="mixer-panel">
                <h3>Cartoon mixer</h3>
                {(["master", "voice", "music", "effects"] as const).map(
                  (name) => (
                    <label key={name}>
                      {name[0].toUpperCase() + name.slice(1)} level
                      <input
                        aria-label={`${name} mixer level`}
                        type="range"
                        min="0"
                        max="1"
                        step=".05"
                        value={project.mixer[name]}
                        onChange={(e) =>
                          commit({
                            ...project,
                            mixer: {
                              ...project.mixer,
                              [name]: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </label>
                  ),
                )}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={!!project.mixer.duckMusic}
                    onChange={(e) =>
                      commit({
                        ...project,
                        mixer: {
                          ...project.mixer,
                          duckMusic: e.target.checked,
                        },
                      })
                    }
                  />
                  Lower music under recorded voices
                </label>
                <p className="field-hint">
                  Music gently lowers to 30% during audible narration and
                  dialogue, with a short fade before and after. Preview and
                  movie exports use the same mix.
                </p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={project.mixer.muted}
                    onChange={(e) =>
                      commit({
                        ...project,
                        mixer: { ...project.mixer, muted: e.target.checked },
                      })
                    }
                  />
                  Mute entire cartoon
                </label>
              </section>
            </section>}
          </div>
          {!target && <><details className="browser-voice">
            <summary>Browser voice preview (not exported)</summary>
            <p className="field-hint">
              This is a convenience voice preview. Record or upload audio to
              include a voice in your video. No automatic transcription or voice
              cloning is provided.
            </p>
            <textarea
              aria-label="Browser voice preview text"
              rows={3}
              maxLength={1000}
              value={speechText}
              onChange={(e) => setSpeechText(e.target.value)}
            />
            <div className="form-grid">
              <label>
                Browser voice
                <select
                  aria-label="Browser voice"
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                >
                  <option value="">Browser default</option>
                  {voices.map((v, i) => (
                    <option key={i} value={v.voiceURI}>
                      {v.name} · {v.lang}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Speech rate
                <input
                  aria-label="Browser speech rate"
                  type="range"
                  min=".5"
                  max="1.5"
                  step=".1"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                />
              </label>
            </div>
            {!voices.length && (
              <p className="field-hint">
                No browser voices are available in this session. Recorded and
                uploaded voices still work.
              </p>
            )}
            <div className="animation-actions">
              <button
                className="button secondary small"
                disabled={!voices.length || !speechText.trim()}
                onClick={() => {
                  speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(speechText);
                  utterance.voice =
                    voices.find((v) => v.voiceURI === voice) ?? null;
                  utterance.rate = rate;
                  speechSynthesis.speak(utterance);
                }}
              >
                Speak browser preview
              </button>
              <button
                className="button text small"
                onClick={() => window.speechSynthesis?.cancel()}
              >
                Stop browser voice
              </button>
            </div>
          </details>
          <details className="audio-sources">
            <summary>
              Sources · {project.audioAssets.length}/
              {project.mediaVersion === 1
                ? MAX_EPISODE_AUDIO_SOURCES
                : MAX_AUDIO_ASSETS}{" "}
              ·{" "}
              {project.audioAssets
                .reduce((n, a) => n + a.duration, 0)
                .toFixed(0)}
              /
              {project.mediaVersion === 1
                ? MAX_EPISODE_AUDIO_SECONDS
                : MAX_TOTAL_AUDIO_SECONDS}
              s source budget
            </summary>
            <p className="field-hint">
              Original sources stay with the project. Remove a source only after
              removing all its timeline uses. Project backups carry these files
              with your cartoon.
            </p>
            {project.audioAssets.map((a) => (
              <div className="audio-source-row" key={a.id}>
                <label>
                  Source name
                  <input
                    aria-label={`Source name ${a.name}`}
                    key={a.name}
                    defaultValue={a.name}
                    maxLength={160}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== a.name)
                        commit({
                          ...project,
                          audioAssets: project.audioAssets.map((s) =>
                            s.id === a.id ? { ...s, name: e.target.value } : s,
                          ),
                        });
                    }}
                  />
                </label>
                <span>{a.duration.toFixed(2)}s</span>
                <button
                  className="button text small"
                  onClick={() => {
                    void audioBlob(a)
                      .then((blob) =>
                        downloadBlob(
                          blob,
                          `${safeFilename(a.name)}.${a.mime === "audio/mpeg" ? "mp3" : a.mime.split("/")[1]}`,
                        ),
                      )
                      .catch((e) => setMessage((e as Error).message));
                  }}
                >
                  Download source
                </button>
                <button
                  className="button text small"
                  disabled={project.audioClips.some((c) => c.assetId === a.id) || project.scenes.some(scene =>
                    scene.script?.lines.some(line => line.takes.some(take => take.assetId === a.id)))}
                  onClick={() => setDeleteId(a.id)}
                >
                  Remove unused source
                </button>
              </div>
            ))}
          </details></>}
        </>
      )}
      {deleteId && (
        <div className="media-notice">
          <p>
            Remove this unused source from this project? A previously downloaded
            project backup keeps its own copy.
            {project.mediaVersion === 1 &&
              " Stored originals also remain on this device for recovery; removing a source does not reclaim their storage."}
          </p>
          <div className="animation-actions">
            <button
              className="button secondary"
              onClick={() => setDeleteId("")}
            >
              Cancel source removal
            </button>
            <button
              className="button primary"
              onClick={() => {
                commit({
                  ...project,
                  audioAssets: project.audioAssets.filter(
                    (a) => a.id !== deleteId,
                  ),
                });
                setDeleteId("");
              }}
            >
              {project.mediaVersion === 1
                ? "Remove source from this project"
                : "Remove source permanently"}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="media-notice" role="status">
          {message}
        </p>
      )}
      {target && confirmDiscard && (recording || draft || busy) && <div className="media-notice">
        <p role="alert">This take has not been saved to the line. Keep working or discard it before leaving.</p>
        <div className="animation-actions">
          <button className="button primary" onClick={() => setConfirmDiscard(false)}>Keep working on this take</button>
          <button className="button secondary" disabled={busy} onClick={onClose}>Discard unsaved take</button>
        </div>
      </div>}
      <div className="modal-actions">
        <button className="button secondary" onClick={close}>
          {target ? "Back to script" : "Back to cartoon"}
        </button>
        <button
          className="button primary"
          disabled={recording || busy || !!(target && draft)}
          onClick={onPreview}
        >
          Preview with cartoon
        </button>
      </div>
    </Modal>
  );
}
