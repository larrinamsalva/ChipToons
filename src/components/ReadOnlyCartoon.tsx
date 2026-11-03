import { useState } from "react";
import type { Project } from "../model";
import { exportProject } from "../files";
import { Stage } from "./Stage";

export function ReadOnlyCartoon({ project, onBack, onTakeover }: {
  project: Project;
  onBack: () => void;
  onTakeover: () => void;
}) {
  const [index, setIndex] = useState(0);
  const scene = project.scenes[index];
  return (
    <main id="main-content" className="page-width recovery-readonly">
      <h1>{project.title}</h1>
      <p role="status">Open read-only · This view shows the saved cartoon when you opened it.</p>
      <div className="recovery-actions">
        <button className="button secondary" onClick={onBack}>Return to My Cartoons</button>
        <button className="button secondary" onClick={() => exportProject(project)}>Back Up My Cartoon</button>
        <button className="button primary" onClick={onTakeover}>Edit in This Tab</button>
      </div>
      <Stage project={project} scene={scene} time={0} />
      <label>Scene
        <select value={index} onChange={event => setIndex(Number(event.target.value))}>
          {project.scenes.map((item, i) => <option key={item.id} value={i}>{i + 1}. {item.title}</option>)}
        </select>
      </label>
      <p>{scene.narration}</p>
      <p>{scene.dialogue}</p>
    </main>
  );
}
