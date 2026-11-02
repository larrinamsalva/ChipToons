# ChipToons Studio

Think it. Sketch it. Toon it!

A beginner-friendly, local-first children's cartoon creation studio. Turn an idea into a six-scene editable storyboard, customize original characters, preview a simple silent cartoon, and keep a portable copy of your work. No account or paid API is required.

![ChipToons Studio storyboard editor in dark mode](docs/studio-preview.jpg)

## Run locally

Use Node.js 24 (minimum 22.13) and npm.

```sh
npm ci
npm run dev
```

Open the printed URL with `/ChipToons/` at the end. To test the production build:

```sh
npm run build
npm run preview
```

## Create a first cartoon

1. Choose **Start with an idea**, pick a story starter, or try the complete inclusion demo.
2. Enter an idea, title, character names, setting and lesson. Local templates propose a short outline; every word can be changed.
3. Edit the scenes, their narration and dialogue. Add, duplicate, remove or reorder scenes. Use **My story** to edit planning notes and status.
4. Choose a background, expression, position and movement, then press **Play cartoon**. The episode uses each scene’s actual duration. Pause, seek, restart or jump between scenes.
5. Changes autosave in this browser’s IndexedDB. Wait for **Saved on this device**. Download a **Project backup** for a portable copy, and restore it from the dashboard.
6. **Download storyboard** produces a genuine SVG contact sheet containing scene art, narration and dialogue. It can be opened in a browser or printed.

**Upload a sketch or image** imports an original PNG, JPEG or WebP (4 MB / 24 megapixels maximum) as a movable image character. **Draw a character** offers a transparent drawing pad with brush, color, eraser and stroke undo. Image movement transforms the whole picture; it does not automatically rig an arbitrary photograph.

Use the visual timeline beneath the stage to add editable motion, timed expressions and camera movement. See [Animation Studio](docs/ANIMATION_STUDIO.md).

On phones, use the **Scenes**, **Preview** and **Edit scene** tabs. All editors have readable light/dark themes. Original shape characters are a keyboard-accessible alternative to the pointer-based drawing canvas.

## What this foundation includes

- Five functional start actions and a real project dashboard with thumbnails, dates, draft/ready status, duplicate, delete confirmation and restore.
- Six complete scenes in the original “A little room for a friend” demo; eight lesson starters covering kindness, friendship, helping, feelings, responsibility, safety, problem-solving and teamwork.
- Editable planning, storyboards and scene settings; undo/redo for the last 40 edits.
- Original SVG art and deterministic movement: enter left/right, walk, jump, rotate, grow and fade; shape-character expressions/blinks, wide/close camera and scene fades.
- Sequential silent cartoon playback with real durations, progress, captions and transport controls.
- IndexedDB autosave, original asset preservation, full project JSON backup/restore and SVG storyboard download.
- Responsive interfaces, keyboard navigation and browser QA including accessibility checks.

## Honest limitations

- This studio follows the [five-PR roadmap](docs/ROADMAP.md). Editable keyframes, acting, camera tracks and background motion are now implemented alongside reusable art libraries, drawing tools, scene layers and non-destructive raster crops. Audio and video export remain planned for PR #4.
- Playback is silent. Narration and dialogue appear as scene captions. There is no microphone access, speech service, music upload or WebM/MP4 export yet.
- The planner uses local, editable templates. It is not generative AI. Mood, art direction, age and desired episode length are planning notes. A longer episode goal still starts with six scenes (about one minute); add scenes to grow it.
- Changing an outline or action/prop note does not automatically rewrite narration or create new props. Each scene and its actual motion are edited separately.
- Raster uploads remain whole images. SVG uploads and remote image URLs are rejected. This avoids executing active imported SVG content.
- Work is local to this browser and origin. Clearing browser/site data or using private browsing can remove it. Save backups, and use one editor tab per project. IndexedDB transactions are atomic, but collaborative editing and multi-tab conflict resolution are not implemented.
- Up to 120 scenes, 20 characters and 40 assets per project; portable imports are capped at 32 MB. Very long text is supported in the data model but not automatically paced to match scene duration.
- Chromium desktop/phone/tablet automation is provided. Safari and Firefox need additional manual coverage before claiming full browser parity.

