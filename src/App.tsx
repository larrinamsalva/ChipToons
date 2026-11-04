import { PuppetMaker } from "./components/PuppetMaker";
import { sunnyCartoon, updateScenePuppet } from "./puppet-project";
import { browserLocks, holdLock, MEDIA_ACTIVITY_LOCK, projectLock } from "./edit-locks";
import { persistSession } from "./project-session";
import type { EditingSession } from "./project-session";
import type { AudioFile } from "./audio-vault";
import { ReadOnlyCartoon } from "./components/ReadOnlyCartoon";
import { restoreProjectFile } from "./episode-package";
import { emptyProduction } from "./media-model";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { DrawingPad } from "./components/DrawingPad";
import { Editor } from "./components/Editor";
import { Icon, Logo } from "./components/Icon";
import { CreatorGuide } from "./components/CreatorGuide";
import { ArtworkStart } from "./components/ArtworkStart";
import type { ArtworkRole } from "./story";
import { IdeaWizard } from "./components/IdeaWizard";
import { CartoonAssistant } from "./components/CartoonAssistant";
import type { AssistantSeed } from "./components/CartoonAssistant";
import { createSeriesEpisode } from "./series-storage";
import { CREW_ID } from "./series-starter";
import { DEFAULT_SCRIPT } from "./script-model";
import type { SavedSeries } from "./series-storage";
import { Modal } from "./components/Modal";
import { ArtLibrary } from "./components/ArtLibrary";
import { placeLibraryItem } from "./library";
import { setSceneryDepth } from "./world-model";
import type { LibraryItem, LibraryKind } from "./library";
import { exportProject, readImage } from "./files";
import { clone, duplicateProject } from "./model";
import type { Asset, Project } from "./model";
import { starterProject } from "./planner";
import {
  deleteProject,
  friendlyStorageError,
  listProjects,
  saveProject,
  readProjectSnapshot,
  ProjectConflict,
} from "./storage";

const SeriesStudio = lazy(() => import("./components/SeriesStudio").then(module => ({ default: module.SeriesStudio })));
const RecoveryCenter = lazy(() => import("./components/RecoveryCenter").then(module => ({ default: module.RecoveryCenter })));

type Dialog =
  | {
      type: "idea";
      starterId?: string;
      artwork?: {
        asset: Asset;
        name: string;
        role: ArtworkRole;
        source: "sketch" | "image";
      };
    }
  | {
      type: "art-start";
      source: "sketch" | "image";
      initial?: { asset: Asset; name: string };
    }
  | { type: "art-draw" }
  | { type: "draw" | "help" | "upload" }
  | { type: "recovery" }
  | { type: "series"; id?: string; episodeId?: string; panel?: "Episode Plans" | "Recurring Cast" }
  | { type: "puppet"; initial?: LibraryItem; sceneIndex?: number; fromLibrary?: boolean; seriesId?: string }
  | { type: "puppet-update"; item: LibraryItem; sceneIndex: number; source: Project }
  | { type: "assistant"; source?: Project; episode?: { saved: SavedSeries; id: string; seed: AssistantSeed } }
  | { type: "delete"; project: Project; revision: string | null }
  | { type: "library"; sceneIndex?: number; draft?: LibraryItem; seriesId?: string; kind?: LibraryKind }
  | null;
