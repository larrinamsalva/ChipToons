import { uid, validateProject } from "./model";
import type { Project } from "./model";
import { checkAudioReferences, db, guardedProjectWrite, markCommittedOriginals, projectStores } from "./storage";
import type { LibraryItem } from "./library";
import { validateLibraryItem } from "./library";
import { validateSeries } from "./series";
import type { SeriesPlan } from "./series";

const SERIES_STORE = "series";

export interface SavedSeries {
  id: string;
  revision: string;
  plan: SeriesPlan;
}

export class SeriesConflict extends Error {
  constructor() {
    super("Another tab saved this series. Your changes are still open. Download your plan before reloading the saved version.");
    this.name = "SeriesConflict";
  }
}

export async function listSeries(): Promise<SavedSeries[]> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(SERIES_STORE);
    const request = tx.objectStore(SERIES_STORE).getAll();
    tx.oncomplete = () => {
      try {
        resolve((request.result as SavedSeries[]).map(entry => ({ ...entry, plan: validateSeries(entry.plan) }))
          .sort((a, b) => a.plan.name.localeCompare(b.plan.name)));
      } catch (error) {
        reject(error);
      }
    };
    tx.onabort = () => reject(tx.error);
  });
}

export async function saveSeries(plan: SeriesPlan, revision: string | null, artwork: LibraryItem[] = []) {
  const clean = validateSeries(plan);
  const items = artwork.map(validateLibraryItem);
  const database = await db();
  return new Promise<SavedSeries>((resolve, reject) => {
    const tx = database.transaction([SERIES_STORE, "projects", ...(items.length ? ["library"] : [])], "readwrite");
    const store = tx.objectStore(SERIES_STORE);
    const request = store.get(clean.id);
    const saved = { id: clean.id, revision: uid(), plan: clean };
    let failure: unknown;
    request.onsuccess = () => {
      try {
        const previous = request.result as SavedSeries | undefined;
        if ((previous?.revision ?? null) !== revision) {
          failure = new SeriesConflict();
          tx.abort();
          return;
        }
        for (const episode of clean.episodes) {
          if (!episode.projectId || previous?.plan.episodes.some(old =>
            old.id === episode.id && old.projectId === episode.projectId)) continue;
          const project = tx.objectStore("projects").getKey(episode.projectId);
          project.onsuccess = () => {
            if (project.result === undefined) {
              failure = new Error("That cartoon is no longer available. Choose another saved cartoon.");
              tx.abort();
            }
          };
        }
        for (const item of items) tx.objectStore("library").add(item);
        store.put(saved);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(saved);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("The series could not be saved."));
  });
}

// Both stores share the write transaction. A competing tab can see either the
// original plan or the committed link and cartoon, with no intermediate state.
export async function createSeriesEpisode(seriesId: string, episodeId: string, revision: string, draft: Project) {
  const project = validateProject(draft);
  const database = await db();
  return new Promise<string>((resolve, reject) => {
    const tx = database.transaction([SERIES_STORE, ...projectStores], "readwrite");
    const seriesStore = tx.objectStore(SERIES_STORE);
    const request = seriesStore.get(seriesId);
    let failure: unknown;
    let projectId: string;
    const fail = (error: unknown) => { failure = error; };
    request.onsuccess = () => {
      const saved = request.result as SavedSeries | undefined;
      const episode = saved?.plan.episodes.find(item => item.id === episodeId);
      if (episode?.projectId) {
        projectId = episode.projectId;
        const linked = tx.objectStore("projects").getKey(projectId);
        linked.onsuccess = () => {
          if (linked.result === undefined) {
            fail(new Error("The linked cartoon is unavailable. Review the link in My Cartoon Series."));
            tx.abort();
          }
        };
        return;
      }
      if (!saved || saved.revision !== revision || !episode || saved.plan.archived) {
        fail(new SeriesConflict());
        tx.abort();
        return;
      }
      guardedProjectWrite(tx, project.id, { revision: null, create: true }, (previous) => {
        checkAudioReferences(tx, project);
        markCommittedOriginals(tx, previous, project);
        tx.objectStore("projects").add(project);
        projectId = project.id;
        episode.projectId = projectId;
        if (episode.status === "Idea" || episode.status === "Planned") episode.status = "Storyboard";
        seriesStore.put({ ...saved, revision: uid() });
      }, fail);
    };
    tx.oncomplete = () => resolve(projectId);
    tx.onabort = () => reject(failure ?? tx.error ?? new Error("Episode creation was interrupted. Your plan is still saved."));
  });
}