## Architecture

| File                        | Responsibility                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `src/model.ts`              | Versioned project, scene, character, asset and provider contracts; strict import validation |
| `src/planner.ts`            | Local template provider and original lesson starters                                        |
| `src/storage.ts`            | Atomic IndexedDB reads/writes, quota errors                                                 |
| `src/timeline.ts`           | Deterministic timeline sampling and movement math                                           |
| `src/files.ts`              | Validated raster import, embedded-asset backup, SVG storyboard download                     |
| `src/components/Stage.tsx`  | Data-driven original SVG rendering                                                          |
| `src/components/Editor.tsx` | Storyboard editing, properties and playback controls                                        |
| `src/App.tsx`               | Project lifecycle, autosave, history, import and dashboard navigation                       |

`StoryProvider` is the extension boundary for future optional story services. Core planning, editing and playback work without a backend. No secret key belongs in the Vite bundle; future paid/connected services require an explicit user action and a secure server adapter.

## Privacy and reliability

Stories, images and drawing data stay in IndexedDB. Project backups embed originals as validated raster data URLs. There are no analytics, external font calls, accounts, cloud photo uploads or AI requests. Fonts are bundled locally with their license notices. Uploaded image type/signatures, dimensions and size are checked; imported project graphs validate IDs, references, types, enumerations, numeric bounds, date strings and asset encodings before replacing any state. Backups restore as a separate project.

The saved indicator updates only after the IndexedDB transaction commits. If saving fails or storage is full, the open work stays available and a working backup action is shown. Autosave is debounced by 650 ms; use the dashboard back button to explicitly await saving before leaving the editor.

## Checks

```sh
npm run check
npx playwright install --with-deps chromium
npm run test:e2e
```

Playwright starts the built production preview at `/ChipToons/`. Build first. `PLAYWRIGHT_BASE_URL` can target an already-running preview. Tests cover the idea wizard, persisted edits after reload, scene ordering and undo/redo, complete timed playback, actual backup/storyboard downloads, original asset preservation, drawing, rejected imports, quota failures, responsive layouts and WCAG A/AA scans. Automated accessibility scans supplement manual keyboard and visual review; they do not prove complete accessibility.

## GitHub Pages

The Vite base path is `/ChipToons/`. The intended public URL is:

<https://larrinamsalva.github.io/ChipToons/>

The owner must select **Repository Settings → Pages → Build and deployment → Source → GitHub Actions**. The workflow runs checks on pull requests and `main`. Publication runs only on `main` after all unit/build/browser checks pass; PRs are not deployed or automatically merged. The `github-pages` environment may require an owner’s approval depending on repository settings. No custom token is needed.

All application navigation stays on the entry page, so static hosting needs no SPA rewrite rule. A fresh clone plus `npm ci` uses the committed dependency lockfile.

## Art and dependencies

Characters, backgrounds, lesson text, icons and illustrations were created for ChipToons. No licensed entertainment characters, commercial music or imitated character voices are included. Font credits and bundled license texts are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and `public/licenses/`.

## Reusable Character & Art Studio (PR #2)

Open **Art library** from the dashboard or an episode editor. Create an original shape character, draw artwork, or upload a PNG/JPEG/WebP. Name it, assign a collection and tags, and explicitly choose **Save to library**. Search by name, collection or tag. Saved sources can be edited, renamed, duplicated or deleted with confirmation. The original starter set includes 11 settings (including all 10 requested settings), eight props and two customizable children.

Use **Add to scene** or **Add to three scenes** to place independent snapshots. Click/touch an object on the stage to select it; drag to move and drag its bottom-right handle to resize. Use arrow keys or **Object X/Y**, size, rotation, opacity, flips and crop controls as keyboard-accessible alternatives. **Back/Forward** changes layer order. Background uploads are ordinary embedded image layers, initially placed behind the cast. Character name, outfit and expression changes in an episode are scene-specific. Saving a selected object to the library creates a separate reusable source; library edits do not silently rewrite old episodes.

