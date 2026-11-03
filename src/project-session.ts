import { saveProject, ProjectConflict } from "./storage";
import { writeEpisode } from "./audio-vault";
import type { AudioFile } from "./audio-vault";
import type { Project } from "./model";

export interface EditingSession {
  revision: string | null;
  creating: boolean;
  readOnly: boolean;
  blocked: boolean;
  saved: Project | null;
  tail: Promise<void>;
  release: () => void;
}

export function persistSession(
  session: EditingSession,
  project: Project,
  files?: AudioFile[],
  stillCurrent?: () => boolean,
  force = false,
) {
  const work = session.tail.then(async () => {
    if (session.blocked || session.readOnly) throw new ProjectConflict();
    if (stillCurrent && !stillCurrent()) throw new Error("This draft changed. Open Voices & Sound and try again.");
    if (session.saved === project && !files && !force) return;
    const guard = { revision: session.revision, create: session.creating };
    try {
      session.revision = files
        ? await writeEpisode(project, files, guard)
        : await saveProject(project, guard);
      session.creating = false;
      session.saved = project;
    } catch (error) {
      if (error instanceof ProjectConflict) session.blocked = true;
      throw error;
    }
  });
  session.tail = work.catch(() => {});
  return work;
}
