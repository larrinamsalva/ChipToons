# PR #65 — Narration Timing & Local Voice Cue Sheet

ChipToons lets creators bring 2–3 genuine rendered PNG shots into a new
cartoon and write editable scene actions, titles and narration (#57–64).
This addition helps prepare those written lines for a human voice actor
or a separate recording session, **without creating fake audio**.

## What you can do

1. In **More ways to create · 3D, art, film & XR studio connections**,
   choose **Build a multi-shot cartoon** and select your numbered local
   PNG frames.
2. In each **Story beat · optional** editor, enter a title, what happens
   on screen, and a written line of narration. Under the narration field,
   ChipToons shows a rough count and estimated speaking time compared
   with that shot's actual duration, including its final-frame hold.
3. Longer lines show a **non-blocking timing caution**. It does not
   shorten, delete, change or prevent the narration from being imported.
   The user may revise the line, use the existing hold selector, or later
   adjust scene duration in the regular editor.
4. Reorder your scenes, add an ending hold, and preview the filmstrip.
   Select **Download voice cue sheet (.txt)**. A real plain-text local
   download includes the current ordered shot names, precise start/end
   seconds, shot lengths and holds, action/lesson notes, script lines,
   and approximate pacing cautions for each shot.
5. The cue sheet is a human recording reference. Create the new
   multi-shot cartoon as before, then record/import real audio in the
   existing ChipToons voice and sound workflow when ready.

## Important accuracy and privacy boundaries

- The pacing formula is **120 spoken English words per minute**
  (two whitespace-delimited words/second), for planning ONLY. Children's
  narration, excitement, pauses, pronunciation and non-English speech
  may differ considerably. A passing estimate is not a guarantee.
- The cue sheet is **not an audio recording, generated voice, voice
  model, lip sync track, subtitles file, automatic scene retimer or
  movie export**.
- The .txt file is created *on demand* from already selected local
  image metadata and story notes. No cloud APIs, accounts, network
  uploads, external audio tools, or project-data mutation occur.
- A new file selection or a change between single/multi-shot modes
  still clears old unsaved Story Beats. Reordering shots retains notes
  attached to their original numbered PNG prefix.
- The original numbered PNGs, clip/scene timings, created project
  backups, genuine WebM exports, characters, rigs, saved cartoons,
  and tested full 20-minute episode workflow are unchanged.
- This remains a local **2D rendered PNG bridge**, not a native 3D
  Framefield asset editor or XR runtime.

## Verification and release gates

- Vitest covers empty/short/long narration, shot time boundaries
  after reorder/holds, exact cue text and lesson lines, whitespace
  safety, and rejection of stale or invalid notes.
- Playwright desktop/phone/tablet verifies real .txt file download
  and contents, live pacing cautions, accurate scene order and cut
  times, preservation of written notes after reorder, and reset
  when a user chooses a new file set.
- Both existing Foundation/browser QA and complete 20-minute
  real narrated-export jobs must be green on the **latest commit**.
- Human merges the reviewed PR manually. **Do not auto-merge.**
