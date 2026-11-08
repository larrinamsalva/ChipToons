# ChipToons Shot Director — PR #59

**Purpose:** Turn imported Framefield shots into a deliberately paced little
cartoon before saving. The existing #57 one-shot and #58 numerically ordered
multi-shot imports still work by default.

## Create a story with your own shot order

1. On the ChipToons dashboard expand **More ways to create · 3D, art, film
   & XR studio connections**, select **Build a multi-shot cartoon**, and
   choose two or three complete, numbered PNG sequences.
2. The new **Shot Director · arrange your story** area lists every detected
   shot. Use **Move earlier** and **Move later** buttons to change their
   playback order. These buttons are keyboard accessible and are disabled
   at the first/last position or during import.
3. Choose **Hold final frame** for each shot to pause on the last authentic
   PNG for an additional **0–3 whole seconds**. It is useful for an
   expressive reaction shot, a moment of suspense, or a title card.
4. Verify the shot order and total length. Select **Create multi-shot cartoon**.
   ChipToons validates the current selected PNG files and their shot plan
   again when you press the button.
5. The result is an **entirely new, portable, editable cartoon**. Each shot
   becomes a separate scene with its own sequence frame IDs, ordinary
   scene duration and a hard cut. Edit captions, narration and other
   standard scene settings in the original editor.

## Exact meaning of a hold

A held frame is *not interpolated*, resampled, AI-generated or copied as
a new source asset. It stays on the **final actual PNG** using the same
deterministic `frameSequenceAssetIdAt` sampler and normal scene clock
as the existing editor and genuine video recorder.

The unmodified minimum duration is
`max(2 seconds, ceil(number of frames / selected fps))`.
Shot Director adds the selected 0–3 seconds on top of that normal duration.
These pauses are stored only as the ordinary editable scene duration:
**no new project schema, migrations or custom proprietary export format**.

## Safety and compatibility

- Original numbered-PNG restrictions remain: 2–3 shots, 2–24 frames per
  shot, at most 40 frames and 24 MiB per selection, up to 1280×720
  with matching image sizes within a shot; no missing or duplicated frames.
- A changed file selection **resets previous ordering and holds** to
  avoid stale references. The creator must deliberately re-order new shots.
- Imported shot plans must name **exactly** the set of selected prefixes,
  each exactly once, with integer holds between 0 and 3. Missing,
  repeated, foreign, or invalid plans fail before expensive file decoding.
- Existing single-shot imports, default numeric shot sorting, normal
  stored cartoons, projects, characters, puppet rigs, Classic preview,
  local-only media and the complete 20-minute video export are unaffected.
- This is still a **2D PNG image-sequence bridge**, not an editable 3D
  Framefield/GLB mesh import, XR scene runtime or hosted media service.

## Verification

Unit tests cover exact scene/asset order, additional hold durations,
preservation of the original frames, time-based sampling across real
scene cuts, disabled/invalid plans and unchanged default behavior.

The browser test exercises the real Shot Director UI at desktop, phone
and tablet sizes. On desktop it downloads a real portable backup and
records a 5-second WebM; FFmpeg decodes an image *before* and *after*
the manually moved scene boundary and checks their original colors.

Before manual merge: require **Foundation/browser QA** and **the complete
20-minute narrated episode + genuine-export job** green on the latest
commit. **Do not merge automatically.**

## PR #60 — Original frame previews

Shot Director now shows **the actual chosen PNG frames** before import. Use the slider or Previous/Next buttons to inspect a shot's artwork while moving shots in the storyboard. No saved projects, source files or export settings are changed by previewing. See [Visual Shot Storyboard](FRAMEFIELD_VISUAL_SHOT_STORYBOARD.md).
