/**
 * Explicit, human-operated interop catalog. These are external tools, not
 * plugins executing inside ChipToons. Adding a card never grants execution,
 * upload, project read, or publishing authority.
 */
export type ConnectionState = "manual-image" | "manual-video" | "planned";

export interface StudioConnection {
  id: string;
  name: string;
  url: string;
  state: ConnectionState;
  description: string;
  instructions: string;
  canStartFromImage: boolean;
}

export const CREATIVE_STUDIOS: readonly StudioConnection[] = [
  {
    id: "framefield",
    name: "Framefield Studio · 3D & Animation",
    url: "https://michaelwave369.github.io/FramefieldStudio/",
    state: "manual-image",
    description: "Create a 3D shot and export a PNG still.",
    instructions: "Export a PNG from Framefield. Return here and choose Start a cartoon from PNG. Its 3D meshes and keyframes are not imported into ChipToons.",
    canStartFromImage: true,
  },
  {
    id: "auralith",
    name: "Auralith369 · Art Finishing",
    url: "https://michaelwave369.github.io/Auralith369/",
    state: "manual-image",
    description: "Finish original artwork and export a PNG.",
    instructions: "Export a PNG from Auralith, then start a new ChipToons cartoon from that image. Editable Auralith layers do not transfer.",
    canStartFromImage: true,
  },
  {
    id: "paracut",
    name: "ParaCut · Video Editing",
    url: "https://github.com/MichaelWave369/paracut",
    state: "manual-video",
    description: "Use ParaCut as a separate finishing editor for compatible media.",
    instructions: "Export your ChipToons WebM first. Check ParaCut's current source-media support and convert locally if necessary. No automatic video handoff is implemented.",
    canStartFromImage: false,
  },
  {
    id: "domistika-xr",
    name: "Domistika XR · Immersive Worlds",
    url: "https://michaelwave369.github.io/Domistika/xr.html",
    state: "planned",
    description: "Future immersive-scene connection.",
    instructions: "Framefield has a documented read-only BPC mesh-preview route into Domistika XR. ChipToons itself does not yet import or export interactive XR scenes.",
    canStartFromImage: false,
  },
  {
    id: "cineswarm",
    name: "CineSwarm · Advanced Video Pipeline",
    url: "https://github.com/MichaelWave369/CineSwarm",
    state: "planned",
    description: "Future opt-in local media orchestration.",
    instructions: "CineSwarm needs separate model and hardware setup. ChipToons does not invoke models, render on external machines, or submit jobs to CineSwarm.",
    canStartFromImage: false,
  },
];

export const connectionLabel = (state: ConnectionState): string =>
  state === "manual-image"
    ? "Manual PNG handoff available"
    : state === "manual-video"
      ? "Manual video workflow"
      : "Not connected yet";
