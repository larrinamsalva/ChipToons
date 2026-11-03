# ChipToons Studio roadmap

The studio is delivered in reviewable increments. Pull requests are never automatically merged.

## PR #1 — Functional Studio Foundation

- React, TypeScript, Vite; public, no-login, browser-local operation.
- Dashboard, five working starting actions, editable story outline and six-scene local planning.
- Full storyboard scene editing, duplication, ordering, removal, undo/redo and local autosave.
- Original inclusive demo, eight lesson starters, original SVG characters and backgrounds.
- Basic deterministic silent playback and scene movement controls so the foundation is usable.
- Basic raster import and drawing quick starts; preserved original images.
- Portable project backups with embedded assets and downloadable SVG storyboard.
- Light/dark themes, mobile editor panels, keyboard-accessible controls, CI and Pages workflow.

## PR #2 — Character and Drawing Studio

- Dedicated reusable Character and Background libraries across projects.
- More drawing tools, editable shapes, non-destructive crop and layered composition.
- Deliberate SVG sanitization/rasterization before supporting SVG imports. SVG uploads are rejected in the foundation.
- Multiple art assets, accessories and poses; preserve original source images.

Implemented: reusable characters/backgrounds/props/drawings, collection/tag search, six expressions and five shape poses, editable drawing documents and transparent PNG export, non-destructive image crops/transforms, stage selection/drag/resize, layer order, independent snapshots, project schema 1→2 migration, IndexedDB library/palette stores, and source-preserving portable backups. SVG imports remain rejected. See [Art Studio](ART_STUDIO.md) for the creator workflow and README for limits.

## PR #3 — Animation and Timeline

Implemented: explicit transform/acting keyframes, shared deterministic sampling and easing, visual timeline with touch/keyboard alternatives, editable action presets with preview and replacement confirmation, silent talking states and original part gestures, optional soft empathy hearts, camera pan/zoom/follow, lightweight background/prop motion, scene looping, schema 1→2→3 compatibility, retiming and portable animation backups. The original inclusion demo now contains editable timed acting and camera movement. See [Animation Studio](ANIMATION_STUDIO.md).

- Explicit editable keyframes, additional easing and reusable motion presets.
- Basic original shape pose/mouth states, camera movement and lightweight animated backgrounds (implemented); advanced rigging remains outside this increment.
- Timeline interaction at finer granularity; deterministic rendering shared with exports.

## PR #4 — Audio, Voices & Video Export

Implemented: explicit local microphone capture and uploaded audio, four editable duration-based timeline lanes, trim/fade/loop controls and category mixer, original synthesized sounds and sample speech, text-based timed captions/SRT, guided finishing review, and a genuine deterministic Stage-to-canvas WebM renderer with mixed Opus sound. Schema 1→2→3→4 migration preserves older artwork and animation; portable backups contain originals. Chromium tests decode real exports and measure non-silent audio. See [Audio Production](AUDIO_PRODUCTION.md) for formats, limits, recovery and browser caveats.

- Optional browser speech preview, uploaded narration and permission-based microphone recording.
- Audio tracks, original/licensed effects, music, volumes and timed subtitles.
- Capability-tested real video export; WebM first, MP4 only when it is truly supported.
- Verify downloadable videos by decoding actual frames and checking timing/audio.

## PR #5 — Creator Experience & Longer Storytelling

Implemented: three guided thought/sketch/image starts with editable per-scene drafts and Save Draft/Edit Later; six story chapters, duration planning, reviewed batch scene insertion and direct long-story navigation; scene-instance character references and confirmed appearance consistency; twelve original educational starters; original gentle sound additions, quick fades and shared music ducking; actionable finishing readiness checks; ordered whole-scene WebM segments with independent retry, segment SRT and order manifest; navigation/save protection, backup reminders and an eight-step tutorial; portable personal art-library/palette backup and atomic copy restoration.

Project schema stays 4 and IndexedDB stays 2. Additive optional fields are validated, existing schema-4 projects require no migration, and the tested 1→2→3→4 chain remains importable. Existing scenes, source art, animation and audio are preserved. Long projects render twelve memoized thumbnails at a time; exports load range-specific assets and reuse a bounded decoded-audio cache.

See [Creator Guide](CREATOR_GUIDE.md) for working controls and limits, and [PR #5 verification](PR5_VERIFICATION.md) for actual tests, media inspection and screenshots. Chromium desktop/phone/tablet and selected Firefox/WebKit automation are included. Physical iOS/Android/Safari recording and extended thermal/memory tests remain future work, along with richer original voice material, accessible drawing improvements and deliberate cross-tab conflict handling.

A six-scene roughly one-minute starter remains the starting point for a longer episode goal. Chapters and reviewed batches make an editable 15–20 minute story practical, up to 120 scenes. Each WebM file remains limited to 60 seconds on phones / 120 seconds on wider screens. This does not automatically create finished long-form footage, one uninterrupted 20-minute video, MP4, AI interpretation, photo rigging or automatic lip-sync.

## PR #6 — Long-Form Narration & Reliable Episode Production

Implemented: opt-in long-episode audio storage (thirty minutes of sources /256 MiB /256 sources /480 clips), immutable original binary files in IndexedDB 4, bounded windowed preview using the established mixer/clock, range decoding budgets, checksummed complete .ctepisode backups, atomic copy restoration, scene voice/caption/original readiness, storage estimates/protection and recovery guidance. Old inline projects and the 1→2→3→4 migration chain remain supported; project schema stays 4 with explicit optional mediaVersion 1. The original voiced demo is loaded only on request.

[Episode workflow](EPISODE_PRODUCTION.md), [format/migration](EPISODE_PACKAGE.md) and [PR #6 verification](PR6_VERIFICATION.md) document controls, actual proof and limits. The dedicated proof uses a complete original fictional twenty-minute episode with distinct narration, dialogue, music, effects, captions, six chapters and editable animation, and renders/decodes every numbered part. The original one-minute media proof and all previous regression assertions remain mandatory.

Next: physical iOS/Android/Safari recording/thermal/memory tests, broader assistive-technology testing and optional verified movie joining. WebM files remain sixty seconds on phones /120 seconds on wider screens. No MP4, automatic joining, gapless guarantee or uninterrupted twenty-minute file is claimed.


## PR #7 — Safe Media Recovery & Multi-Tab Protection

Adds the dashboard Recovery Center, original recording preview and download, exact-file reconnection, read-only backup checks, and cleanup with individual selection and an atomic reference recheck. Editing tabs coordinate ownership where supported. All project saves check a durable revision, and a conflicting draft can be saved as a separate cartoon. Project schema 4 and package format 1 stay compatible. Local database version 5 adds metadata and revisions without rewriting earlier projects or audio.

See [Project & Media Recovery](RECOVERY_CENTER.md) for the workflow and browser limits.
