# ChipToons PR #62 — Storyboard Scene Navigator

The new **Storyboard Scene Navigator** makes the PR #61 local playable
story reel easier to review by exposing where one imported shot ends
and the next one begins.

## How to review a story

1. In ChipToons' advanced Creative Studio Bridge, choose **Build a
   multi-shot cartoon** and select 2–3 complete original numbered PNG shots.
2. Open **Watch your shots in order**. Under the image, the new
   **Storyboard scene markers** display one button for each imported shot.
3. Each marker shows its scene number, filename prefix, real start/end
   times and any optional final-frame hold. The active scene gets a
   clear visual outline. On a desktop the markers are proportional to
   their actual duration; on phones they stack into large tap targets.
4. Select a shot marker to **pause playback and jump directly to the
   first original PNG frame** of that scene. Use the existing Play/Pause,
   Restart and Seek slider to inspect individual frames or complete cuts.
5. Change shot order or hold time in Shot Director; the markers instantly
   adopt the new real scene order/timing because they use the same
   `planStoryReel` as the current preview and new-project builder.

## What changes — and what does not

- **Only the pre-import visual preview changes**: markers do not alter
  PNGs, saved cartoon projects, scene durations, exports or source
  Framefield assets. They request the existing bounded seek function.
- The navigation times come from each real shot's `start` and
  `duration`: `max(2, ceil(frameCount / fps)) + holdSeconds`.
  At an exact boundary the *next* shot begins. Final-frame holds
  continue to show the last actual imported frame, not a synthetic one.
- Accessible button names include the shot number, original prefix
  and exact start time. The current shot uses `aria-current="step"`
  and a visible border, and buttons are disabled during import.
- The existing importer's limits, backup/project formats and recorded
  WebM pipeline are unchanged. Classic cartoons, saved characters,
  audio, and the genuine complete 20-minute episode stay untouched.
- No background rendering, automatic play, network access, uploading,
  3D/GLB conversion, or external tool integration is introduced.

## Verification and merge rule

- Unit tests inspect correct boundary labels, duration-proportional
  progress and active states, held-frame timing, deterministic sampling
  and disabled controls.
- Desktop, phone and tablet Playwright tests verify accessible shot
  buttons, pausing when jumping during playback, precise seek positions,
  reordered scene markers, optional end holds and clearing a selection.
- Require Foundation/browser QA and the original full 20-minute genuine
  export check green on the **latest PR #62 commit**.
- Human review and manual merge only; **do not auto-merge**.