The Drawing Studio offers pencil, brush, eraser, circle, ellipse, rectangle, line and star tools, fill/outline colors, saved palettes, undo/redo, zoom, selection, move/resize/rotate, duplicate/remove, transparent PNG export and retained editable objects. Use **Insert shape** and the object inspector without a pointer. Library drawings can reopen their object document for later editing. Eraser strokes are editable compositing objects. Drawing history is limited to 40 undo steps and documents to 500 objects / 50,000 points. No image-to-puppet or subject extraction is claimed. Imported pictures move as whole images, and crops/transforms are settings over the preserved original.

Shape characters support happy, sad, calm, surprised, excited and worried expressions and standing, sitting, waving, walking and pointing poses. Uploaded images use whole-image transforms, not shape facial/limb controls. Drawing objects rasterize to a PNG for efficient stage playback while the portable project retains the editable source document.

### Compatibility and recovery

IndexedDB upgrades from database version 1 to 2 by adding `library` and `settings` stores without removing or bulk-rewriting `projects`. Project schema version 1 is explicitly migrated in memory to schema 2 on read, preserving IDs, stage coordinates and timings; it is written back only on the next successful save. Schema 1 backups remain importable. Unknown versions, invalid graphs, duplicate IDs, missing assets, invalid crops, invalid drawing coordinates and active/disguised SVG data are rejected before editing state changes.

Every project embeds its own character and raster/drawing assets. Library deletion never cascades into project files. Portable project backups work without the original library and retain editable drawings and crop settings. Projects are capped at 32 MB, 40 assets, 20 character definitions, 20 objects per scene and 120 scenes; individual source uploads remain limited to 4 MB / 24 megapixels. The extra project budget supports multiple original images. When adding artwork would exceed a limit, the current project is unchanged.

Library writes update the saved list only after transaction commit. Errors keep the open draft available for retry and original images can be downloaded. Saved palettes are also local. Whole-library backups, collaborative editing and cross-tab conflict resolution are not provided; back up important episodes and use one editing tab per source.

New validation covers source reuse across episodes, scene independence, persistence, source deletion, vector drawing round trips, legacy migration, quota failure and disguised active content, plus browser flows for artwork/PNG export, crops, props, library retry and responsive light/dark accessibility. Existing PR #1 tests remain in the suite. See [the art studio guide](docs/ART_STUDIO.md) for the beginner workflow.

## Animation & Timeline Studio (PR #3)

The existing editor now includes a time ruler, draggable playhead, element and acting tracks, camera/background tracks, editable keyframe diamonds, snapping, zoom and exact numeric timing. All transforms are deterministic; discrete acting changes hold until their authored moment. Actions generate editable data, offer a temporary preview and confirm before replacing existing motion. Scene-only looping and complete-episode playback share one clock. Stage movement on an animated object writes a keyframe at the playhead; other scenes and library sources remain independent.

Original shape characters have five poses, six expressions, closed/open/smile mouths, a manually timed silent talking cycle, blinking, optional idle motion and controlled wave/nod/shake/walk gestures. Optional empathy hearts have soft shape-based glow cues. Camera keyframes pan/zoom or follow an object. Original outdoor backgrounds support cloud drift, sway and gentle stars; parallax endpoints are editable. Props use whole-object transforms, and the original door has an opening control. Uploaded pictures retain whole-image behavior.

New projects use schema 3; existing schema 1/2 backups and saved projects migrate through 1→2→3 without moving artwork or rewriting legacy motion. IndexedDB remains version 2. Explicit keyframes are limited to 120 per track and 12,000 per project; malformed times, references, IDs, values and animation types are rejected. Scene duration changes retime all tracks proportionally; clones remap their keys and follows. Backups embed motion and original artwork.

The fresh inclusion demo shows noticing a lonely friend, walking over, sadness, a wave and smile, friendship hearts, celebration and a smooth camera move. Existing saved copies are preserved. The shared frame sampler is ready for future export work, but this release remains silent and does not export video. See the [beginner animation guide](docs/ANIMATION_STUDIO.md) for controls, migration, performance and limitations.
