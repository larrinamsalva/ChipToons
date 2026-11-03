# ChipToons Studio roadmap

The studio is delivered as five reviewable increments. Pull requests are never automatically merged.

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

## PR #5 — Polish and Expansion

- Longer project performance, richer original templates and sound material, tutorials, export recovery and usability polish.
- Expanded assistive technology and physical phone/tablet testing, including Firefox and Safari recording/export verification.
- Optional AI providers behind explicit user actions, honest provider labels, and server-held secrets.

The foundation generates a six-scene, roughly one-minute starting storyboard even when a longer episode goal is selected. It preserves that goal as a planning note. Longer projects can be built incrementally (up to 120 scenes, supported by all four project schemas); it does not claim to generate a finished 15–20 minute episode automatically.