function initialTheme(): "light" | "dark" {
  try {
    const saved = localStorage.getItem("chiptoons-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Theme remains usable without storage. */
  }
  return "light";
}
export default function App() {
  const [theme, setTheme] = useState(initialTheme);
  const [projects, setProjects] = useState<Project[]>([]);
  const [current, setCurrent] = useState<Project | null>(null);
  const currentRef = useRef<Project | null>(null);
  const session = useRef<EditingSession | null>(null);
  const opening = useRef(false);
  const [editMode, setEditMode] = useState<"edit" | "read" | "conflict">("edit");
  const [takingOver, setTakingOver] = useState(false);
  const [closingDraft, setClosingDraft] = useState(false);
  function showProject(project: Project | null) {
    currentRef.current = project;
    setCurrent(project);
  }
  useEffect(() => () => session.current?.release(), []);
  const [startScript, setStartScript] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [loaded, setLoaded] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("Waiting to save");
  const [retry, setRetry] = useState(0);
  const [past, setPast] = useState<Project[]>([]);
  const [future, setFuture] = useState<Project[]>([]);
  const backupInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [backupProgress, setBackupProgress] = useState<{
    phase: string;
    fraction: number;
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreController = useRef<AbortController | null>(null);
  useEffect(() => {
    const progress = (e: Event) => setBackupProgress((e as CustomEvent).detail);
    const error = (e: Event) => {
      setBackupProgress(null);
      setNotice((e as CustomEvent).detail);
    };
    window.addEventListener("chiptoons-backup-progress", progress);
    window.addEventListener("chiptoons-backup-error", error);
    return () => {
      window.removeEventListener("chiptoons-backup-progress", progress);
      window.removeEventListener("chiptoons-backup-error", error);
      restoreController.current?.abort();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("chiptoons-theme", theme);
    } catch {
      /* Cosmetic setting only. */
    }
  }, [theme]);
  useEffect(() => {
    let alive = true;
    listProjects()
      .then((p) => {
        if (alive) setProjects(p);
      })
      .catch((e) => {
        if (alive)
          setStorageError(
            e instanceof Error
              ? e.message
              : "Local storage could not be opened.",
          );
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const active = session.current;
    if (!current || !active || editMode !== "edit") return;
    let alive = true;
    const timer = setTimeout(() => {
      if (session.current !== active) return;
      setSaveStatus("Saving…");
      persistSession(active, current)
        .then(() => {
          if (!alive) return;
          setSaveStatus("Saved on this device");
          setStorageError("");
          setProjects((list) =>
            [current, ...list.filter((p) => p.id !== current.id)].sort((a, b) =>
              b.updatedAt.localeCompare(a.updatedAt),
            ),
          );
        })
        .catch((error) => {
          if (session.current === active && error instanceof ProjectConflict) {
            active.blocked = true;
            setEditMode("conflict");
            setSaveStatus("Saving paused");
            setStorageError(error.message);
          } else if (alive) {
            setSaveStatus("Save failed");
            setStorageError(friendlyStorageError(error));
          }
        });
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [current, retry, editMode]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!current || editMode === "read" || saveStatus === "Saved on this device") return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [current, saveStatus, editMode]);
  async function saveDraft(p: Project) {
    try {
      await saveProject(p, { revision: null, create: true });
    } catch (e) {
      throw new Error(friendlyStorageError(e), { cause: e });
    }
    setProjects((list) => [p, ...list.filter((item) => item.id !== p.id)]);
    setDialog(null);
    setNotice(
      "Draft saved on this device. Choose Continue story whenever you are ready.",
    );
  }
  async function open(project: Project, saved = false, mode: "edit" | "read" | "takeover" = "edit", script = false) {
    if (opening.current) return;
    opening.current = true;
    let releaseMedia: (() => void) | null = null;
    let releaseEdit: (() => void) | null = null;
    let active: EditingSession | undefined;
    let lost = false;
    try {
      releaseMedia = await holdLock(MEDIA_ACTIVITY_LOCK, { mode: "shared", ifAvailable: true });
      if (!releaseMedia) throw new Error("Storage cleanup is finishing in another tab. Open the cartoon again in a moment.");
      const lostLock = () => {
        lost = true;
        if (active && session.current === active) {
          active.blocked = true;
          setEditMode("conflict");
          setSaveStatus("Saving paused");
          setStorageError(new ProjectConflict().message);
        }
      };
      if (mode !== "read")
        releaseEdit = await holdLock(projectLock(project.id),
          mode === "takeover" ? { steal: true } : { ifAvailable: true },
          lostLock,
        );
      const readOnly = mode === "read" || !releaseEdit;
      const snapshot = saved
        ? await readProjectSnapshot(project.id, !readOnly && !!browserLocks())
        : { project, revision: null };
      if (!snapshot.project) throw new Error("This cartoon was removed in another tab. Restore a backup to reopen it.");
      const draft = clone(snapshot.project);
      const media = releaseMedia, edit = releaseEdit;
      active = {
        revision: snapshot.revision,
        creating: !saved,
        readOnly,
        blocked: lost,
        saved: null,
        tail: Promise.resolve(),
        release: () => { edit?.(); media(); },
      };
      const previous = session.current;
      session.current = active;
      if (previous) void previous.tail.then(previous.release);
      setStartScript(script);
      showProject(draft);
      setDialog(null);
      setPast([]);
      setFuture([]);
      setEditMode(readOnly ? "read" : lost ? "conflict" : "edit");
      setSaveStatus(readOnly ? "Open read-only" : lost ? "Saving paused" : "Waiting to save");
      setStorageError(lost ? new ProjectConflict().message : "");
      window.scrollTo({ top: 0 });
      releaseMedia = null;
      releaseEdit = null;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "This cartoon could not be opened.");
    } finally {
      releaseEdit?.();
      releaseMedia?.();
      opening.current = false;
      setTakingOver(false);
    }
  }

  async function convert(expected: Project, next: Project, files: AudioFile[]) {
    const active = session.current;
    if (!active) throw new ProjectConflict();
    try {
      await persistSession(active, next, files, () => currentRef.current === expected && session.current === active);
      if (currentRef.current === expected && session.current === active) update(next);
    } catch (error) {
      if (error instanceof ProjectConflict && session.current === active) {
        setEditMode("conflict");
        setSaveStatus("Saving paused");
        setStorageError(error.message);
      }
      throw error;
    }
  }

  async function saveSeparateCopy() {
    if (!current || working) return;
    setWorking(true);
    const copy = duplicateProject(current);
    try {
      await saveProject(copy, { revision: null, create: true });
      setProjects(list => [copy, ...list]);
      if (currentRef.current === current) await open(copy, true);
      setNotice("Your work was saved as a separate cartoon.");
    } catch (error) {
      setStorageError(friendlyStorageError(error));
    } finally {
      setWorking(false);
    }
  }
  function update(project: Project) {
    if (!current) return;
    setPast((p) => [...p.slice(-39), current]);
    setFuture([]);
    showProject({ ...project, updatedAt: new Date().toISOString() });
    setSaveStatus(editMode === "conflict" ? "Saving paused" : "Unsaved changes");
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous || !current) return;
    setFuture((f) => [...f, current]);
    setPast((p) => p.slice(0, -1));
    showProject({ ...previous, updatedAt: new Date().toISOString() });
    setSaveStatus(editMode === "conflict" ? "Saving paused" : "Unsaved changes");
  }
  function redo() {
    const next = future.at(-1);
    if (!next || !current) return;
    setPast((p) => [...p, current]);
    setFuture((f) => f.slice(0, -1));
    showProject({ ...next, updatedAt: new Date().toISOString() });
    setSaveStatus(editMode === "conflict" ? "Saving paused" : "Unsaved changes");
  }
  async function backHome() {
    const active = session.current;
    if (!current || !active || working) return;
    if (active.blocked) {
      setClosingDraft(true);
      return;
    }
    setWorking(true);
    try {
      if (!active.readOnly) {
        // Even a clean snapshot may have lost a file since its previous save.
        await persistSession(active, current, undefined, undefined, true);
      }
      if (currentRef.current !== current || session.current !== active) return;
      setProjects(await listProjects());
      if (currentRef.current !== current || session.current !== active) return;
      session.current = null;
      active.release();
      showProject(null);
      setStorageError("");
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e instanceof ProjectConflict) setEditMode("conflict");
      setStorageError(e instanceof ProjectConflict ? e.message : friendlyStorageError(e));
      setSaveStatus(e instanceof ProjectConflict ? "Saving paused" : "Save failed");
    } finally {
      setWorking(false);
    }
  }
  async function closeConflictingDraft() {
    const active = session.current;
    if (!active?.blocked || working) return;
    setWorking(true);
    try {
      const saved = await listProjects();
      if (session.current !== active) return;
      session.current = null;
      void active.tail.then(active.release);
      showProject(null);
      setProjects(saved);
      setStorageError("");
      setClosingDraft(false);
      window.scrollTo({ top: 0 });
    } catch {
      setNotice("Saved cartoons could not be opened. Your draft is still on this screen.");
      setClosingDraft(false);
    } finally {
      setWorking(false);
    }
  }

  async function openDemo(talking = false) {
    if (working) return;
    setWorking(true);
    setNotice(talking ? "Opening Shine’s talking example…" : "Opening the original friendship example…");
    try {
      if (talking) {
        const { shineTalkDemo } = await import("./shine-demo");
        await open(await shineTalkDemo());
      } else {
        const { starterProject: voicedDemo } = await import("./demo-starter");
        await open(voicedDemo());
      }
      setNotice("");
    } catch {
      setNotice(
        "The example’s local audio could not load. Try again when this page has finished loading.",
      );
    } finally {
      setWorking(false);
    }
  }
  function fromAsset(asset: Asset, name: string) {
    const p = starterProject();
    Object.assign(p, emptyProduction());
    p.title = `${name.slice(0, 110)}’s first story`;
    p.assets = [asset];
    p.characters[0] = {
      ...p.characters[0],
      name: name.slice(0, 80),
      assetId: asset.id,
    };
    p.scenes.forEach((s) => {
      // Uploaded artwork starts with the original whole-image motion controls,
      // without inheriting the demo shape character's face/limb animation.
      const imageElement = s.elements.find(
        (e) => e.characterId === p.characters[0].id,
      );
      if (imageElement) delete imageElement.animation;
      s.dialogue = s.dialogue.replaceAll("Pip", name.slice(0, 80));
      s.narration = s.narration.replaceAll("Pip", name.slice(0, 80));
      s.action = s.action.replaceAll("Pip", name.slice(0, 80));
    });
    void open(p);
    setNotice(
      "Your original artwork is now a character. Choose Characters & movement to position and animate it.",
    );
  }
  async function importBackup(file?: File) {
    if (!file || working) return;
    // A restore opens a different saved project. Keep a genuinely unsaved
    // editor draft on screen and put the restored copy on the dashboard.
    const active = session.current;
    const draft = currentRef.current;
    const keepDraft = !!draft && !!active && !active.readOnly && active.saved !== draft;
    setWorking(true);
    try {
      const controller = new AbortController();
      restoreController.current = controller;
      setRestoring(true);
      const p = await restoreProjectFile(file, {
        signal: controller.signal,
        onProgress: setBackupProgress,
      });
      if (keepDraft || currentRef.current !== draft) {
        setProjects(list => [p, ...list]);
        setNotice("Backup restored to My cartoons. Your open draft is still here.");
      } else {
        await open(p, true);
        setNotice("Backup restored as a separate project. Your existing stories are safe.");
      }
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "The backup could not be restored.",
      );
    } finally {
      setWorking(false);
      restoreController.current = null;
      setRestoring(false);
      setBackupProgress(null);
      if (backupInput.current) backupInput.current.value = "";
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setWorking(true);
    setUploadError("");
    try {
      const asset = await readImage(file);
      fromAsset(
        asset,
        file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "My character",
      );
    } catch (e) {
      setUploadError(
        e instanceof Error ? e.message : "The image could not be opened.",
      );
    } finally {
      setWorking(false);
      if (imageInput.current) imageInput.current.value = "";
    }
  }
  async function duplicate(p: Project) {
    const copy = duplicateProject(p);
    try {
      await saveProject(copy, { revision: null, create: true });
      setProjects((list) => [copy, ...list]);
      setNotice("A fresh copy, ready for a new adventure.");
    } catch (e) {
      await open(copy);
      setStorageError(friendlyStorageError(e));
    }
  }
  async function confirmDelete(project: Project) {
    try {
      const snapshot = await readProjectSnapshot(project.id);
      if (!snapshot.project) throw new Error("This cartoon was already removed.");
      setDialog({ type: "delete", project: snapshot.project, revision: snapshot.revision });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "The cartoon could not be checked.");
    }
  }
  async function remove(p: Project, revision: string | null) {
    setWorking(true);
    let release: (() => void) | null = null;
    try {
      release = await holdLock(projectLock(p.id), { ifAvailable: true });
      if (!release) throw new Error("Close this cartoon in its editing tab before deleting it.");
      await deleteProject(p.id, { revision });
      setProjects(list => list.filter(s => s.id !== p.id));
      setDialog(null);
      setNotice("Cartoon deleted from this device. Original recordings were kept.");
    } catch (e) {
      setDialog(null);
      setNotice(e instanceof Error ? e.message : "This cartoon could not be deleted. Please try again.");
    } finally {
      release?.();
      setWorking(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to studio
      </a>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            aria-label="ChipToons Studio home"
            onClick={() =>
              current
                ? void backHome()
                : window.scrollTo({ top: 0, behavior: "smooth" })
            }
          >
            <Logo />
          </button>
          <nav className="header-nav" aria-label="Main navigation">
            {current ? (
              <span className="editor-nav-label">
                Think it. Sketch it. Toon it!
              </span>
            ) : (
              <>
                <a className="active" href="#my-cartoons">
                  My studio
                </a>
                <a href="#story-starters">Story starters</a>
                <button onClick={() => setDialog({ type: "help" })}>
                  How it works
                </button>
              </>
            )}
          </nav>
          <div className="header-controls">
            <button
              className="icon-button theme-button"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
              onClick={() =>
                setTheme((t) => (t === "light" ? "dark" : "light"))
              }
            >
              <Icon name={theme === "light" ? "moon" : "sun"} size={20} />
            </button>
            {!current && (
              <button
                className="button primary small"
                onClick={() => setDialog({ type: "idea" })}
              >
                <Icon name="plus" size={18} />
                <span>New cartoon</span>
              </button>
            )}
            <button
              className="avatar-button"
              aria-label="Open beginner guide"
              onClick={() => setDialog({ type: "help" })}
            >
              <Icon name="help" size={21} />
            </button>
          </div>
        </div>
      </header>
      {backupProgress && (
        <div className="storage-banner" role="status">
          <span>{backupProgress.phase}</span>
          <progress
            aria-label="Complete episode backup progress"
            max={1}
            value={backupProgress.fraction}
          />
          {restoring ? (
            <button
              className="button secondary small"
              onClick={() => restoreController.current?.abort()}
            >
              Cancel restoration
            </button>
          ) : (
            <button
              className="icon-button"
              aria-label="Dismiss backup progress"
              onClick={() => setBackupProgress(null)}
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      )}
      {storageError && (
        <div className="storage-banner" role="alert">
          <Icon name="folder" size={20} />
          <span>{storageError}</span>
          {current && (
            <button
              className="button secondary small"
              onClick={() => exportProject(current)}
            >
              Download my work
            </button>
          )}
          <button
            className="button secondary small"
            onClick={() => backupInput.current?.click()}
          >
            Restore backup as a new copy
          </button>
        </div>
      )}
      {current && editMode === "conflict" && (
        <div className="storage-banner" role="status">
          <span>Saving is paused. Your edits are still here.</span>
          <button className="button primary small" disabled={working} onClick={() => void saveSeparateCopy()}>
            Save as a Separate Copy
          </button>
        </div>
      )}
      {current && editMode === "edit" && (
        <div className="editing-status" role="status">{browserLocks() ? "Editing in this tab" : "Editing · Saved versions checked for conflicts"}</div>
      )}
      {!loaded ? (
        <main id="main-content" className="loading-state">
          <span className="loading-star">✦</span>
          <p>Opening your creative corner…</p>
        </main>
      ) : current && editMode === "read" ? (
        <ReadOnlyCartoon project={current} onBack={() => void backHome()} onTakeover={() => setTakingOver(true)} />
      ) : current ? (
        <div inert={working}>
        <Editor
          key={current.id}
          startScript={startScript}
          project={current}
          onChange={update}
          onConvert={(next, files) => convert(current, next, files)}
          onBack={() => void backHome()}
          onUndo={undo}
          onRedo={redo}
          canUndo={!!past.length}
          canRedo={!!future.length}
          saveStatus={saveStatus}
          saveError={storageError}
          onRetry={() => setRetry((r) => r + 1)}
          onAssistant={() => setDialog({ type: "assistant", source: current })}
          onLibrary={(sceneIndex, draft, kind) =>
            setDialog({ type: "library", sceneIndex, draft, kind })
          }
        />
        </div>
      ) : (
        <Dashboard
          projects={projects}
          onAssistant={() => setDialog({ type: "assistant" })}
          onPuppet={() => setDialog({ type: "puppet" })}
          onIdea={(starterId) => setDialog({ type: "idea", starterId })}
          onGuidedArt={(source) => setDialog({ type: "art-start", source })}
          onDemo={() => void openDemo()}
          onTalkingDemo={() => void openDemo(true)}
          onUpload={() => {
            setUploadError("");
            setDialog({ type: "upload" });
          }}
          onDraw={() => setDialog({ type: "draw" })}
          onOpen={(p) => void open(p, true)}
          onRecovery={() => setDialog({ type: "recovery" })}
          onSeries={() => setDialog({ type: "series" })}
          onDuplicate={(p) => void duplicate(p)}
          onDelete={(project) => void confirmDelete(project)}
          onImport={() => backupInput.current?.click()}
          onHelp={() => setDialog({ type: "help" })}
          onLibrary={() => setDialog({ type: "library" })}
        />
      )}
      {!current && (
        <footer className="site-footer page-width">
          <Logo />
          <span>A little imagination. A lot of heart.</span>
          <span>
            <Icon name="lock" size={13} />
            Local by default. Yours to create.
          </span>
        </footer>
      )}
      {dialog?.type === "series" && (
        <Suspense fallback={<Modal title="My Cartoon Series" onClose={() => setDialog(null)}><p role="status">Opening series…</p></Modal>}>
          <SeriesStudio initialId={dialog.id} initialEpisodeId={dialog.episodeId} initialPanel={dialog.panel}
            onClose={() => setDialog(null)} onOpen={(project, script) => void open(project, true, "edit", script)}
            onCreate={(saved, episode, seed) => setDialog({ type: "assistant", episode: { saved, id: episode.id, seed } })}
            onLibrary={(seriesId, puppet) => setDialog(puppet ? { type: "puppet", seriesId } : { type: "library", seriesId })}
          />
        </Suspense>
      )}
      {dialog?.type === "assistant" && (
        <CartoonAssistant
          source={dialog.source}
          seed={dialog.episode?.seed}
          onClose={() => setDialog(dialog.episode
            ? { type: "series", id: dialog.episode.saved.id, episodeId: dialog.episode.id, panel: "Episode Plans" } : null)}
          onApply={async (proposal) => {
            if (dialog.episode) {
              const { saved, id } = dialog.episode;
              const episode = saved.plan.episodes.find(item => item.id === id);
              const next: Project = { ...proposal, scriptOptions: {
                ...DEFAULT_SCRIPT, seriesTitle: saved.plan.name,
                ...(saved.id === CREW_ID && episode?.title === "A Hello Heart" ? { helloHeart: true } : {}),
              } };
              const projectId = await createSeriesEpisode(saved.id, id, saved.revision, next);
              await open({ ...proposal, id: projectId }, true);
              return;
            }
            if (!dialog.source) {
              await open(proposal);
              return;
            }
            if (
              currentRef.current !== dialog.source ||
              session.current?.blocked ||
              editMode !== "edit"
            )
              throw new Error("This cartoon changed while you reviewed. Close the assistant and review the current version.");
            update(proposal);
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "idea" && (
        <IdeaWizard
          starterId={dialog.starterId}
          onClose={() => setDialog(null)}
          onCreate={project => void open(project)}
          onSaveDraft={saveDraft}
          artwork={dialog.artwork}
          onBack={
            dialog.artwork
              ? () =>
                  setDialog({
                    type: "art-start",
                    source: dialog.artwork!.source,
                    initial: {
                      asset: dialog.artwork!.asset,
                      name: dialog.artwork!.name,
                    },
                  })
              : undefined
          }
        />
      )}
      {dialog?.type === "art-start" && (
        <ArtworkStart
          source={dialog.source}
          initial={dialog.initial}
          onClose={() => setDialog(null)}
          onDraw={() => setDialog({ type: "art-draw" })}
          onNext={(asset, name, role) =>
            setDialog({
              type: "idea",
              artwork: { asset, name, role, source: dialog.source },
            })
          }
        />
      )}
      {dialog?.type === "art-draw" && (
        <DrawingPad
          onClose={() => setDialog({ type: "art-start", source: "sketch" })}
          onSave={(asset, name) =>
            setDialog({
              type: "art-start",
              source: "sketch",
              initial: { asset, name },
            })
          }
        />
      )}
      {dialog?.type === "puppet" && (
        <PuppetMaker
          initial={dialog.initial}
          onClose={() => setDialog(dialog.fromLibrary ? { type: "library", sceneIndex: dialog.sceneIndex, seriesId: dialog.seriesId }
            : dialog.seriesId ? { type: "series", id: dialog.seriesId, panel: "Recurring Cast" } : null)}
          onDemo={current ? undefined : () => void open(sunnyCartoon())}
          onUse={async item => {
            if (!current) {
              const project = { ...starterProject(), title: `${item.name}’s cartoon` };
              await open(placeLibraryItem(project, 0, item));
              return;
            }
            if (currentRef.current !== current || editMode !== "edit" || session.current?.blocked)
              throw new Error("This cartoon changed. Your puppet is saved in the library.");
            update(placeLibraryItem(current, dialog.sceneIndex ?? 0, item));
            setDialog(null);
          }}
        />
      )}
      {dialog?.type === "puppet-update" && (
        <Modal title="Review scene puppet update" onClose={() => setDialog({ type: "library", sceneIndex: dialog.sceneIndex })}>
          <p>Choose which scene puppet should use the latest library artwork and rig. Its placement and compatible animation stay in the scene. You can undo this change.</p>
          {dialog.source.scenes[dialog.sceneIndex].elements.filter(e => e.sourceLibraryId === dialog.item.id).map((element, i) => (
            <button className="button secondary" key={element.id} onClick={() => {
              try {
                if (currentRef.current !== dialog.source || editMode !== "edit" || session.current?.blocked)
                  throw new Error("The cartoon changed while you reviewed. Open the library again.");
                update(updateScenePuppet(dialog.source, dialog.sceneIndex, element.id, dialog.item));
                setDialog(null);
              } catch (e) {
                setNotice(e instanceof Error ? e.message : "The puppet could not be updated.");
                setDialog(null);
              }
            }}>Update {element.name ?? dialog.item.name} · {i + 1}</button>
          ))}
          {!dialog.source.scenes[dialog.sceneIndex].elements.some(e => e.sourceLibraryId === dialog.item.id) &&
            <p>This scene has no puppet from this library entry. Use Add to scene for a new copy.</p>}
        </Modal>
      )}
      {dialog?.type === "library" && (
        <ArtLibrary
          onClose={() => setDialog(dialog.seriesId ? { type: "series", id: dialog.seriesId, panel: "Recurring Cast" } : null)}
          draft={dialog.draft}
          initialKind={dialog.kind}
          inProject={!!current}
          onPuppet={initial => setDialog({ type: "puppet", initial, sceneIndex: dialog.sceneIndex, fromLibrary: true, seriesId: dialog.seriesId })}
          onPuppetUpdate={current ? item => setDialog({ type: "puppet-update", source: current, item, sceneIndex: dialog.sceneIndex ?? 0 }) : undefined}
          onUse={(item, three) => {
            let p = current ?? starterProject();
            const index = dialog.sceneIndex ?? 0;
            if (!current)
              p = { ...p, title: `${item.name.slice(0, 100)}’s new adventure` };
            const targets = three
              ? [
                  ...new Set([
                    index,
                    (index + 1) % p.scenes.length,
                    (index + 2) % p.scenes.length,
                  ]),
                ]
              : [index];
            for (const i of targets) {
              p = placeLibraryItem(p, i, item);
              const scene = p.scenes[i];
              const placed = scene.elements.at(-1);
              if (dialog.kind === "prop" && item.kind === "prop" && placed)
                scene.elements = setSceneryDepth(scene.elements, placed.id, "alongside");
            }
            if (current) update(p);
            else open(p);
          }}
        />
      )}
      {dialog?.type === "draw" && (
        <DrawingPad onClose={() => setDialog(null)} onSave={fromAsset} />
      )}
      {dialog?.type === "upload" && (
        <Modal
          title="Your artwork has a story to tell."
          onClose={() => setDialog(null)}
        >
          <input
            type="file"
            ref={imageInput}
            accept="image/png,image/jpeg,image/webp"
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Upload original image file"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <div className="upload-illustration">
            <Icon name="image" size={48} />
            <span>✦</span>
          </div>
          <p className="section-description">
            Bring an original sketch, a character, or a photograph. It stays on
            this device and becomes a movable image in a starter story.
          </p>
          <p className="field-hint">
            PNG, JPEG, or WebP · up to 4 MB · under 24 megapixels. A transparent
            PNG works especially well. Your original stays intact.
          </p>
          <p className="local-note">
            <Icon name="bulb" size={18} />
            Image movement animates the whole picture. It does not automatically
            separate or rig a face and limbs.
          </p>
          {uploadError && (
            <p role="alert" className="error-message">
              {uploadError}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Cancel
            </button>
            <button
              className="button primary"
              disabled={working}
              onClick={() => imageInput.current?.click()}
            >
              <Icon name="upload" />
              {working ? "Opening image…" : "Choose my image"}
            </button>
          </div>
        </Modal>
      )}
      {dialog?.type === "help" && (
        <CreatorGuide
          onClose={() => setDialog(null)}
          onStep={() => setDialog({ type: "idea" })}
        />
      )}
      {dialog?.type === "recovery" && (
        <Suspense fallback={<Modal title="Project & Media Recovery" onClose={() => setDialog(null)}><p role="status">Opening the Recovery Center…</p></Modal>}>
          <RecoveryCenter onClose={() => setDialog(null)}
            onRestore={() => { setDialog(null); backupInput.current?.click(); }}
            onOpenReadOnly={p => void open(p, true, "read")}
            onProjectsChanged={() => { void listProjects().then(setProjects).catch(() => {}); }}
          />
        </Suspense>
      )}
      {closingDraft && (
        <Modal title="Close this unsaved draft?" onClose={() => { if (!working) setClosingDraft(false); }}>
          <p>Save a separate copy or download a backup first if you want to keep the edits on this screen. Closing returns to your saved cartoons.</p>
          <div className="modal-actions">
            <button className="button secondary" disabled={working} onClick={() => setClosingDraft(false)}>Keep Draft Open</button>
            <button className="button danger" disabled={working} onClick={() => void closeConflictingDraft()}>Close Unsaved Draft</button>
          </div>
        </Modal>
      )}
      {takingOver && current && (
        <Modal title="Edit this cartoon here?" onClose={() => setTakingOver(false)}>
          <p>This opens the latest saved version for editing. The other tab keeps its open draft and can save it as a separate copy.</p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setTakingOver(false)}>Keep Read-Only</button>
            <button className="button primary" onClick={() => void open(current, true, "takeover")}>Take Over Editing</button>
          </div>
        </Modal>
      )}
      {dialog?.type === "delete" && (
        <Modal
          title="Delete this little story?"
          onClose={() => setDialog(null)}
        >
          <p>
            <strong>{dialog.project.title}</strong> will be removed from this
            device. A downloaded backup can still restore it. Separate local
            audio originals are retained for recovery and other episodes. Keep
            complete backups before clearing browser data.
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDialog(null)}
            >
              Keep my story
            </button>
            <button
              className="button danger"
              disabled={working}
              onClick={() => void remove(dialog.project, dialog.revision)}
            >
              <Icon name="trash" />
              {working ? "Deleting…" : "Delete cartoon"}
            </button>
          </div>
        </Modal>
      )}
      <input
        type="file"
        ref={backupInput}
        accept=".json,.ctepisode,application/json,application/octet-stream"
        className="visually-hidden"
        tabIndex={-1}
        aria-label="Restore project backup file"
        onChange={(e) => void importBackup(e.target.files?.[0])}
      />
      {notice && (
        <div className="toast" role="status">
          <Icon name="sparkles" size={19} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
