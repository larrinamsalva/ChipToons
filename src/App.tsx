import { restoreProjectFile } from "./episode-package";
import { emptyProduction } from "./media-model";
import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { DrawingPad } from "./components/DrawingPad";
import { Editor } from "./components/Editor";
import { Icon, Logo } from "./components/Icon";
import { CreatorGuide } from "./components/CreatorGuide";
import { ArtworkStart } from "./components/ArtworkStart";
import type { ArtworkRole } from "./story";
import { IdeaWizard } from "./components/IdeaWizard";
import { Modal } from "./components/Modal";
import { ArtLibrary } from "./components/ArtLibrary";
import { placeLibraryItem } from "./library";
import type { LibraryItem } from "./library";
import { exportProject, readImage } from "./files";
import { clone, duplicateProject } from "./model";
import type { Asset, Project } from "./model";
import { starterProject } from "./planner";
import {
  deleteProject,
  friendlyStorageError,
  listProjects,
  saveProject,
} from "./storage";

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
  | { type: "delete"; project: Project }
  | { type: "library"; sceneIndex?: number; draft?: LibraryItem }
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
    if (!current) return;
    let alive = true;
    const timer = setTimeout(() => {
      setSaveStatus("Saving…");
      saveProject(current)
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
          if (alive) {
            setSaveStatus("Save failed");
            setStorageError(friendlyStorageError(error));
          }
        });
    }, 650);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [current, retry]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!current || saveStatus === "Saved on this device") return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [current, saveStatus]);
  async function saveDraft(p: Project) {
    try {
      await saveProject(p);
    } catch (e) {
      throw new Error(friendlyStorageError(e), { cause: e });
    }
    setProjects((list) => [p, ...list.filter((item) => item.id !== p.id)]);
    setDialog(null);
    setNotice(
      "Draft saved on this device. Choose Continue story whenever you are ready.",
    );
  }
  function open(project: Project) {
    setCurrent(clone(project));
    setDialog(null);
    setPast([]);
    setFuture([]);
    setSaveStatus("Waiting to save");
    window.scrollTo({ top: 0 });
  }
  function update(project: Project) {
    if (!current) return;
    setPast((p) => [...p.slice(-39), current]);
    setFuture([]);
    setCurrent({ ...project, updatedAt: new Date().toISOString() });
    setSaveStatus("Unsaved changes");
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous || !current) return;
    setFuture((f) => [...f, current]);
    setPast((p) => p.slice(0, -1));
    setCurrent({ ...previous, updatedAt: new Date().toISOString() });
    setSaveStatus("Unsaved changes");
  }
  function redo() {
    const next = future.at(-1);
    if (!next || !current) return;
    setPast((p) => [...p, current]);
    setFuture((f) => f.slice(0, -1));
    setCurrent({ ...next, updatedAt: new Date().toISOString() });
    setSaveStatus("Unsaved changes");
  }
  async function backHome() {
    if (!current || working) return;
    setWorking(true);
    try {
      await saveProject(current);
      setProjects((list) => [
        current,
        ...list.filter((p) => p.id !== current.id),
      ]);
      setCurrent(null);
      setStorageError("");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setStorageError(friendlyStorageError(e));
      setSaveStatus("Save failed");
    } finally {
      setWorking(false);
    }
  }
  async function openDemo() {
    if (working) return;
    setWorking(true);
    setNotice("Opening the original friendship example…");
    try {
      const { starterProject: voicedDemo } = await import("./demo-starter");
      open(voicedDemo());
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
    open(p);
    setNotice(
      "Your original artwork is now a character. Choose Characters & movement to position and animate it.",
    );
  }
  async function importBackup(file?: File) {
    if (!file) return;
    setWorking(true);
    try {
      const controller = new AbortController();
      restoreController.current = controller;
      setRestoring(true);
      const p = await restoreProjectFile(file, {
        signal: controller.signal,
        onProgress: setBackupProgress,
      });
      open(p);
      setNotice(
        "Backup restored as a separate project. Your existing stories are safe.",
      );
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
      await saveProject(copy);
      setProjects((list) => [copy, ...list]);
      setNotice("A fresh copy, ready for a new adventure.");
    } catch (e) {
      open(copy);
      setStorageError(friendlyStorageError(e));
    }
  }
  async function remove(p: Project) {
    setWorking(true);
    try {
      await deleteProject(p.id);
      setProjects((list) => list.filter((s) => s.id !== p.id));
      setDialog(null);
      setNotice("Cartoon deleted from this device.");
    } catch {
      setNotice("This cartoon could not be deleted. Please try again.");
    } finally {
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
      {!loaded ? (
        <main id="main-content" className="loading-state">
          <span className="loading-star">✦</span>
          <p>Opening your creative corner…</p>
        </main>
      ) : current ? (
        <Editor
          key={current.id}
          project={current}
          onChange={update}
          onBack={() => void backHome()}
          onUndo={undo}
          onRedo={redo}
          canUndo={!!past.length}
          canRedo={!!future.length}
          saveStatus={saveStatus}
          saveError={storageError}
          onRetry={() => setRetry((r) => r + 1)}
          onLibrary={(sceneIndex, draft) =>
            setDialog({ type: "library", sceneIndex, draft })
          }
        />
      ) : (
        <Dashboard
          projects={projects}
          onIdea={(starterId) => setDialog({ type: "idea", starterId })}
          onGuidedArt={(source) => setDialog({ type: "art-start", source })}
          onDemo={() => void openDemo()}
          onUpload={() => {
            setUploadError("");
            setDialog({ type: "upload" });
          }}
          onDraw={() => setDialog({ type: "draw" })}
          onOpen={open}
          onDuplicate={(p) => void duplicate(p)}
          onDelete={(project) => setDialog({ type: "delete", project })}
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
      {dialog?.type === "idea" && (
        <IdeaWizard
          starterId={dialog.starterId}
          onClose={() => setDialog(null)}
          onCreate={open}
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
      {dialog?.type === "library" && (
        <ArtLibrary
          onClose={() => setDialog(null)}
          draft={dialog.draft}
          inProject={!!current}
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
            for (const i of targets) p = placeLibraryItem(p, i, item);
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
              onClick={() => void remove(dialog.project)}
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
