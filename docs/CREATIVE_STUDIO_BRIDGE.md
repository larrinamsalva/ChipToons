# ChipToons Creative Studio Bridge — first increment

This is an **opt-in creator-workflow entry point**, not a shared all-purpose media engine yet.

## What actually works

- **Framefield Studio → ChipToons:** the creator exports a PNG still from Framefield, then chooses **Start a cartoon from PNG** in the ChipToons dashboard. The existing validated image-upload flow creates a new editable ChipToons story using the image. The original 3D object, animation rig, materials, and keyframes do not transfer.
- **Auralith369 → ChipToons:** the same manual PNG workflow for finished art. Auralith layers and style recipes do not transfer.
- **ChipToons → ParaCut:** export the existing WebM movie and separately verify ParaCut's current input support. Media conversion may be necessary. No automated transfer or codec guarantee is claimed.
- **Framefield → Domistika XR:** these external projects document a bounded read-only BPC animated-mesh preview route. This is *not* a current ChipToons feature.
- **CineSwarm:** an optional future external pipeline requiring separate hardware/models and operator approval. ChipToons does not invoke it.

All links open by deliberate user action; no tokens, cross-site data reads, remote code, automatic file imports, or job submissions are involved.

## Goal: extensible, creator-first, multi-format studio

Do **not** copy all five applications into ChipToons. Keep original source projects independent, upgrade using small versioned adapters, and retain the 2D children's-cartoon workflow as a reliable fallback.

Recommended increments:

1. **This PR — Manual bridge hub:** honest source/workflow catalog, existing validated PNG upload button, testable status distinctions, no project schema changes.
2. **Frame sequence bridge:** opt-in bounded import of *actual* Framefield-rendered numbered PNG files with frame rate, resolution, size, time and integrity checks. Safely map to a new scene layer; preserve imported files and reject partial/ambiguous sequences. Ensure stage preview and real WebM export use matching frame selection. Verify in Chromium and on mobile constraints.
3. **2D/3D scene adapter:** optional GPU preview behind capability detection and feature flags; introduce typed scene source and rendering modes. Do not reinterpret a 3D scene as the native 2D puppet model. Source remains editable in its own application until native editing is implemented and tested.
4. **Professional finishing bridge:** validated video/captions/audio manifest and manual exact-file transfer to ParaCut. No automatic render or publishing authority. Verify codec and editor support against actual exported clips.
5. **XR/GLB bridge:** opt-in static or animated GLB/glTF asset interchange with exact units, transforms, coordinate order, material/skin/animation fidelity checks and target device budgets. Start read-only; XR runtime is not embedded in a child's default editor. Verify with Domistika XR and real target hardware.
6. **CineSwarm:** isolated optional machine-side jobs only after runtime, provenance, licensing, resource and human-approval boundaries are defined and tested.

## Preservation and safety

- Never alter existing ChipToons projects, backup schema, saved clips, or cinematic puppet motion just to surface a studio connection.
- Keep beginner-friendly UI, dark mode, accessibility, and no-login operation.
- Require explicit user-selected files and human approval for importing, running, rendering, exporting or publishing.
- Use source code only under appropriate licenses; preserve MIT notices and third-party attributions for actual copied code.
- Each adapter needs real integration tests against pinned source/receiver revisions, not only mock contract tests.
- Do not interpret green CI checks for an individual tool as proof that the whole interop chain is operational.

References: [ChipToons](https://github.com/larrinamsalva/ChipToons), [Framefield](https://github.com/MichaelWave369/FramefieldStudio), [Backyard Production Company bridge audit](https://github.com/MichaelWave369/BackyardProductionCompany/blob/main/docs/BRIDGE_AUDIT_V01.md).
