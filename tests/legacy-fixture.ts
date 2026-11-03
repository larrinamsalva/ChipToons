import type { Project } from "../src/model";
import { clone } from "../src/model";
// Construct an actual historical document; new media fields never existed there.
export function legacyFixture(project: Project, version: number) {
  const value = clone(project) as unknown as Record<string, unknown>;
  value.schemaVersion = version;
  for (const key of [
    "audioAssets",
    "audioClips",
    "captions",
    "mixer",
    "captionStyle",
  ])
    delete value[key];
  if (version < 3)
    for (const scene of value.scenes as Record<string, unknown>[]) {
      delete scene.cameraAnimation;
      delete scene.backgroundAnimation;
      for (const element of scene.elements as Record<string, unknown>[])
        delete element.animation;
    }
  return value;
}
