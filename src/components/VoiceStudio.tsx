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
import { newAudioClip } from "../production";
import { exportProject, downloadBlob, safeFilename } from "../files";
import { dataBytes } from "../audio-files";
import { VoiceRecorder, recordingMime } from "../recording";
import { Modal } from "./Modal";
import { MediaNumber } from "./MediaNumber";

function OriginalAudio({ asset }: { asset: AudioAsset }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.src = asset.dataUrl;
    return () => {
      el?.pause();
      el?.removeAttribute("src");
      el?.load();
    };
  }, [asset.dataUrl]);
  return (
    <audio
      ref={ref}
      controls
      preload="metadata"
      src={asset.dataUrl}
      aria-label="Original audio source"
    />
  );
}
export function VoiceStudio({
  project,
  sceneIndex,
  localTime,
  initialClip,
  initialCategory,
  initialTab = "sound",
  onChange,
  onClose,
  onPreview,
  saveStatus,
  onRetry,
}: {
  project: Project;
  sceneIndex: number;
  localTime: number;
  initialClip?: string;
  initialCategory?: AudioCategory;
  initialTab?: "sound" | "captions";
  onChange: (p: Project) => void;
  onClose: () => void;
  onPreview: () => void;
  saveStatus: string;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState(initialTab);
  const [selected, setSelected] = useState(
      initialClip ?? project.audioClips[0]?.id ?? "",
    ),
    [category, setCategory] = useState<AudioCategory>(
      initialCategory ?? "narration",
    ),
    [association, setAssociation] = useState("");
  const [draft, setDraft] = useState<AudioAsset | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [recording, setRecording] = useState(false),
    [elapsed, setElapsed] = useState(0),
    [recordName, setRecordName] = useState("My voice clip");
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
    [lowStorage, setLowStorage] = useState(false);
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
        if (alive.current)
          setLowStorage(
            !!s.quota && s.quota - (s.usage ?? 0) < 15 * 1024 * 1024,
          );
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
      validateProject(p);
      onChange(p);
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
    const next = { ...clip, ...patch };
    next.fadeIn = Math.min(next.fadeIn, next.duration);
    next.fadeOut = Math.min(next.fadeOut, next.duration);
    commit({
      ...project,
      audioClips: project.audioClips.map((c) => (c.id === clip.id ? next : c)),
    });
  }
  function addSource(source: AudioAsset, kind = category) {
    const same = project.audioAssets.find((a) => a.dataUrl === source.dataUrl),
      a = same ?? source,
      nextClip = newAudioClip(project, a, kind, sceneIndex, localTime);
    if (kind === "dialogue" && association) nextClip.characterId = association;
    if (
      commit({
        ...project,
        audioAssets: same ? project.audioAssets : [...project.audioAssets, a],
        audioClips: [...project.audioClips, nextClip],
      })
    ) {
      setSelected(nextClip.id);
      setDraft(null);
      setMessage("Audio clip added. Your original source stays intact.");
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const a = await readAudio(file);
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
  return (
    <Modal title="Voices & Sound Studio" onClose={onClose} wide>
      <p className="section-description">
        Record a kind voice, add a little music, and place sounds in your story.
        Everything stays on this device.
      </p>
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
      {lowStorage && (
        <p className="media-notice">
          Browser space is running low. Download a project backup before adding
          more recordings. You can remove unused sources below.
        </p>
      )}
      <nav className="media-tabs" aria-label="Sound studio panels">
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
      </nav>
      {tab === "captions" ? (
        <CaptionEditor
          project={project}
          sceneIndex={sceneIndex}
          time={localTime}
          onChange={commit}
        />
      ) : (
        <>
          <div className="voice-studio-grid">
            <section className="voice-create">
              <h3>Add a voice or sound</h3>
              <div className="form-grid">
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
              </div>
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
                Upload voice, music or sound
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
                      onClick={() => addSource(draft)}
                    >
                      Save audio clip
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
              <details className="sound-collection" open>
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
                      onClick={() =>
                        addSource(builtInSound(id as SoundId), kind)
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </details>
            </section>
            <section className="voice-edit">
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
            </section>
          </div>
          <details className="browser-voice">
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
              Sources · {project.audioAssets.length}/{MAX_AUDIO_ASSETS} ·{" "}
              {project.audioAssets
                .reduce((n, a) => n + a.duration, 0)
                .toFixed(0)}
              /{MAX_TOTAL_AUDIO_SECONDS}s decoded budget
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
                  onClick={() =>
                    downloadBlob(
                      new Blob(
                        [dataBytes(a.dataUrl) as Uint8Array<ArrayBuffer>],
                        { type: a.mime },
                      ),
                      `${safeFilename(a.name)}.${a.mime === "audio/mpeg" ? "mp3" : a.mime.split("/")[1]}`,
                    )
                  }
                >
                  Download source
                </button>
                <button
                  className="button text small"
                  disabled={project.audioClips.some((c) => c.assetId === a.id)}
                  onClick={() => setDeleteId(a.id)}
                >
                  Remove unused source
                </button>
              </div>
            ))}
          </details>
        </>
      )}
      {deleteId && (
        <div className="media-notice">
          <p>
            Remove this unused source from this project? A previously downloaded
            project backup keeps its own copy.
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
              Remove source permanently
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="media-notice" role="status">
          {message}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Back to cartoon
        </button>
        <button
          className="button primary"
          disabled={recording || busy}
          onClick={onPreview}
        >
          Preview with cartoon
        </button>
      </div>
    </Modal>
  );
}
