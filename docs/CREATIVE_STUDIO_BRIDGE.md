# ChipToons Creative Studio Bridge — incremental adapters

This is an **opt-in creator workflow with a real, bounded numbered-PNG animation adapter**, not a shared all-purpose 3D/XR media engine yet.

## What actually works

- **Framefield Studio → ChipToons:** the creator exports a PNG still from Framefield, then chooses **Start a cartoon from PNG** in the ChipToons dashboard. The existing validated image-upload flow creates a new editable ChipToons story using the image. The original 3D object, animation rig, materials, and keyframes do not transfer.
- **Framefield PNG sequence → ChipToons:** select **2–24 complete, matching, numbered PNG frames** on the dashboard, choose 2/4/8/12 fps and create a **new**, portable one-scene 2D cartoon. Editor scrubbing and real WebM exports use the same frame order and timing. See [Frame Sequence Bridge](FRAME_SEQUENCE_BRIDGE.md). This does not import editable 3D geometry, lights, rigs or Framefield keyframes.
- **Framefield multi-shot storyboard → ChipToons:** opt into combining **2–3 separately named numbered PNG sequences** into a new multi-scene 2D cartoon (40 PNGs total maximum, 24 MiB), with deterministic numeric shot order, real scene cuts, portable originals and the existing genuine WebM export. See [multi-shot storyboard](FRAMEFIELD_MULTISHOT_STORYBOARD.md).
- **Auralith369 → ChipToons:** the same manual single-PNG workflow for finished art. Auralith layers and style recipes do not transfer.
- **ChipToons → ParaCut:** export the existing WebM movie and separately verify ParaCut's current input support. Media conversion may be necessary. No automated transfer or codec guarantee is claimed.
- **Framefield → Domistika XR:** these external projects document a bounded read-only BPC animated-mesh preview route. This is *not* a current ChipToons feature.
- **CineSwarm:** an optional future external pipeline requiring separate hardware/models and operator approval. ChipToons does not invoke it.

All links open by deliberate user action; no tokens, cross-site data reads, remote code, automatic file imports, or job submissions are involved.

## Goal: extensible, creator-first, multi-format studio

Do **not** copy all five applications into ChipToons. Keep original source projects independent, upgrade using small versioned adapters, and retain the 2D children's-cartoon workflow as a reliable fallback.

Recommended increments:

1. **This PR — Manual bridge hub:** honest source/workflow catalog, existing validated PNG upload button, testable status distinctions, no project schema changes.
2. **PR #57 — Bounded frame sequence bridge:** local numbered PNG upload, matching PNG/image/size validation, real per-frame Stage selection, preload for true WebM export, and an actual encoded-and-decoded WebM smoke test. The new independent scene preserves each selected frame as a portable image asset. See [detailed limits and verification](FRAME_SEQUENCE_BRIDGE.md).
2b. **PR #58 — Multi-shot storyboard:** bring two or three short rendered PNG sequences into one original, validated multi-scene cartoon with real playback across hard scene boundaries. See [full limits and proof](FRAMEFIELD_MULTISHOT_STORYBOARD.md).
2c. **PR #59 — Shot Director:** opt in to manually rearranging the 2–3 numbered PNG shots, and optionally hold each last real PNG for 0–3 additional seconds before the scene cut. No new storage schema; real editor/export timings agree. See [Shot Director](FRAMEFIELD_SHOT_DIRECTOR.md).
2d. **PR #60 — Visual Shot Storyboard:** inspect the real selected PNG images with per-shot frame sliders and previous/next controls, preserving manual order and original export fidelity. Blob previews are local and their temporary URLs are revoked. See [Visual Storyboard](FRAMEFIELD_VISUAL_SHOT_STORYBOARD.md).
2e. **PR #61 — Playable Story Reel:** opt into previewing the complete rendered PNG storyboard as a silent local playback, with Play/Pause/Restart, a seek slider, real cuts, and the exact Shot Director holds. No changes to project format or exports. See [Playable Story Reel](FRAMEFIELD_PLAYABLE_STORY_REEL.md).
2f. **PR #62 — Storyboard Scene Navigator:** visible timeline shot markers with exact scene start/end times, final-frame holds and accessible click-to-pause/jump controls. Preview-only; real recorded video and project formats remain unchanged. See [Scene Navigator](FRAMEFIELD_SCENE_NAVIGATOR.md).
2g. **PR #63 — Visual Scene Filmstrip:** show the actual locally selected first PNG from each shot inside the existing accessible jump markers. Image previews use temporary revoked blob URLs; the imported project and real exports remain unchanged. See [Visual Scene Filmstrip](FRAMEFIELD_VISUAL_SCENE_FILMSTRIP.md).
2h. **PR #64 — Story Beats & Scene Notes:** optionally write an editable scene title, action/lesson note and narration text for each selected Framefield PNG shot. Notes follow shot identity when reordered, become standard scene fields in the *new* cartoon and never create audio recordings. See [Story Beats](FRAMEFIELD_STORY_BEATS.md).
2i. **PR #65 — Narration Timing & Voice Cue Sheet:** preview a rough spoken-word estimate against each shot's real duration, and download an original-order, time-coded plain-text recording script with lessons and spoken lines. No generated voice or changes to exports. See [Voice Cues](FRAMEFIELD_VOICE_CUE_SHEET.md).
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
