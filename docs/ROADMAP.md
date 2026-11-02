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

## PR #3 — Animation and Timeline

- Explicit editable keyframes, additional easing and reusable motion presets.
- Puppet/pose and mouth states, camera movement and animated backgrounds.
- Timeline interaction at finer granularity; deterministic rendering shared with exports.

## PR #4 — Audio and Export

- Optional browser speech preview, uploaded narration and permission-based microphone recording.
- Audio tracks, original/licensed effects, music, volumes and timed subtitles.
- Capability-tested real video export; WebM first, MP4 only when it is truly supported.
- Verify downloadable videos by decoding actual frames and checking timing/audio.

## PR #5 — Polish and Expansion

- Longer project performance, richer original templates, tutorials and usability polish.
- Expanded assistive technology, phone and tablet testing.
- Optional AI providers behind explicit user actions, honest provider labels, and server-held secrets.

The foundation generates a six-scene, roughly one-minute starting storyboard even when a longer episode goal is selected. It preserves that goal as a planning note. Longer projects can be built incrementally (up to 120 scenes in schema version 1); it does not claim to generate a finished 15–20 minute episode automatically.
