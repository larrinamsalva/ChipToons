# ChipToons Studio roadmap

The studio is delivered in reviewable increments. Pull requests are never automatically merged.

For an evidence-based status of the full production goal and the next priorities, see [Production gap audit](PRODUCTION_GAP_AUDIT.md).

## Current focused increment — PR #195

- Review where a selected puppet sole enters a placed scenery image's Stage rectangle and seek the original frames. Keep the check opt in, read-only and explicit about transparent picture space.
- Verify real sampled movement, desktop/phone/tablet use and a decoded WebM with a moving painted shoe and placed picture. Preserve the technical 20-minute export gate.

## Previous focused increment — PR #194 (merged)

- Align saved flat and two-point editor ground guides with the camera transform already used for puppet artwork, so panning and zooming do not leave the guide fixed over the screen. Keep it out of playback and exports.
- Verify flat and sloped guide transforms at camera keyframes, creator playback and backup on desktop/phone/tablet, and actual camera-panned painted-shoe pixels in a decoded WebM. The guide remains manually authored and is not scenery collision detection.

## Previous focused increment — PR #193 (merged)

- Let creators add a second grounded-foot point to a scene guide for simple inclines. Compare Stage sole positions only between the two authored X positions; preserve existing flat guides, portable backup, Undo and the editor-only display.
- Verify an eight-pixel dip beneath a two-point line despite neutral foot joints, desktop/phone/tablet save and seek, and actual painted-shoe pixels in a decoded WebM. Two points remain an inspection aid, not automatic scenery geometry or collision solving.

## Previous focused increment — PR #192 (merged)

- Let a creator save a flat scene-ground height by sampling the selected foot at a known planted frame. Show an editor-only guide and grouped, seekable warnings when the selected sole crosses four Stage pixels below it. Preserve ordinary scene edits, Undo and portable backups.
- Verify that a whole character can sink beneath the fixed guide while its neutral-rig gap stays zero, including the saved browser workflow and actual painted-shoe pixels in a decoded WebM. This is a manually chosen line, not floor detection, collision solving or a completed episode.

## Previous focused increment — PR #191 (merged)

- Group read-only warnings when a selected puppet foot's sampled sole falls at least four stage pixels below its own neutral-pose baseline. Link to the deepest saved Stage frame without changing the cartoon.
- Verify a lowered painted shoe against the reported offset in a genuine decoded WebM, plus desktop, phone and tablet inspection and backup. This remains a pose warning, not actual scenery collision detection.

## Previous focused increment — PR #190 (merged)

- Extend the bounded 1–6-frame foot hold to a separately parented vector boot, using the same measured Stage sole, 12-pixel limit, saved joint keys and one-step Undo.
- Preserve actor travel and the other foot, and reject authored keys, nonlinear motion and unsafe spans. Verify creator save/Undo on desktop, phone and tablet plus actual dark vector-boot pixels in a decoded WebM. This does not create full-body physics or a guaranteed natural walk.

## Earlier focused increment — PR #186

- Let a creator mark the visible sole inside an uploaded picture foot in Puppet Maker with two mobile-friendly position controls and a live yellow preview dot. Mirror the mark with the artwork and preserve it through library reuse and backups.
- Use that mark in the existing read-only foot travel review. Verify genuine moving WebM output with the marked point while preserving original picture pixels; this does not automatically plant or retime a step.

## Previous focused increment — PR #185

- Offer a read-only foot travel review in ordinary scenes for a custom puppet with two parented feet, including picture-backed feet. Open the actual Stage at flagged near-floor frames without altering keys or artwork.
- Verify the three-second sample and project backup on desktop/phone/tablet, plus real painted-foot motion in a decoded WebM. This is a contact inspection aid; the picture's bounding box is not a true shoe sole or scene floor.

## Previous focused increment — PR #184

- Reconnect a traced or painted part to a different puppet limb while preserving its still Stage position and existing artwork. Check the new animation path and saved poses after reconnecting.
- Verify parent chains and no-position-jump behavior, the browser save/reopen flow, and actual painted-hand movement in a decoded WebM. This is joint editing, not automatic collision solving or hidden artwork generation.

## Previous focused increment — PR #183

- Let creators trace separate forearms, shins and feet directly from a picture. Attach to the matching upper limb when present and place initial pivots near natural joints without shifting the still figure.
- Verify parent chains and original picture positions, the browser save workflow, and a genuine decoded WebM with moving painted parts. Artist edits are still necessary for unusual poses, overlaps and occluded anatomy.

