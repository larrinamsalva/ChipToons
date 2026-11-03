import { starterProject as storyboard } from "./planner";
import { addDemoProduction } from "./demo-production";
// Imported only after an explicit demo action in the app. Tests use the same
// complete fixture, preserving all original media and regression assertions.
export function starterProject(id = "kindness") {
  const project = storyboard(id);
  if (id === "kindness") addDemoProduction(project);
  return project;
}