## Previous focused increment — PR #182

- Reuse a manually traced or uploaded arm/leg cutout on the opposite side, flipped horizontally with an independent joint. Preserve shared art and saved poses; allow replacement and manual orientation correction.
- Verify the control on desktop/phone/tablet, project backup/restore, and the painted limbs in an independently decoded moving WebM. This is an editing shortcut for symmetric art, not recovery of hidden anatomy or automatic photo conversion.
- Next priorities: finish and artist-review an original voiced pilot/full episode; guide remaining photo-part artwork; generalize contact/clipping review for custom rigs; verify full-resolution exports on real devices and nontechnical creator trials. See [Production gap audit](PRODUCTION_GAP_AUDIT.md).

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

## PR #8 — Idea-to-Cartoon Assistant

Adds a local guided route from idea to an editable six-to-twelve-scene draft. Seven educational story patterns, a character director, scene review, and gentle action and camera suggestions reuse the existing schema-4 editor, timeline and player. The original example is **The Playground of Kind Hearts**. Existing cartoons can opt in to suggestions on unused tracks with a single undo step. The existing project revisions, media recovery, audio and segmented export workflows continue to apply.

The assistant works from chosen patterns and visible wording cues after the app loads. Creators review the result and record their own narration or dialogue. See [Plan an animated first draft](CREATOR_GUIDE.md#plan-an-animated-first-draft).

## PR #9 — Puppet Maker & Character Animation Studio

Versioned puppet rigs and editable joint snapshots extend schema 4 without a database migration. The maker supports original parts, selected drawing objects, and separately prepared artwork. The art library makes independent project copies. Saved poses, joint tweening, supported presets, and assistant suggestions use the same stage renderer for playback and WebM export. See [Make a puppet with Sunny](CREATOR_GUIDE.md#make-a-puppet-with-sunny).

## PR #10 — Series & Cast Continuity Studio

**My Cartoon Series** connects the existing Assistant, project editor, Character & Art Library, Puppet Maker and production checks. It adds a series bible, recurring cast references, a thirty-episode planning board, continuity review and an optional original Kind Hearts Crew starter. Episode creation atomically links one normal cartoon, including when two tabs apply a draft. Local series plans have their own portable backup. IndexedDB version 6 adds a series store while the project schema and complete episode format stay compatible. See the [foundation audit and technical notes](SERIES_STUDIO.md).

## PR #11 — Script & Voice Director Studio

**Write My Episode Script** organizes numbered spoken lines by scene and chapter, reuses the episode cast, estimates pacing, and integrates the existing audio recorder and mixer. It adds per-line take selection and review, recurring voice notes, additive caption drafts, and a reviewed acting preview. Project schema 4 and IndexedDB 6 stay compatible. The original **A Hello Heart** example includes a genuine embedded narration take. See the [foundation audit and workflow](SCRIPT_VOICE_DIRECTOR.md).

## PR #12 — Voice-to-Mouth Animation Studio

Optional local waveform analysis links compact mouth cues to narration or dialogue, with preview, correction, manual-key precedence and Script Director integration. The stage uses the same saved timing for preview and genuine WebM export. Schema 4 and IndexedDB 6 stay compatible. See [the studio audit and guide](VOICE_MOUTH_ANIMATION.md).

## PR #13 — Complete Episode Delivery Studio

The finish dialog can collect the actual downloaded WebM parts, match recorded export hashes, check timing and tracks, and play the parts in order. A bounded delivery ZIP preserves original video bytes, SRTs, the scene-order manifest and checksums. The verifier checks the package without modifying the cartoon. The checked ZIP remains available for the original viewing files. [Complete Episode Delivery Studio](EPISODE_DELIVERY.md)

## PR #14 — Single-Movie Builder and Continuous Episode Verification

The delivery workspace joins matching Chromium VP8 exports into one locally built WebM with seek cues and a separately timed SRT. Genuine two-part and twenty-minute proofs independently decode all original pictures and measure sound through the joins. The numbered exports and ZIP remain available on phones and unsupported browsers. [Single-Movie Builder](SINGLE_MOVIE_BUILDER.md) · [Feasibility and evidence](SINGLE_MOVIE_FEASIBILITY.md)

## PR #15 — Scene & World Builder

Editable locations extend the Art Library with original scenery starters, object placement relative to the cast, optional gentle camera depth and reuse in Series Studio. The same Stage draws the preview and the movie. [World Builder audit and walkthrough](SCENE_WORLD_BUILDER.md)

## PR #16 — Character & Object Interaction Studio

Scene-local interaction events animate original story props through pickup, carry, handoff and release using the existing puppet joints and shared Stage. Creators can review motion, edit timing from the timeline, and explicitly convert small scenery into a story prop for one scene. The Assistant and Script Director offer reviewed suggestions for supported phrases. Schema 4, IndexedDB 6 and episode package version 1 stay compatible. [Interaction Studio audit and walkthrough](CHARACTER_OBJECT_INTERACTIONS.md)

## PR #17 — Fix, Build & Transform Studio

Objects can have four named appearances with editable changes, interaction links, preview approval, and independent artwork copies. The existing Script Director can link teaching steps to animation moments and numbered lines. Four original examples demonstrate a supervised toy repair, tidying, time-lapse growth, and a paper bridge. Project, storage, and package versions stay compatible. [Audit and walkthrough](FIX_BUILD_TRANSFORM.md)

## PR #18 — Visual Teaching & Focus Studio

Six original teaching graphics can follow sampled objects and camera motion, or stay fixed on screen. They link to existing learning steps, interactions and transformations, use the existing caption layout for safe placement, and render through the shared Stage into WebM. Four separate visual lesson examples preserve the earlier demos. Project and backup versions remain compatible. [Audit and walkthrough](VISUAL_TEACHING_FOCUS.md)


## PR #19 — Pause, Think & Try Studio

- Adds five timed participation activities with choices, supportive reveals, optional script and lesson links, and normal scene editing and history.
- Renders through Visual Teaching and the existing Stage. The voiced wagon example and decoded-video checks demonstrate a real thinking interval, moving highlights, and caption readability.
- See [Pause, Think & Try](PAUSE_THINK_TRY.md) for the foundation audit, privacy boundaries, and creator walkthrough.


## PR #20 — Sound Effects & Atmosphere Director

- Links existing audio clips to saved animation events, transformations, learning steps, and participation moments, with local offsets and review when a link changes.
- Adds reviewed location atmosphere presets, episode-wide loops, original effects, and nonblocking mix reminders.
- The voiced garden demo uses the regular playback and WebM export path. See [Sound Effects & Atmosphere Director](SOUND_EFFECTS_ATMOSPHERE.md) for timing, storage, licensing, and creator instructions.

## PR #21 — Camera & Shot Director Studio

- Adds editable camera shots within a scene, with precise cuts, gentle moves, stable subjects, and an explicit review when shots overlay a camera track.
- Connects the shot timeline with existing script and teaching events. The voiced wagon example uses the existing Stage, audio clock, and WebM exporter. See [Camera & Shot Director Studio](CAMERA_SHOT_DIRECTOR.md).

## PR #22 — Episode Titles, Lesson Recaps & Credits Studio

- Adds reviewed, optional opening and ending scenes, chapter cards, lesson recaps, and still or scrolling credits to the normal storyboard.
- Reuses Series Studio for optional presentation defaults, Script Director for recordings, and the shared Stage for real WebM output. See [Episode Titles, Recaps & Credits](EPISODE_TITLES_RECAPS_CREDITS.md).

## PR #176 — Optional 1080p WebM Export (merged; frame loss repaired in #177)

- Expose 1920×1080 on wider screens while preserving the 800×450 default and 1280×720 option. Render the original Stage and captions at the selected resolution with the existing audio mixer and WebM recorder.
- Decode a real downloaded 1080p movie to verify dimensions, changing frames, visible caption plate and non-silent voice/music. Do not infer quality from controls or metadata alone.
- Retain the 80 MB per-part cap and 60/120-second duration limits. At the time of this PR, the single-movie builder accepted only 450p/720p VP8 (up to 512 MiB). PR #180 adds a short, independently decoded two-part 1080p joining proof. A complete 1080p twenty-minute movie is not yet verified or guaranteed.

## PR #177 — Prevent Dropped Frames in 1080p Exports (merged)

- A real 4-second export on #176 encoded only 23 of the planned 60 frames on CI. Its 1080p media test correctly failed. This is a product defect, not a test selector failure.
- Use offline WebCodecs video samples with explicit scene timestamps and an offline copy of the existing audio mix for 1080p. Keep the lower-resolution real-time exports intact.
- Require the real 1080p file to decode with nearly all sampled frames, changing animation, an audible mix and visible captions. Keep a fast dedicated media check alongside the existing complete browser and episode suites. Do not claim a 20-minute 1080p joined movie.

## PR #178 — Optional Local 2D Color Finish for Picture Cutouts (merged)

- Keep the uploaded photo untouched while applying an optional, deterministic storybook color or bold ink treatment to each transparent hand-traced part. Reuse the derived PNG through the existing Art Library and Puppet Maker without a new project format or paid service.
- Check actual changed PNG pixels and exact alpha preservation, then independently decode a moving picture puppet in a downloaded WebM. The finishes do not provide automatic background removal, anatomy, anime or 3D generation.

## PR #179 — Plain-Background Cutout Cleanup (merged)

- Let a creator pick a spot within a traced cutout and remove only connected pixels close to that color, with Low/Medium/High strength and keyboard position fields. Keep the uploaded original untouched and preview the derived transparent PNG before saving.
- Test connected-region boundaries and destructive picks. Use a genuine uploaded flat-background picture in the browser, inspect removed alpha and preserved subject, then decode a moving puppet from a downloaded WebM. Busy backgrounds and arbitrary person segmentation remain outside this constrained local tool.

## PR #180 — Verified 1080p Movie Joining (merged)

- Accept two or more matching VP8 offline 1920×1080 exports in the existing desktop single-movie builder, retaining its 512 MiB source/output and 20-minute planned-duration gates. Preserve the original video packets and re-encode continuous Opus audio.
- Decode both real four-second HD exports, join them, compare every decoded frame and audio samples near the join, reopen and seek the downloaded movie. Align the joined subtitles to offline picture time, which has no real-time recorder lead-in.
- A successful short HD proof does not validate a full 15–20-minute 1080p episode, arbitrary third-party WebMs, MP4 or mobile assembly. Measure real device and longer-run performance separately.

## PR #181 — Inspect Actual Foot Travel in Saved Motion (in review)

- In the Workshop frame-by-frame inspector, add an optional left/right foot review for saved motion steps with separate, parented vector feet. Reuse the real 24-fps Stage samples and the existing sole geometry; show both adjacent-frame sole positions in stage pixels.
- List up to five intervals where the sole moves sideways while staying close to the rig's estimated neutral floor line, and jump back to the original adjacent Stage frames for visual review. This does not edit keyframes, add contacts, change exports or prove physically correct walking.
- Verify exact sampled sole coordinates, original project immutability, rejection of fake step endpoints and unsupported rigs, the ranking threshold, and browser controls for both feet and frame navigation. Continue the existing full browser and genuine-media checks.

## PR #187 — Hold One Painted Foot at a Reviewed Frame (merged)

- Add an optional correction beside an ordinary scene's picture-foot travel finding. It inserts one editable foot joint key into an existing linear animation interval, preserving original endpoint keys, actor travel and the other foot. The edit is saved with the project and participates in Undo/Redo; source artwork remains intact.
- Limit a single hold to 12 stage pixels. Refuse existing key times, nonlinear motion, timed gestures/talking cycles, unsupported feet and edits that fail Stage-space postchecks. Preview adjacent frames; this is a local correction, not a full contact solver or a natural walk guarantee.
- Verify backup/Undo/Redo in creator browser tests and independently decode a real WebM comparing the corrected shoe with an uncorrected shoe in the same frame. Continue the full episode technical export gate and distinguish it from a finished children's episode.

## PR #188 — Hold a Painted Foot Across Three Frames (merged)

- Add an optional three-frame hold from a suggested ordinary-scene foot-travel frame. Use the original measured sole X as the target at each consecutive 24-fps sample. Insert three joint keys in one undoable scene edit; keep the actor path, other foot, original endpoints and PNG intact.
- Refuse authored keys, non-linear or procedural acting, unsupported rigs, near-floor changes outside the reviewed span and any requested displacement beyond 12 stage pixels. Postcheck all three sampled sole positions and heights. This short local hold is not an automatic walk cycle, continuous contact solver or physical collision check.
- Exercise portable save, Undo and Redo on desktop/phone/tablet and independently decode the final held frame beside an original painted shoe in the same real WebM. Keep all prior browser and 20-minute technical export checks.

## PR #189 — Choose a Short Painted-Foot Hold Length (merged)

- Let a creator select 2–6 consecutive 24-fps samples for a picture-foot hold. Reuse the #188 validated edit path and keep the default at three frames; show when a finding does not have enough remaining samples.
- Keep the original 12-stage-pixel total reach, authored-key refusal, actor and other-foot preservation, and one-step Undo. Decline longer spans that exceed these bounds instead of silently shortening them.
- Verify several lengths and rejection boundaries in unit tests; exercise a five-frame choice on desktop, phone and tablet; independently decode a six-frame shoe hold in a real WebM. Continue full-episode technical proof without calling the local hold a finished walk cycle.

## PR #190 — Hold a Vector Puppet Boot (merged)

- Make the existing ordinary-scene hold control available to vector feet as well as picture feet, retaining the 1–6-frame linear-keyed limits, sole measurements, preserved actor path, other-foot position and one-step Undo.
- Confirm a saved vector boot stays at its reviewed stage X across four frames. Exercise the creator flow and backup/Undo on desktop, phone and tablet, and independently decode the visible boot beside its uncorrected counterpart in a real WebM.
- Keep the neutral-rig floor as an estimate and distinguish this local correction from collision detection, physically balanced motion or a polished full episode.

## PR #191 — Review Below-Neutral Foot Poses (merged)

- Group 24-fps Stage samples at least four stage pixels below a character's neutral sole baseline, rank up to five spans by depth and jump to the worst saved pose. Never alter keys when inspecting.
- Test threshold/tilt boundaries, the saved desktop/phone/tablet creator flow and the actual picture-shoe vertical offset in an independently decoded WebM. Continue the full 20-minute technical export gate.
- Keep the warning separate from scenery contact and collision claims; the neutral line moves with the actor and picture feet may have transparent padding.

## PR #192 — Save a Flat Scene Ground Reference (merged)

- Sample a selected parented foot's exact Stage sole at the current playhead and save its height on the scene. Show a dashed guide in the paused editor preview, share it with all actors in that scene, and hide it during playback and export. Keep this ordinary scene edit undoable and portable.
- Rank upright intervals where a selected foot sinks at least four pixels below the saved line, with links to original Stage frames. Preserve the separate neutral-pose and horizontal travel warnings. Verify a whole-body vertical move that the neutral-pose check cannot catch, creator save/seek/Undo/backup on desktop/phone/tablet, and visible painted-shoe offsets in a decoded WebM.
- The saved height is a flat creator-set reference; slopes, moving cameras, jumps and transparent pixels can make it inaccurate. It does not discover scenery, infer contacts or resolve collisions.

## PR #193 — Bound a Two-Point Scene Ground Guide (merged)

- Record a second grounded sole at a different Stage X to guide a gentle, straight slope. Show the saved segment in the paused editor, compare only the bounded X span, and refuse points under 80 pixels apart or with excessive grade. Existing single-height backups retain their flat guide.
- Preserve regular scene Undo/Redo, portable backups and unchanged animation/export art. Verify the independent moving-foot sample, creator flow on desktop/phone/tablet and actual painted-shoe position in a decoded WebM. Continue the long technical export gate.
- This does not read scenery pixels, infer curved terrain or solve character balance/contact. An original finished episode and real-device validation are still separate priorities.

## PR #194 — Keep Ground Guides Aligned During Camera Moves (merged)

- Draw the editor-only flat or bounded two-point guide within the Stage camera coordinate system instead of a separate stationary overlay. Keep authored ground values and warnings in world Stage space, preserve backups and hide the guide during playback/export.
- Check guide alignment at pan/zoom keys in unit and desktop/phone/tablet browser tests; independently decode a camera-panned painted shoe in a real WebM to verify motion with no exported editor guide. Keep the full 20-minute technical export gate.
- This is preview alignment, not parallax depth support, collision detection or a completed original episode.

## PR #195 — Review Foot Against a Placed Scenery Image (in review)

- Let a creator choose a non-backdrop uploaded scenery image in the existing foot review and seek frames where the selected sole enters its placed rectangle. Sample the image's saved position, scale, rotation, opacity and gentle camera depth offset with the shoe. Keep the review read-only and opt in.
- Verify the bounding-box math and no project edits, the creator flow on desktop/phone/tablet, and a moving painted shoe beside the actual scenery picture in independently decoded WebM. Retain the full technical episode export gate.
- A picture rectangle is not its opaque pixels or a walkable surface. Backdrops, built-in props and changing artwork remain outside this first check. No automatic collision repair or complete original episode is claimed.
